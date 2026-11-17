"""Приём учеников, карточка ученика, уведомления сотрудникам, отчёт посещаемости."""

from datetime import date, datetime
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import STAFF_ALL, CurrentUser, DbSession, require_roles
from app.core.config import settings
from app.core.events import commit_and_dispatch
from app.db.base import utcnow
from app.models import (
    AccessEvent,
    Enrollment,
    EnrollmentStatus,
    EnrollmentStepKind,
    Guardian,
    LocationStatus,
    NurseVisit,
    PaymentStatusRecord,
    SchoolClass,
    StaffNotification,
    StepStatus,
    Student,
    StudentStatus,
    StudentTimelineEvent,
    User,
    UserRole,
)
from app.schemas.enrollment import (
    AttendanceReportOut,
    AttendanceRowOut,
    AttendanceSummary,
    CardEventOut,
    CardNurseOut,
    CardPaymentOut,
    DayOut,
    EnrollmentOut,
    EnrollmentStudentOut,
    GuardianIn,
    GuardianOut,
    NotificationOut,
    NotificationsOut,
    RegistrationIn,
    StepCompleteIn,
    StepOut,
    StudentCardOut,
    StudentPatch,
    TimelineOut,
)
from app.services import enrollment as svc
from app.services import outbox, presence
from app.services.access import REASON_LABEL
from app.services.reports import daily_attendance, student_history

router = APIRouter(tags=["students"])

R = UserRole
REGISTRARS = (R.ADMISSIONS, R.PARENT_RELATIONS, R.DIRECTOR, R.ZAVUCH)
ENROLLMENT_VIEWERS = (R.DIRECTOR, R.ZAVUCH, R.PARENT_RELATIONS, R.ADMISSIONS, R.CASHIER, R.TEACHER)
FINANCE_VIEW = {R.SUPER_ADMIN, R.DIRECTOR, R.ZAVUCH, R.PARENT_RELATIONS, R.CASHIER}
PROFILE_EDITORS = {R.SUPER_ADMIN, R.DIRECTOR, R.ZAVUCH, R.PARENT_RELATIONS, R.ADMISSIONS}
REPORT_VIEWERS = (R.DIRECTOR, R.ZAVUCH, R.PARENT_RELATIONS, R.TEACHER, R.DUTY_TEACHER)


def _http(e: svc.EnrollmentError) -> HTTPException:
    return HTTPException(e.status_code, detail=str(e))


async def _names(db: DbSession, ids: set[int | None]) -> dict[int, str]:
    ids = {i for i in ids if i}
    if not ids:
        return {}
    return dict((await db.execute(select(User.id, User.full_name).where(User.id.in_(ids)))).all())


async def _enrollment_out(db: DbSession, e: Enrollment, user: User) -> EnrollmentOut:
    names = await _names(db, {e.created_by_id} | {s.assignee_user_id for s in e.steps} | {s.completed_by_id for s in e.steps})
    steps = [
        StepOut(
            kind=s.kind, label=svc.STEP_LABEL[s.kind], status=s.status, assignee_role=s.assignee_role,
            assignee_name=names.get(s.assignee_user_id or 0), completed_by_name=names.get(s.completed_by_id or 0),
            completed_at=s.completed_at, comment=s.comment, data=s.data,
            can_complete=(e.status is EnrollmentStatus.IN_PROGRESS and s.status is StepStatus.PENDING
                          and s.kind is not EnrollmentStepKind.REGISTRATION and svc.can_complete(s, user)),
        )
        for s in e.steps
    ]
    st = e.student
    return EnrollmentOut(
        id=e.id, status=e.status, created_at=e.created_at, completed_at=e.completed_at,
        created_by_name=names.get(e.created_by_id or 0),
        student=EnrollmentStudentOut(id=st.id, full_name=st.full_name, class_id=st.class_id,
                                     class_name=st.school_class.name, birth_date=st.birth_date, status=st.status),
        steps=steps, done_steps=sum(1 for s in e.steps if s.status is StepStatus.DONE), total_steps=len(e.steps),
        my_pending=e.status is EnrollmentStatus.IN_PROGRESS and any(
            s.status is StepStatus.PENDING and s.kind is not EnrollmentStepKind.REGISTRATION and svc.is_assignee(s, user)
            for s in e.steps),
    )


