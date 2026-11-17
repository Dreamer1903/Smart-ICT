"""Дежурства: посты и смены (QR), график, «мои дежурства», отметка по QR, отчёт."""

import datetime as dt
from collections import defaultdict
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import STAFF_ALL, DbSession, require_roles
from app.core.events import commit_and_dispatch
from app.models import DutyAssignment, DutyPost, DutyShift, DutyStatus, User, UserRole
from app.models.duty import new_qr_token
from app.services import duty as svc
from app.services.enrollment import notify_users
from app.services.timetable import DAY_NAMES

router = APIRouter(prefix="/duty", tags=["duty"])
Manager = Annotated[User, Depends(require_roles(*svc.DUTY_MANAGERS))]
Staff = Annotated[User, Depends(require_roles(*STAFF_ALL))]


def _http(e: svc.DutyError) -> HTTPException:
    return HTTPException(e.status_code, detail=str(e))


# ---------------------------------------------------------------- Посты и смены

class ShiftIn(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    start_time: dt.time
    end_time: dt.time
    required: int = Field(default=1, ge=1, le=10)


class PostIn(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    location: str | None = None
    shifts: list[ShiftIn] = Field(default_factory=list)


class PostPatch(BaseModel):
    name: str | None = None
    location: str | None = None
    is_active: bool | None = None


def _post_out(p: DutyPost, with_token: bool) -> dict[str, Any]:
    return {"id": p.id, "name": p.name, "location": p.location, "is_active": p.is_active,
            "qr_token": p.qr_token if with_token else None,
            "shifts": [{"id": s.id, "name": s.name, "start_time": s.start_time.strftime("%H:%M"),
                        "end_time": s.end_time.strftime("%H:%M"), "required": s.required} for s in p.shifts]}


async def _post(db: DbSession, post_id: int) -> DutyPost:
    p = (await db.execute(select(DutyPost).options(selectinload(DutyPost.shifts)).where(DutyPost.id == post_id)
                          .execution_options(populate_existing=True))).scalar_one_or_none()
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Пост не найден")
    return p


def _check_shift(s: ShiftIn) -> None:
    if s.end_time <= s.start_time:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Смена «{s.name}»: конец должен быть позже начала")


@router.get("/posts")
async def list_posts(db: DbSession, user: Staff) -> list[dict[str, Any]]:
    manager = user.role in (*svc.DUTY_MANAGERS, UserRole.SUPER_ADMIN)
    posts = (await db.execute(select(DutyPost).options(selectinload(DutyPost.shifts)).order_by(DutyPost.id))).scalars()
    return [_post_out(p, with_token=manager) for p in posts]


@router.post("/posts", status_code=status.HTTP_201_CREATED)
async def create_post(body: PostIn, db: DbSession, _: Manager) -> dict[str, Any]:
    for s in body.shifts:
        _check_shift(s)
    p = DutyPost(name=body.name, location=body.location, shifts=[DutyShift(**s.model_dump()) for s in body.shifts])
    db.add(p)
    await db.commit()
    return _post_out(await _post(db, p.id), True)


@router.patch("/posts/{post_id}")
async def update_post(post_id: int, body: PostPatch, db: DbSession, _: Manager) -> dict[str, Any]:
    p = await _post(db, post_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    await db.commit()
    return _post_out(await _post(db, post_id), True)


@router.post("/posts/{post_id}/rotate-qr")
async def rotate_qr(post_id: int, db: DbSession, _: Manager) -> dict[str, Any]:
    """Новый QR-код (старый перестаёт работать) — если код сфотографировали и отмечаются не на посту."""
    p = await _post(db, post_id)
    p.qr_token = new_qr_token()
    await db.commit()
    return _post_out(await _post(db, post_id), True)


@router.post("/posts/{post_id}/shifts", status_code=status.HTTP_201_CREATED)
async def add_shift(post_id: int, body: ShiftIn, db: DbSession, _: Manager) -> dict[str, Any]:
    _check_shift(body)
    await _post(db, post_id)
    db.add(DutyShift(post_id=post_id, **body.model_dump()))
    await db.commit()
    return _post_out(await _post(db, post_id), True)


@router.delete("/shifts/{shift_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shift(shift_id: int, db: DbSession, _: Manager) -> None:
    s = await db.get(DutyShift, shift_id)
    if s:
        await db.delete(s)
        await db.commit()


# ---------------------------------------------------------------- График

class GenerateIn(BaseModel):
    date_from: dt.date
    date_to: dt.date
    replace: bool = True
    notify: bool = True  # сообщить учителям, что график составлен


class AssignmentPatch(BaseModel):
    teacher_id: int


def _a_out(a: DutyAssignment, lessons: dict[tuple[int, int], list[int]] | None = None) -> dict[str, Any]:
    sh = a.shift
    return {"id": a.id, "date": a.date, "weekday": DAY_NAMES.get(a.date.isoweekday(), ""),
            "post_id": sh.post_id, "post_name": sh.post.name, "shift_id": sh.id, "shift_name": sh.name,
            "start_time": sh.start_time.strftime("%H:%M"), "end_time": sh.end_time.strftime("%H:%M"),
            "teacher_id": a.teacher_id, "teacher_name": a.teacher.full_name, "status": a.status,
            "checked_in_at": a.checked_in_at, "late_minutes": a.late_minutes, "manual": a.manual,
            "lessons_that_day": len(lessons.get((a.teacher_id, a.date.isoweekday()), [])) if lessons is not None else None}


def _a_query():  # noqa: ANN202
    return select(DutyAssignment).join(DutyShift).options(
        selectinload(DutyAssignment.shift).selectinload(DutyShift.post), selectinload(DutyAssignment.teacher))


@router.post("/generate")
async def generate(body: GenerateIn, db: DbSession, user: Manager) -> dict[str, Any]:
    """Составить график: дежурят те, у кого в этот день мало уроков и нет урока во время смены."""
    try:
        rep = await svc.generate(db, body.date_from, body.date_to, body.replace)
    except svc.DutyError as e:
        raise _http(e) from None
    if body.notify:
        rows = (await db.execute(_a_query().where(DutyAssignment.date >= body.date_from,
                                                  DutyAssignment.date <= body.date_to))).scalars()
        per: dict[int, list[DutyAssignment]] = defaultdict(list)
        for a in rows:
            per[a.teacher_id].append(a)
        for items in per.values():
            lines = "\n".join(f"• {DAY_NAMES.get(a.date.isoweekday())} {svc.describe(a)}"
                              for a in sorted(items, key=lambda x: (x.date, x.shift.start_time)))
            notify_users(db, [items[0].teacher], f"Ваши дежурства {body.date_from:%d.%m}–{body.date_to:%d.%m}", lines, "/duty", exclude=user)
    await commit_and_dispatch(db)
    return rep.__dict__


@router.get("/roster")
async def roster(db: DbSession, _: Staff, date_from: dt.date, date_to: dt.date) -> list[dict[str, Any]]:
    lessons = await svc._teacher_lessons(db)
    rows = (await db.execute(_a_query().where(DutyAssignment.date >= date_from, DutyAssignment.date <= date_to)
                             .order_by(DutyAssignment.date, DutyShift.start_time))).scalars()
    return [_a_out(a, lessons) for a in rows]


@router.patch("/assignments/{assignment_id}")
async def replace_teacher(assignment_id: int, body: AssignmentPatch, db: DbSession, user: Manager) -> dict[str, Any]:
    """Заменить дежурного (ручная замена — перегенерация её не трогает)."""
    a = (await db.execute(_a_query().where(DutyAssignment.id == assignment_id))).scalar_one_or_none()
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Назначение не найдено")
    t = await db.get(User, body.teacher_id)
    if t is None or not t.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Учитель не найден")
    if (await db.execute(select(DutyAssignment.id).where(DutyAssignment.date == a.date, DutyAssignment.teacher_id == t.id,
                                                          DutyAssignment.id != a.id))).first():
        raise HTTPException(status.HTTP_409_CONFLICT, detail=f"{t.full_name} уже дежурит в этот день")
    old = a.teacher
    a.teacher_id, a.manual, a.status, a.notified_at, a.reminded_at = t.id, True, DutyStatus.PLANNED, None, None
    await db.flush()
    a = (await db.execute(_a_query().where(DutyAssignment.id == assignment_id).execution_options(populate_existing=True))).scalar_one()
    notify_users(db, [t], "Вам назначено дежурство", f"{svc.describe(a)} (замена: {old.full_name})", "/duty", exclude=user)
    notify_users(db, [old], "Дежурство снято", f"{svc.describe(a)} — дежурит {t.full_name}", "/duty", exclude=user)
    await commit_and_dispatch(db)
    return _a_out(a)


@router.delete("/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assignment(assignment_id: int, db: DbSession, _: Manager) -> None:
    a = await db.get(DutyAssignment, assignment_id)
    if a:
        await db.delete(a)
        await db.commit()


# ---------------------------------------------------------------- Учитель: мои дежурства и отметка по QR

@router.get("/my")
async def my_duties(db: DbSession, user: Staff, days: int = 14) -> list[dict[str, Any]]:
    today = svc.local_now().date()
    rows = (await db.execute(_a_query().where(DutyAssignment.teacher_id == user.id, DutyAssignment.date >= today - dt.timedelta(days=7),
                                              DutyAssignment.date <= today + dt.timedelta(days=days))
                             .order_by(DutyAssignment.date, DutyShift.start_time))).scalars()
    return [_a_out(a) for a in rows]


class CheckinIn(BaseModel):
    token: str


@router.post("/checkin")
async def checkin(body: CheckinIn, db: DbSession, user: Staff) -> dict[str, Any]:
    """Отметка по QR-коду поста: учитель приступил к дежурству."""
    try:
        a = await svc.checkin(db, user, body.token)
    except svc.DutyError as e:
        raise _http(e) from None
    await commit_and_dispatch(db)
    return _a_out(a)


@router.get("/report")
async def report(db: DbSession, _: Annotated[User, Depends(require_roles(*svc.DUTY_MANAGERS))],
                 date_from: dt.date, date_to: dt.date) -> dict[str, Any]:
    """Для директора и завуча: кто дежурил вовремя, опоздал, пропустил."""
    rows = list((await db.execute(_a_query().where(DutyAssignment.date >= date_from, DutyAssignment.date <= date_to))).scalars())
    per: dict[str, dict[str, int]] = defaultdict(lambda: {"assigned": 0, "on_time": 0, "late": 0, "missed": 0, "planned": 0})
    for a in rows:
        r = per[a.teacher.full_name]
        r["assigned"] += 1
        if a.status is DutyStatus.STARTED:
            r["late" if a.late_minutes else "on_time"] += 1
        elif a.status is DutyStatus.MISSED:
            r["missed"] += 1
        else:
            r["planned"] += 1
    totals = {k: sum(r[k] for r in per.values()) for k in ("assigned", "on_time", "late", "missed", "planned")}
    return {"totals": totals, "teachers": [{"teacher": t, **r} for t, r in sorted(per.items())],
            "missed": [_a_out(a) for a in rows if a.status is DutyStatus.MISSED],
            "late": [_a_out(a) for a in rows if a.late_minutes]}
