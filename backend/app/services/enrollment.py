"""Процесс приёма ученика.

    1. REGISTRATION      — менеджер / завуч по работе с родителями: анкета, класс, родители;
                           директор получает уведомление «поступил новый ученик».
    2. PAYMENT_SETUP     — кассир: лицевой счёт 1С и договор (учёт оплаты).
    3. CLASS_ACCEPTANCE  — классный руководитель: принял в класс, пансионат да/нет, комната.
    4. ACCESS_SETUP      — администратор СКУД: лицо/ладонь в HikCentral (закрывается сам,
                           когда SchoolOS находит ученика в HikCentral).
Этапы 2–4 идут параллельно. Когда закрыты все — ученик становится ACTIVE («Учится»).
Каждое действие пишется в историю ученика (кто, что, когда) — директор видит весь процесс.
"""

from dataclasses import dataclass
from datetime import date
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.events import DomainEvent, enqueue_event
from app.db.base import utcnow
from app.models import (
    Enrollment,
    EnrollmentStatus,
    EnrollmentStep,
    EnrollmentStepKind,
    Guardian,
    LocationStatus,
    SchoolClass,
    StaffNotification,
    StepStatus,
    Student,
    StudentStatus,
    StudentTimelineEvent,
    User,
    UserRole,
)
from app.services import outbox, presence

STEP_LABEL: dict[EnrollmentStepKind, str] = {
    EnrollmentStepKind.REGISTRATION: "Анкета и родители",
    EnrollmentStepKind.PAYMENT_SETUP: "Оплата: лицевой счёт 1С и договор",
    EnrollmentStepKind.CLASS_ACCEPTANCE: "Принят в класс, пансионат",
    EnrollmentStepKind.ACCESS_SETUP: "Доступ: лицо в HikCentral",
}


class EnrollmentError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


# ---------------------------------------------------------------- Уведомления сотрудникам и история

async def users_with_roles(session: AsyncSession, *roles: UserRole) -> list[User]:
    return list((await session.execute(
        select(User).where(User.role.in_(roles), User.is_active.is_(True))
    )).scalars())


def notify_users(session: AsyncSession, users: list[User], title: str, body: str | None = None,
                 link: str | None = None, *, exclude: User | None = None) -> None:
    seen: set[int] = set()
    for u in users:
        if u.id in seen or (exclude is not None and u.id == exclude.id):
            continue
        seen.add(u.id)
        session.add(StaffNotification(user_id=u.id, title=title, body=body, link=link))
        if u.telegram_chat_id and "telegram" in settings.notify_channel_set:
            outbox.enqueue(session, "telegram", {"to": u.telegram_chat_id, "text": f"{title}\n{body or ''}".strip()})
        enqueue_event(session, DomainEvent(type="staff.notification", payload={"user_id": u.id, "title": title}))


def add_timeline(session: AsyncSession, student_id: int, actor: User | None, kind: str, text: str) -> None:
    session.add(StudentTimelineEvent(student_id=student_id, actor_id=actor.id if actor else None, kind=kind, text=text[:500]))


# ---------------------------------------------------------------- Регистрация

@dataclass
class GuardianData:
    full_name: str
    relation: str | None = None
    phone: str | None = None
    telegram_chat_id: str | None = None
    is_primary: bool = False


@dataclass
class RegistrationData:
    full_name: str
    class_id: int
    birth_date: date | None
    admission_date: date | None
    notes: str | None
    guardians: list[GuardianData]


async def _class_teacher(session: AsyncSession, school_class: SchoolClass) -> User | None:
    return await session.get(User, school_class.homeroom_teacher_id) if school_class.homeroom_teacher_id else None


def _sync_primary_contact(student: Student) -> None:
    """Основной родитель → контакты для уведомлений (parent_phone / parent_telegram_chat_id)."""
    primary = next((g for g in student.guardians if g.is_primary), student.guardians[0] if student.guardians else None)
    if primary:
        student.parent_phone = primary.phone
        student.parent_telegram_chat_id = primary.telegram_chat_id