# ---------------------------------------------------------------- Приём

@router.get("/enrollments", response_model=list[EnrollmentOut])
async def list_enrollments(
    db: DbSession,
    user: Annotated[User, Depends(require_roles(*ENROLLMENT_VIEWERS))],
    state: Annotated[str, Query(pattern="^(active|completed|cancelled|all)$")] = "active",
    mine: bool = False,
    limit: Annotated[int, Query(le=500)] = 200,
) -> list[EnrollmentOut]:
    stmt = (select(Enrollment).options(selectinload(Enrollment.steps),
                                       selectinload(Enrollment.student).selectinload(Student.school_class))
            .order_by(Enrollment.created_at.desc()).limit(limit))
    status_map = {"active": EnrollmentStatus.IN_PROGRESS, "completed": EnrollmentStatus.COMPLETED,
                  "cancelled": EnrollmentStatus.CANCELLED}
    if state in status_map:
        stmt = stmt.where(Enrollment.status == status_map[state])
    out = [await _enrollment_out(db, e, user) for e in (await db.execute(stmt)).scalars()]
    return [e for e in out if e.my_pending] if mine else out


@router.post("/enrollments", response_model=EnrollmentOut, status_code=status.HTTP_201_CREATED)
async def create_enrollment(body: RegistrationIn, db: DbSession,
                            user: Annotated[User, Depends(require_roles(*REGISTRARS))]) -> EnrollmentOut:
    """Завести нового ученика (анкета + родители). Запускает этапы приёма и уведомления."""
    try:
        e = await svc.register_student(db, user, svc.RegistrationData(
            full_name=body.full_name, class_id=body.class_id, birth_date=body.birth_date,
            admission_date=body.admission_date, notes=body.notes,
            guardians=[svc.GuardianData(**g.model_dump()) for g in body.guardians],
        ))
    except svc.EnrollmentError as err:
        raise _http(err) from None
    await commit_and_dispatch(db)
    outbox.kick()
    return await _enrollment_out(db, await svc.load_enrollment(db, e.id), user)  # type: ignore[arg-type]


@router.post("/enrollments/{enrollment_id}/steps/{kind}/complete", response_model=EnrollmentOut)
async def complete_step(enrollment_id: int, kind: EnrollmentStepKind, body: StepCompleteIn, db: DbSession,
                        user: Annotated[User, Depends(require_roles(*STAFF_ALL))]) -> EnrollmentOut:
    e = await svc.load_enrollment(db, enrollment_id)
    if e is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")
    try:
        await svc.complete_step(db, user, e, kind, body.data, body.comment)
    except svc.EnrollmentError as err:
        raise _http(err) from None
    await commit_and_dispatch(db)
    outbox.kick()
    return await _enrollment_out(db, await svc.load_enrollment(db, enrollment_id), user)  # type: ignore[arg-type]


@router.post("/enrollments/{enrollment_id}/cancel", response_model=EnrollmentOut)
async def cancel_enrollment(enrollment_id: int, db: DbSession,
                            user: Annotated[User, Depends(require_roles(*REGISTRARS))],
                            reason: str = Query(min_length=1)) -> EnrollmentOut:
    e = await svc.load_enrollment(db, enrollment_id)
    if e is None or e.status is not EnrollmentStatus.IN_PROGRESS:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Заявку нельзя отменить")
    e.status = EnrollmentStatus.CANCELLED
    e.student.status = StudentStatus.WITHDRAWN
    svc.add_timeline(db, e.student_id, user, "enrollment.cancelled", f"Приём отменён: {reason} ({user.full_name})")
    svc.notify_users(db, await svc.users_with_roles(db, R.DIRECTOR), "Приём отменён",
                     f"{e.student.full_name}: {reason}", f"/students/{e.student_id}")
    await commit_and_dispatch(db)
    return await _enrollment_out(db, e, user)


