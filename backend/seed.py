"""Наполнение БД тестовыми данными.

    python seed.py           # создать таблицы (если нет) и наполнить, если БД пустая
    python seed.py --reset   # удалить все таблицы и наполнить заново

Сценарий «утро учебного дня» (время относительно текущего момента):
  * 2 класса (9"А", 9"Б"), 20 учеников, кабинеты и предметы;
  * сотрудники: SuperAdmin, директор, завуч, медсестра, учитель, дежурный;
  * проходы через турникеты, перекличка, визит в медпункт, ушедший домой ученик
    и «потерявшийся» в здании ученик (DISCREPANCY).
"""

import argparse
import asyncio
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.events import commit_and_dispatch
from app.core.security import hash_password
from app.db.base import Base, utcnow
from app.db.session import SessionLocal, engine
from app.models import (
    ClassRoom,
    GateDirection,
    LocationStatus,
    NurseOutcome,
    NurseVisit,
    SchoolClass,
    Student,
    Subject,
    User,
    UserRole,
)
from app.services import presence

DEFAULT_PASSWORD = "school123"

STAFF: list[tuple[str, str, UserRole, str]] = [
    ("admin@school.uz", "Системный Администратор", UserRole.SUPER_ADMIN, "+998900000001"),
    ("director@school.uz", "Каримова Дилноза Рустамовна", UserRole.DIRECTOR, "+998900000002"),
    ("zavuch@school.uz", "Петрова Елена Викторовна", UserRole.ZAVUCH, "+998900000003"),
    ("nurse@school.uz", "Юсупова Малика Азизовна", UserRole.NURSE, "+998900000004"),
    ("teacher@school.uz", "Абдугафоров Мансур Рустамович", UserRole.TEACHER, "+998900000005"),
    ("duty@school.uz", "Ким Сергей Александрович", UserRole.DUTY_TEACHER, "+998900000006"),
]

STUDENTS_9A = [
    "Алиев Тимур", "Беляева Анна", "Ганиев Рустам", "Давыдова Мария", "Ершов Никита",
    "Жукова Полина", "Исмоилов Азиз", "Козлова Дарья", "Латипов Шахзод", "Миронова София",
]
STUDENTS_9B = [
    "Назаров Бехруз", "Орлова Виктория", "Павлов Артём", "Рахимова Нилуфар", "Сидоров Иван",
    "Тихонова Алина", "Умаров Жасур", "Фролова Ксения", "Хасанов Отабек", "Чернова Ева",
]


async def seed(session: AsyncSession) -> dict[str, int]:
    now = utcnow()

    # --- справочники
    rooms = [ClassRoom(number="201", name="Кабинет математики"), ClassRoom(number="204", name="Кабинет информатики")]
    session.add_all(rooms)
    session.add_all(Subject(name=n) for n in ["Математика", "Русский язык", "Информатика", "Физика", "История"])

    users = [
        User(email=e, full_name=n, role=r, phone=p, is_active=True, hashed_password=hash_password(DEFAULT_PASSWORD))
        for e, n, r, p in STAFF
    ]
    session.add_all(users)
    await session.flush()
    teacher = next(u for u in users if u.role is UserRole.TEACHER)

    class_a = SchoolClass(name='9"А"', grade_level=9, classroom_id=rooms[0].id, homeroom_teacher_id=teacher.id)
    class_b = SchoolClass(name='9"Б"', grade_level=9, classroom_id=rooms[1].id)
    session.add_all([class_a, class_b])
    await session.flush()

    students: list[Student] = []
    for idx, name in enumerate(STUDENTS_9A + STUDENTS_9B, start=1):
        st = Student(
            full_name=name,
            class_id=class_a.id if idx <= 10 else class_b.id,
            rfid_card_id=f"RFID-{idx:04d}",
            parent_phone=f"+99890{1000000 + idx:07d}",
        )
        students.append(st)
    session.add_all(students)
    await session.flush()
    for st in students:
        await presence.get_or_create_state(session, st.id)

    # --- утро: проходы через турникет (IN) 40–55 минут назад
    arrived = students[:8] + students[10:20]  # 2 ученика 9"А" не пришли (UNKNOWN)
    for i, st in enumerate(arrived):
        await presence.register_gate_pass(
            session, st.id, GateDirection.IN, now - timedelta(minutes=55 - i % 15), gate_id="main-entrance-1"
        )

    # --- перекличка: все пришедшие на уроке, кроме «потерявшегося» 9"А" №8 (Козлова)
    lost = students[7]
    for st in arrived:
        if st.id != lost.id:
            await presence.set_status(session, st.id, LocationStatus.IN_CLASS, note="Отмечен на уроке", source="seed")

    # --- медпункт: Орлова (9"Б") на осмотре
    visit = NurseVisit(
        student_id=students[11].id, nurse_id=users[3].id, start_time=now - timedelta(minutes=12),
        reason="Головная боль", outcome=NurseOutcome.RESTING, notes="Температура 36.9",
    )
    session.add(visit)
    await session.flush()
    await presence.apply_nurse_visit(session, visit)

    # --- уход домой: Павлов (9"Б") вышел через турникет
    await presence.register_gate_pass(
        session, students[12].id, GateDirection.OUT, now - timedelta(minutes=5), gate_id="main-entrance-1"
    )

    # --- сверка: «потерявшийся» в здании получит флаг DISCREPANCY
    await presence.recompute_discrepancies(session, now)
    await commit_and_dispatch(session)
    return {"users": len(users), "classes": 2, "students": len(students)}


async def main(reset: bool) -> None:
    import app.models  # noqa: F401 — регистрирует модели в metadata

    async with engine.begin() as conn:
        if reset:
            await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as session:
        if not reset and (await session.scalar(select(func.count(User.id)))):
            print("БД уже содержит данные — пропускаю. Используйте --reset для пересоздания.")
            return
        stats = await seed(session)

    await engine.dispose()
    print(f"Готово: {stats}")
    print(f"Логины (пароль '{DEFAULT_PASSWORD}'): " + ", ".join(e for e, *_ in STAFF))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--reset", action="store_true", help="пересоздать все таблицы")
    asyncio.run(main(parser.parse_args().reset))
