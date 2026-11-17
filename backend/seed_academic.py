"""Демо-данные учебной части: кабинеты, предметы, учителя, классы, звонки, четверти, нагрузка,
пожелания учителей, пользователи «ученик» и «родитель», расписание (по желанию)."""

from datetime import date, time

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import (
    AcademicPeriod,
    BellSlot,
    ClassRoom,
    Guardian,
    PeriodCode,
    SchoolClass,
    Student,
    Subject,
    TeacherPreference,
    TeachingAssignment,
    User,
    UserRole,
)

PASSWORD = "school123"
SCHOOL_YEAR = "2026-2027"

# (предмет, кратко, спецкабинет?, часов в 9-м / 10-м / 11-м классе)
SUBJECTS = [
    ("Математика", "Мат", None, 5), ("Русский язык", "Рус", None, 4), ("Английский язык", "Англ", None, 4),
    ("Биология", "Био", "Кабинет биологии", 2), ("Информатика", "Инф", "Кабинет информатики", 2),
    ("Физика", "Физ", "Кабинет физики", 3), ("История", "Ист", None, 2), ("Физкультура", "Физ-ра", None, 3),
]

# email, ФИО, предметы, ограничения
TEACHERS = [
    ("math@school.uz", "Рахимов Дилшод Анварович", ["Математика"]),
    ("russian@school.uz", "Соколова Ирина Павловна", ["Русский язык"]),
    ("english@school.uz", "Тураева Нодира Бахтиёровна", ["Английский язык"]),
    ("biology@school.uz", "Хамидова Лайло Рустамовна", ["Биология"]),  # совместитель
    ("physics@school.uz", "Ким Виталий Эдуардович", ["Физика"]),
    ("history@school.uz", "Абдуллаев Шерзод Камолович", ["История"]),
    ("sport@school.uz", "Мирзаев Бобур Алишерович", ["Физкультура"]),
]


async def seed_academic(session: AsyncSession, users_by_email: dict[str, User]) -> dict[str, int]:
    # Звонки: 7 уроков по 45 минут
    starts = [(8, 30), (9, 25), (10, 25), (11, 20), (12, 15), (13, 10), (14, 0)]
    session.add_all(BellSlot(number=i, start_time=time(h, m), end_time=time(h + (m + 45) // 60, (m + 45) % 60))
                    for i, (h, m) in enumerate(starts, 1))
    # Четверти, полугодия, год, итоговая аттестация
    periods = [
        (PeriodCode.Q1, "1 четверть", date(2026, 9, 2), date(2026, 10, 31)),
        (PeriodCode.Q2, "2 четверть", date(2026, 11, 9), date(2026, 12, 26)),
        (PeriodCode.Q3, "3 четверть", date(2027, 1, 11), date(2027, 3, 19)),
        (PeriodCode.Q4, "4 четверть", date(2027, 3, 29), date(2027, 5, 25)),
        (PeriodCode.H1, "1 полугодие", date(2026, 9, 2), date(2026, 12, 26)),
        (PeriodCode.H2, "2 полугодие", date(2027, 1, 11), date(2027, 5, 25)),
        (PeriodCode.YEAR, "Год", date(2026, 9, 2), date(2027, 5, 25)),
        (PeriodCode.FINAL, "Итоговая аттестация", date(2027, 5, 26), date(2027, 6, 15)),
    ]
    session.add_all(AcademicPeriod(school_year=SCHOOL_YEAR, code=c, name=n, start_date=s, end_date=e) for c, n, s, e in periods)

    # Кабинеты и предметы
    rooms = {r.name: r for r in (await session.execute(select(ClassRoom))).scalars()}
    for number, name in (("101", "Кабинет биологии"), ("305", "Кабинет физики")):
        if name not in rooms:
            rooms[name] = ClassRoom(number=number, name=name)
            session.add(rooms[name])
    await session.flush()
    subjects = {s.name: s for s in (await session.execute(select(Subject))).scalars()}
    for name, short, room, _ in SUBJECTS:
        s = subjects.get(name) or Subject(name=name)
        s.short_name, s.room_id = short, rooms[room].id if room else None
        session.add(s)
        subjects[name] = s
    await session.flush()

    # Учителя
    def user(email: str, name: str, role: UserRole, **kw) -> User:  # noqa: ANN003
        u = User(email=email, full_name=name, role=role, is_active=True, hashed_password=hash_password(PASSWORD), **kw)
        session.add(u)
        users_by_email[email] = u
        return u

    for email, name, _ in TEACHERS:
        user(email, name, UserRole.TEACHER)
    user("academic@school.uz", "Исмоилова Гулчехра Тахировна", UserRole.ZAVUCH_ACADEMIC)
    user("upbringing@school.uz", "Назарова Мохира Шухратовна", UserRole.ZAVUCH_UPBRINGING)
    await session.flush()

    # Классы: к 9"А" и 9"Б" добавляем 10"А", 10"Б", 11"А"
    classes = {c.name: c for c in (await session.execute(select(SchoolClass))).scalars()}
    for name, grade in (('10"А"', 10), ('10"Б"', 10), ('11"А"', 11)):
        if name not in classes:
            classes[name] = SchoolClass(name=name, grade_level=grade)
            session.add(classes[name])
    await session.flush()
    classes['9"А"'].curator_id = users_by_email["history@school.uz"].id  # куратор 9"А"

    # Нагрузка: Информатика — Абдугафоров (teacher@), остальное — предметники
    by_subject = {subj: users_by_email[email] for email, _, subjs in TEACHERS for subj in subjs}
    by_subject["Информатика"] = users_by_email["teacher@school.uz"]
    n = 0
    for cls in classes.values():
        for name, _, _, hours in SUBJECTS:
            session.add(TeachingAssignment(class_id=cls.id, subject_id=subjects[name].id,
                                           teacher_id=by_subject[name].id, hours_per_week=hours))
            n += 1

    # Пожелания: биолог — совместитель (не Вт и Чт), математик — не первые уроки
    session.add(TeacherPreference(teacher_id=users_by_email["biology@school.uz"].id,
                                  cells={f"{d}-{s}": "no" for d in (2, 4) for s in range(1, 8)},
                                  comment="Совместитель: во вторник и четверг работаю в другой школе"))
    session.add(TeacherPreference(teacher_id=users_by_email["math@school.uz"].id,
                                  cells={f"{d}-1": "avoid" for d in range(1, 6)}, comment="Прошу не ставить первые уроки"))

    # Ученик и родитель (Алиев Тимур, 9"А")
    student = (await session.execute(select(Student).order_by(Student.id).limit(1))).scalar_one()
    user("student@school.uz", student.full_name, UserRole.STUDENT, student_id=student.id)
    parent = user("parent@school.uz", "Алиева Мадина (мама)", UserRole.PARENT)
    await session.flush()
    guardian = (await session.execute(select(Guardian).where(Guardian.student_id == student.id))).scalars().first()
    if guardian:
        guardian.user_id = parent.id
    await session.flush()
    return {"assignments": n, "teachers": len(TEACHERS)}