# ---------------------------------------------------------------- Карточка ученика

@router.get("/students/{student_id}/card", response_model=StudentCardOut)
async def student_card(student_id: int, db: DbSession, user: Annotated[User, Depends(require_roles(*STAFF_ALL))]) -> StudentCardOut:
    s = (await db.execute(select(Student).where(Student.id == student_id).options(
        selectinload(Student.school_class), selectinload(Student.presence), selectinload(Student.guardians)
    ).execution_options(populate_existing=True))).scalar_one_or_none()  # свежие данные после PATCH
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ученик не найден")
    teacher = await db.get(User, s.school_class.homeroom_teacher_id) if s.school_class.homeroom_teacher_id else None
    # Снимок связанных данных ДО загрузки заявки: она перечитывает объект ученика
    pr, class_name = s.presence, s.school_class.name
    guardians = [GuardianOut(id=g.id, full_name=g.full_name, relation=g.relation, phone=g.phone,
                             telegram_chat_id=g.telegram_chat_id, is_primary=g.is_primary) for g in s.guardians]

    payment = None
    if user.role in FINANCE_VIEW and (p := await db.get(PaymentStatusRecord, s.id)):
        payment = CardPaymentOut(has_debt=p.has_debt, debt_amount=p.debt_amount, currency=p.currency,
                                 paid_until=p.paid_until, checked_at=p.checked_at)

    enr = (await db.execute(select(Enrollment.id).where(Enrollment.student_id == s.id))).scalar_one_or_none()
    enrollment = await _enrollment_out(db, await svc.load_enrollment(db, enr), user) if enr else None  # type: ignore[arg-type]

    events = (await db.execute(select(AccessEvent).options(selectinload(AccessEvent.device))
                               .where(AccessEvent.student_id == s.id)
                               .order_by(AccessEvent.occurred_at.desc()).limit(20))).scalars().all()
    visits = (await db.execute(select(NurseVisit).where(NurseVisit.student_id == s.id)
                               .order_by(NurseVisit.start_time.desc()).limit(10))).scalars().all()
    timeline = (await db.execute(select(StudentTimelineEvent).options(selectinload(StudentTimelineEvent.actor))
                                 .where(StudentTimelineEvent.student_id == s.id)
                                 .order_by(StudentTimelineEvent.at.desc(), StudentTimelineEvent.id.desc()).limit(50))).scalars().all()
    return StudentCardOut(
        id=s.id, full_name=s.full_name, status=s.status, class_id=s.class_id, class_name=class_name,
        homeroom_teacher=teacher.full_name if teacher else None, birth_date=s.birth_date,
        admission_date=s.admission_date, is_boarder=s.is_boarder, boarding_room=s.boarding_room, notes=s.notes,
        external_1c_id=s.external_1c_id if user.role in FINANCE_VIEW else None,
        hik_person_id=s.hik_person_id, rfid_card_id=s.rfid_card_id,
        guardians=guardians,
        presence_status=pr.current_location_status if pr else LocationStatus.UNKNOWN,
        presence_note=pr.note if pr else None, presence_since=pr.last_updated if pr else None,
        is_discrepancy=bool(pr and pr.is_discrepancy), payment=payment, enrollment=enrollment,
        history=[DayOut(**d) for d in await student_history(db, s.id)
                 if s.admission_date is None or d["date"] >= s.admission_date],  # до поступления — не показываем
        recent_events=[CardEventOut(occurred_at=e.occurred_at, direction=e.direction, decision=e.decision.value,
                                    reason_label=REASON_LABEL[e.reason], device_name=e.device.name if e.device else None)
                       for e in events],
        nurse_visits=[CardNurseOut(start_time=v.start_time, end_time=v.end_time, reason=v.reason, outcome=v.outcome.value)
                      for v in visits],
        timeline=[TimelineOut(at=t.at, kind=t.kind, text=t.text, actor_name=t.actor.full_name if t.actor else None)
                  for t in timeline],
    )