async def register_student(session: AsyncSession, actor: User, data: RegistrationData) -> Enrollment:
    school_class = await session.get(SchoolClass, data.class_id)
    if school_class is None:
        raise EnrollmentError("Класс не найден", 404)
    if not data.guardians:
        raise EnrollmentError("Нужен хотя бы один родитель / представитель")

    student = Student(
        full_name=data.full_name.strip(), class_id=school_class.id, birth_date=data.birth_date,
        admission_date=data.admission_date, notes=data.notes, status=StudentStatus.ENROLLING,
        guardians=[Guardian(**g.__dict__) for g in data.guardians],
    )
    if not any(g.is_primary for g in student.guardians):
        student.guardians[0].is_primary = True
    _sync_primary_contact(student)
    session.add(student)
    await session.flush()

    teacher = await _class_teacher(session, school_class)
    now = utcnow()
    enrollment = Enrollment(student_id=student.id, created_by_id=actor.id, steps=[
        EnrollmentStep(kind=EnrollmentStepKind.REGISTRATION, assignee_role=actor.role, status=StepStatus.DONE,
                       completed_by_id=actor.id, completed_at=now),
        EnrollmentStep(kind=EnrollmentStepKind.PAYMENT_SETUP, assignee_role=UserRole.CASHIER),
        EnrollmentStep(kind=EnrollmentStepKind.CLASS_ACCEPTANCE,
                       assignee_role=UserRole.TEACHER if teacher else UserRole.ZAVUCH,
                       assignee_user_id=teacher.id if teacher else None),
        EnrollmentStep(kind=EnrollmentStepKind.ACCESS_SETUP, assignee_role=UserRole.SUPER_ADMIN),
    ])
    session.add(enrollment)
    await session.flush()

    who = f"{student.full_name}, {school_class.name}"
    link = f"/students/{student.id}"
    add_timeline(session, student.id, actor, "enrollment.registered",
                 f"Заведена анкета и заявка на приём в {school_class.name} ({actor.full_name})")
    notify_users(session, await users_with_roles(session, UserRole.DIRECTOR),
                 "Поступил новый ученик", f"{who}. Завёл(а): {actor.full_name}", link)
    notify_users(session, await users_with_roles(session, UserRole.PARENT_RELATIONS, UserRole.ADMISSIONS),
                 "Новая заявка на приём", who, link, exclude=actor)
    notify_users(session, await users_with_roles(session, UserRole.CASHIER),
                 "Оформить оплату нового ученика", f"{who}: укажите лицевой счёт 1С и договор", "/enrollment")
    if teacher:
        notify_users(session, [teacher], f"В ваш класс поступил ученик", f"{who}: примите в класс и отметьте, живёт ли в пансионате", "/enrollment")
    else:
        notify_users(session, await users_with_roles(session, UserRole.ZAVUCH),
                     "Нет классного руководителя", f"{who}: примите ученика в класс вместо классного руководителя", "/enrollment")
    notify_users(session, await users_with_roles(session, UserRole.SUPER_ADMIN),
                 "Зарегистрировать лицо в HikCentral", f"{who}: добавьте человека и лицо/ладонь в HikCentral", "/enrollment")
    enqueue_event(session, DomainEvent(type="enrollment.changed", payload={"enrollment_id": enrollment.id}))
    return enrollment


# ---------------------------------------------------------------- Этапы

def is_assignee(step: EnrollmentStep, user: User) -> bool:
    """Этап адресован именно этому сотруднику (а не доступен ему как замена)."""
    if step.assignee_user_id is not None:
        return user.id == step.assignee_user_id
    return user.role is step.assignee_role


def can_complete(step: EnrollmentStep, user: User) -> bool:
    if user.role is UserRole.SUPER_ADMIN:
        return True
    if step.assignee_user_id is not None:
        return user.id == step.assignee_user_id or user.role in (UserRole.ZAVUCH, UserRole.DIRECTOR)
    return user.role is step.assignee_role or (
        step.assignee_role is UserRole.ZAVUCH and user.role is UserRole.DIRECTOR
    )


async def load_enrollment(session: AsyncSession, enrollment_id: int) -> Enrollment | None:
    return (await session.execute(
        select(Enrollment).where(Enrollment.id == enrollment_id)
        .options(selectinload(Enrollment.steps), selectinload(Enrollment.student).selectinload(Student.school_class))
        .execution_options(populate_existing=True)
    )).scalar_one_or_none()


