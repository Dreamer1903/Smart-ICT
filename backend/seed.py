"""Наполнение БД тестовыми данными.

    python seed.py           # создать таблицы (если нет) и наполнить, если БД пустая
    python seed.py --reset   # удалить все таблицы и наполнить заново

Сценарий «утро учебного дня» (время относительно текущего момента):
  * 2 класса (9"А", 9"Б"), 20 учеников, кабинеты и предметы;
  * сотрудники: SuperAdmin, директор, завуч, медсестра, учитель, дежурный;
  * проходы через турникеты, перекличка, визит в медпункт, ушедший домой ученик
    и «потерявшийся» в здании ученик (DISCREPANCY);
  * приём: 2 новых ученика в процессе зачисления, пансионеры, родители у каждого ученика;
  * интеграции: лицевые счета 1С (LS-0001…), Robi ID, RFID/QR-идентификаторы, 4 контроллера;
    3 должника (см. simulators/ledger.py) получают отказ на турникете, плюс 1 неизвестная карта.
"""

import argparse
import asyncio
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.events import commit_and_dispatch
from app.core.security import hash_password
from app.db.base import Base, utcnow
from app.db.session import SessionLocal, engine
from app.models import (
    AccessDevice,
    EnrollmentStepKind,
    Guardian,
    ClassRoom,
    CredentialKind,
    DeviceAdapter,
    PaymentStatusRecord,
    StudentCredential,
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
from app.services.access import AccessRequest, handle_access_request
from app.services import enrollment as enrollment_svc
from simulators.ledger import SEED_DEBTS, STUDENTS_9A, STUDENTS_9B, account_for

DEFAULT_PASSWORD = "school123"
BOARDERS = {10, 16, 17}  # порядковые номера учеников-пансионеров

STAFF: list[tuple[str, str, UserRole, str]] = [
    ("admin@school.uz", "Системный Администратор", UserRole.SUPER_ADMIN, "+998900000001"),
    ("director@school.uz", "Каримова Дилноза Рустамовна", UserRole.DIRECTOR, "+998900000002"),
    ("zavuch@school.uz", "Петрова Елена Викторовна", UserRole.ZAVUCH, "+998900000003"),
    ("nurse@school.uz", "Юсупова Малика Азизовна", UserRole.NURSE, "+998900000004"),
    ("teacher@school.uz", "Абдугафоров Мансур Рустамович", UserRole.TEACHER, "+998900000005"),
    ("duty@school.uz", "Ким Сергей Александрович", UserRole.DUTY_TEACHER, "+998900000006"),
    ("parents@school.uz", "Сафарова Гульнора Бахтиёровна", UserRole.PARENT_RELATIONS, "+998900000007"),
    ("manager@school.uz", "Ли Анастасия Олеговна", UserRole.ADMISSIONS, "+998900000008"),
    ("cashier@school.uz", "Мирзаева Феруза Алишеровна", UserRole.CASHIER, "+998900000009"),
    ("teacher2@school.uz", "Нуриддинова Зарина Ильхомовна", UserRole.TEACHER, "+998900000010"),
]



def _surname(full_name: str) -> str:
    """Мужская форма фамилии: «Беляева» → «Беляев», «Алиев» → «Алиев»."""
    sur = full_name.split()[0]
    return sur[:-1] if sur.endswith("а") else sur


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
    teacher, teacher2 = [u for u in users if u.role is UserRole.TEACHER]

    class_a = SchoolClass(name='9"А"', grade_level=9, classroom_id=rooms[0].id, homeroom_teacher_id=teacher.id)
    class_b = SchoolClass(name='9"Б"', grade_level=9, classroom_id=rooms[1].id, homeroom_teacher_id=teacher2.id)
    session.add_all([class_a, class_b])
    await session.flush()

    students: list[Student] = []
    for idx, name in enumerate(STUDENTS_9A + STUDENTS_9B, start=1):
        st = Student(
            full_name=name,
            class_id=class_a.id if idx <= 10 else class_b.id,
            rfid_card_id=f"RFID-{idx:04d}",
            parent_phone=f"+99890{1000000 + idx:07d}",
            parent_telegram_chat_id=str(100000000 + idx),
            external_1c_id=account_for(idx),
            robi_id=f"R-{idx:04d}",
            birth_date=date(2011, (idx % 12) + 1, (idx % 27) + 1),
            admission_date=date(2023, 9, 1),
            is_boarder=idx in BOARDERS,
            boarding_room=f"П-{100 + idx}" if idx in BOARDERS else None,
            guardians=[Guardian(full_name=f"{_surname(name)}а Мадина" if idx % 2 else f"{_surname(name)} Рустам",
                                relation="мать" if idx % 2 else "отец", phone=f"+99890{1000000 + idx:07d}",
                                telegram_chat_id=str(100000000 + idx), is_primary=True)],
        )
        students.append(st)
    session.add_all(students)
    await session.flush()
    for idx, st in enumerate(students, start=1):
        await presence.get_or_create_state(session, st.id)
        session.add_all([
            StudentCredential(student_id=st.id, kind=CredentialKind.RFID, value=st.rfid_card_id or ""),
            StudentCredential(student_id=st.id, kind=CredentialKind.QR, value=f"QR-{idx:04d}"),
        ])
        # Кэш статуса оплаты (как будто 1С уже опрошена) — совпадает с симулятором 1С
        debt = SEED_DEBTS.get(idx, 0.0)
        session.add(PaymentStatusRecord(student_id=st.id, has_debt=debt > 0, debt_amount=debt, checked_at=now))

    # --- контроллеры доступа
    session.add_all([
        AccessDevice(code="main-entrance-1", name="Главный вход, турникет 1", location="Холл 1 этажа",
                     adapter=DeviceAdapter.RESPONSE),
        AccessDevice(code="main-entrance-2", name="Главный вход, турникет 2", location="Холл 1 этажа",
                     adapter=DeviceAdapter.HTTP, command_url="http://localhost:8010/controller/main-entrance-2/commands"),
        AccessDevice(code="sport-gate", name="Вход со стадиона", location="Стадион", adapter=DeviceAdapter.WEBSOCKET),
        AccessDevice(code="ui-simulator", name="Симулятор (панель администратора)", adapter=DeviceAdapter.RESPONSE),
    ])
    await session.flush()

    # --- утро: ученики прикладывают карты 40–55 минут назад (через реальный движок решений)
    arrived = students[:8] + students[10:20]  # 2 ученика 9"А" не пришли (UNKNOWN)
    granted = []
    for i, st in enumerate(arrived):
        res = await handle_access_request(session, AccessRequest(
            device_code="main-entrance-1", direction=GateDirection.IN, credential_kind=CredentialKind.RFID,
            credential_value=st.rfid_card_id, timestamp=now - timedelta(minutes=55 - i % 15),
        ))
        if res.event.decision.value == "GRANTED":
            granted.append(st)
    await handle_access_request(session, AccessRequest(  # неизвестная карта
        device_code="main-entrance-1", direction=GateDirection.IN, credential_kind=CredentialKind.RFID,
        credential_value="RFID-9999", timestamp=now - timedelta(minutes=30),
    ))

    # --- перекличка: все пришедшие на уроке, кроме «потерявшегося» 9"А" №8 (Козлова)
    lost = students[7]
    for st in granted:
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
    await handle_access_request(session, AccessRequest(
        device_code="main-entrance-1", direction=GateDirection.OUT, credential_kind=CredentialKind.RFID,
        credential_value=students[12].rfid_card_id, timestamp=now - timedelta(minutes=5),
    ))

    # --- пансионерка Миронова не выходила из здания: она в пансионате, а не «не пришла»
    await presence.set_status(session, students[9].id, LocationStatus.IN_BOARDING, note="В пансионате", source="seed")

    # --- приём новых учеников: одна заявка только что заведена, во второй кассир уже оформил оплату
    manager = next(u for u in users if u.role is UserRole.ADMISSIONS)
    cashier = next(u for u in users if u.role is UserRole.CASHIER)
    await enrollment_svc.register_student(session, manager, enrollment_svc.RegistrationData(
        full_name="Юлдашев Самандар", class_id=class_a.id, birth_date=date(2011, 4, 12), admission_date=None,
        notes="Переход из школы №110", guardians=[enrollment_svc.GuardianData(
            full_name="Юлдашева Дилфуза", relation="мать", phone="+998901112233", is_primary=True)],
    ))
    e2 = await enrollment_svc.register_student(session, manager, enrollment_svc.RegistrationData(
        full_name="Ахмедова Сабина", class_id=class_b.id, birth_date=date(2011, 9, 3), admission_date=None,
        notes=None, guardians=[enrollment_svc.GuardianData(
            full_name="Ахмедов Бобур", relation="отец", phone="+998907778899", is_primary=True)],
    ))
    e2 = await enrollment_svc.load_enrollment(session, e2.id)
    await enrollment_svc.complete_step(session, cashier, e2, EnrollmentStepKind.PAYMENT_SETUP,
                                       {"external_1c_id": "LS-0022", "contract_number": "Д-2026/022"}, None)

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