@router.patch("/students/{student_id}", response_model=StudentCardOut)
async def update_student(student_id: int, body: StudentPatch, db: DbSession,
                         user: Annotated[User, Depends(require_roles(*STAFF_ALL))]) -> StudentCardOut:
    """Изменить анкету. Классный руководитель может менять только пансионат своего ученика."""
    s = (await db.execute(select(Student).where(Student.id == student_id)
                          .options(selectinload(Student.school_class)))).scalar_one_or_none()
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ученик не найден")
    changes = body.model_dump(exclude_unset=True)
    is_homeroom = s.school_class.homeroom_teacher_id == user.id
    boarding_only = set(changes) <= {"is_boarder", "boarding_room"}
    if user.role not in PROFILE_EDITORS and not (is_homeroom and boarding_only):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Недостаточно прав для изменения анкеты")

    notes: list[str] = []
    if "class_id" in changes and changes["class_id"] != s.class_id:
        new_class = await db.get(SchoolClass, changes["class_id"])
        if new_class is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Класс не найден")
        notes.append(f"Переведён из {s.school_class.name} в {new_class.name}")
        if new_class.homeroom_teacher_id and (t := await db.get(User, new_class.homeroom_teacher_id)):
            svc.notify_users(db, [t], "В ваш класс переведён ученик", f"{s.full_name} → {new_class.name}",
                             f"/students/{s.id}", exclude=user)
    if "is_boarder" in changes and changes["is_boarder"] != s.is_boarder:
        notes.append("Заселён в пансионат" if changes["is_boarder"] else "Выписан из пансионата")
    if changes.get("boarding_room") and changes.get("boarding_room") != s.boarding_room:
        notes.append(f"Комната в пансионате: {changes['boarding_room']}")
    if "full_name" in changes and changes["full_name"] != s.full_name:
        notes.append(f"ФИО изменено: {s.full_name} → {changes['full_name']}")
    was_boarder = s.is_boarder
    for k, v in changes.items():
        setattr(s, k, v)
    if s.is_boarder is False:
        s.boarding_room = None
    if s.status is StudentStatus.ACTIVE and was_boarder != s.is_boarder:
        state = await presence.get_or_create_state(db, s.id)
        if s.is_boarder and state.current_location_status is LocationStatus.UNKNOWN:
            await presence.set_status(db, s.id, LocationStatus.IN_BOARDING, note="В пансионате", source="profile")
        elif not s.is_boarder and state.current_location_status is LocationStatus.IN_BOARDING:
            await presence.set_status(db, s.id, LocationStatus.UNKNOWN, note=None, source="profile")
    for n in notes:
        svc.add_timeline(db, s.id, user, "student.updated", f"{n} ({user.full_name})")
    await commit_and_dispatch(db)
    return await student_card(student_id, db, user)


@router.post("/students/{student_id}/guardians", response_model=GuardianOut, status_code=status.HTTP_201_CREATED)
async def add_guardian(student_id: int, body: GuardianIn, db: DbSession,
                       user: Annotated[User, Depends(require_roles(R.DIRECTOR, R.ZAVUCH, R.PARENT_RELATIONS, R.ADMISSIONS))]) -> GuardianOut:
    s = (await db.execute(select(Student).where(Student.id == student_id)
                          .options(selectinload(Student.guardians)))).scalar_one_or_none()
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ученик не найден")
    if body.is_primary:
        for g in s.guardians:
            g.is_primary = False
    g = Guardian(student_id=s.id, **body.model_dump())
    s.guardians.append(g)
    svc._sync_primary_contact(s)
    svc.add_timeline(db, s.id, user, "student.guardian", f"Добавлен представитель: {g.full_name} ({g.relation or '—'})")
    await db.commit()
    return GuardianOut(id=g.id, **body.model_dump())