async def complete_step(session: AsyncSession, actor: User, enrollment: Enrollment,
                        kind: EnrollmentStepKind, data: dict[str, Any], comment: str | None) -> EnrollmentStep:
    if enrollment.status is not EnrollmentStatus.IN_PROGRESS:
        raise EnrollmentError("Заявка уже закрыта", 409)
    step = next((s for s in enrollment.steps if s.kind is kind), None)
    if step is None:
        raise EnrollmentError("Этап не найден", 404)
    if step.status is StepStatus.DONE:
        raise EnrollmentError("Этап уже выполнен", 409)
    if not can_complete(step, actor):
        raise EnrollmentError("Этот этап выполняет другой сотрудник", 403)
    student = enrollment.student

    match kind:
        case EnrollmentStepKind.PAYMENT_SETUP:
            account = str(data.get("external_1c_id") or "").strip()
            if not account:
                raise EnrollmentError("Укажите лицевой счёт 1С")
            clash = (await session.execute(select(Student.id).where(
                Student.external_1c_id == account, Student.id != student.id))).first()
            if clash:
                raise EnrollmentError(f"Лицевой счёт {account} уже привязан к другому ученику", 409)
            student.external_1c_id = account
            text = f"Оплата оформлена: лицевой счёт {account}" + (
                f", договор {data['contract_number']}" if data.get("contract_number") else "")
        case EnrollmentStepKind.CLASS_ACCEPTANCE:
            if not isinstance(data.get("is_boarder"), bool):
                raise EnrollmentError("Отметьте, живёт ли ученик в пансионате")
            student.is_boarder = data["is_boarder"]
            student.boarding_room = (data.get("boarding_room") or None) if student.is_boarder else None
            text = "Принят в класс; " + (
                f"живёт в пансионате (комната {student.boarding_room or '—'})" if student.is_boarder else "не в пансионате")
        case EnrollmentStepKind.ACCESS_SETUP:
            if data.get("hik_person_id"):
                student.hik_person_id = str(data["hik_person_id"])
            text = "Доступ настроен: лицо зарегистрировано в HikCentral"
        case _:
            raise EnrollmentError("Этап нельзя выполнить вручную", 400)

    step.status = StepStatus.DONE
    step.completed_by_id = actor.id
    step.completed_at = utcnow()
    step.data = data or None
    step.comment = comment
    add_timeline(session, student.id, actor, f"enrollment.{kind.value.lower()}",
                 f"{text} ({actor.full_name})" + (f". Комментарий: {comment}" if comment else ""))
    await session.flush()
    await _maybe_complete(session, enrollment, actor)
    enqueue_event(session, DomainEvent(type="enrollment.changed", payload={"enrollment_id": enrollment.id}))
    return step


async def _maybe_complete(session: AsyncSession, enrollment: Enrollment, actor: User | None) -> None:
    if any(s.status is not StepStatus.DONE for s in enrollment.steps):
        return
    student = enrollment.student
    enrollment.status = EnrollmentStatus.COMPLETED
    enrollment.completed_at = utcnow()
    student.status = StudentStatus.ACTIVE
    if student.admission_date is None:
        student.admission_date = utcnow().astimezone(ZoneInfo(settings.school_timezone)).date()
    if student.is_boarder:  # пансионер уже живёт в здании
        await presence.set_status(session, student.id, LocationStatus.IN_BOARDING, note="В пансионате", source="enrollment")
    else:
        await presence.get_or_create_state(session, student.id)
    add_timeline(session, student.id, actor, "enrollment.completed", "Приём завершён: ученик зачислен (статус «Учится»)")

    school_class = student.school_class
    recipients = await users_with_roles(session, UserRole.DIRECTOR, UserRole.PARENT_RELATIONS)
    if enrollment.created_by_id and (creator := await session.get(User, enrollment.created_by_id)):
        recipients.append(creator)
    if teacher := await _class_teacher(session, school_class):
        recipients.append(teacher)
    notify_users(session, recipients, "Ученик зачислен",
                 f"{student.full_name}, {school_class.name} — все этапы приёма пройдены", f"/students/{student.id}")
    outbox.notify_parent(session, student, "payment",
                         f"{student.full_name} зачислен(а) в {school_class.name}. Добро пожаловать в нашу школу!")
    if settings.hik_enabled:
        from app.services.hik import reconcile_student

        await reconcile_student(session, student)


async def on_hik_linked(session: AsyncSession, student: Student) -> None:
    """HikCentral нашёл человека для ученика → этап «Доступ» закрывается автоматически."""
    enrollment = (await session.execute(
        select(Enrollment).where(Enrollment.student_id == student.id, Enrollment.status == EnrollmentStatus.IN_PROGRESS)
    )).scalar_one_or_none()
    if enrollment is None:
        return
    enrollment = await load_enrollment(session, enrollment.id)
    assert enrollment is not None
    step = next(s for s in enrollment.steps if s.kind is EnrollmentStepKind.ACCESS_SETUP)
    if step.status is StepStatus.DONE:
        return
    step.status = StepStatus.DONE
    step.completed_at = utcnow()
    step.data = {"hik_person_id": student.hik_person_id, "auto": True}
    add_timeline(session, student.id, None, "enrollment.access_setup",
                 f"Доступ настроен автоматически: найден в HikCentral (personId {student.hik_person_id})")
    await session.flush()
    await _maybe_complete(session, enrollment, None)
    enqueue_event(session, DomainEvent(type="enrollment.changed", payload={"enrollment_id": enrollment.id}))