# ---------------------------------------------------------------- Уведомления сотрудникам

@router.get("/notifications", response_model=NotificationsOut)
async def my_notifications(db: DbSession, user: CurrentUser, limit: Annotated[int, Query(le=200)] = 50) -> NotificationsOut:
    unread = await db.scalar(select(func.count()).select_from(StaffNotification).where(
        StaffNotification.user_id == user.id, StaffNotification.read_at.is_(None))) or 0
    items = (await db.execute(select(StaffNotification).where(StaffNotification.user_id == user.id)
                              .order_by(StaffNotification.created_at.desc(), StaffNotification.id.desc()).limit(limit))).scalars()
    return NotificationsOut(unread=unread, items=[
        NotificationOut(id=n.id, created_at=n.created_at, title=n.title, body=n.body, link=n.link, read=n.read_at is not None)
        for n in items])


@router.post("/notifications/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def read_notification(notification_id: int, db: DbSession, user: CurrentUser) -> None:
    n = await db.get(StaffNotification, notification_id)
    if n is None or n.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Уведомление не найдено")
    n.read_at = n.read_at or utcnow()
    await db.commit()


@router.post("/notifications/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def read_all(db: DbSession, user: CurrentUser) -> None:
    for n in (await db.execute(select(StaffNotification).where(
            StaffNotification.user_id == user.id, StaffNotification.read_at.is_(None)))).scalars():
        n.read_at = utcnow()
    await db.commit()


# ---------------------------------------------------------------- Отчёт посещаемости

@router.get("/reports/attendance", response_model=AttendanceReportOut, dependencies=[Depends(require_roles(*REPORT_VIEWERS))])
async def attendance_report(db: DbSession, day: Annotated[date | None, Query(alias="date")] = None,
                            class_id: int | None = None) -> AttendanceReportOut:
    """Кто когда пришёл и ушёл за день (по СКУД), опоздания, отказы на турникете."""
    day = day or datetime.now(ZoneInfo(settings.school_timezone)).date()
    rows = await daily_attendance(db, day, class_id)
    return AttendanceReportOut(
        date=day, school_start_time=settings.school_start_time,
        summary=AttendanceSummary(
            total=len(rows), came=sum(r.came for r in rows), late=sum(r.late for r in rows),
            absent=sum(1 for r in rows if not r.came and not r.is_boarder), boarders=sum(r.is_boarder for r in rows),
        ),
        rows=[AttendanceRowOut(**r.__dict__) for r in rows],
    )


# ---------------------------------------------------------------- Импорт из Excel

from fastapi import File, UploadFile  # noqa: E402

from app.services.importer import ImportError_, import_students  # noqa: E402

IMPORTERS = (R.DIRECTOR, R.ZAVUCH, R.PARENT_RELATIONS)
MAX_IMPORT_BYTES = 10 * 1024 * 1024


@router.post("/students/import")
async def import_students_xlsx(
    db: DbSession,
    user: Annotated[User, Depends(require_roles(*IMPORTERS))],
    file: Annotated[UploadFile, File(description="Excel: ID, ФИО (рус.), ФИО (лат.), Класс")],
    dry_run: bool = True,
) -> dict[str, object]:
    """Загрузить учеников из Excel. По умолчанию dry_run=true — только показать, что изменится."""
    data = await file.read(MAX_IMPORT_BYTES + 1)
    if len(data) > MAX_IMPORT_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, detail="Файл больше 10 МБ")
    try:
        report = await import_students(db, data, user, dry_run=dry_run)
    except ImportError_ as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e)) from None
    if dry_run:
        await db.rollback()
    else:
        await commit_and_dispatch(db)
    return report.__dict__
