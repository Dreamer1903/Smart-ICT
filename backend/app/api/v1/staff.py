"""Сотрудники: загрузка из Excel, список, роли, почта (для входа через Google), сброс пароля, отключение."""

import asyncio
import json
import secrets
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select

from app.api.deps import DbSession, require_roles
from app.core.security import hash_password
from app.models import User, UserRole
from app.services import staff_import as svc

router = APIRouter(prefix="/staff", tags=["staff"])
R = UserRole
Admin = Annotated[User, Depends(require_roles(R.DIRECTOR))]  # + SuperAdmin автоматически
ASSIGNABLE = [r for r in UserRole if r not in (R.STUDENT, R.PARENT)]


def _out(u: User) -> dict[str, Any]:
    return {"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role, "is_active": u.is_active,
            "phone": u.phone, "telegram_chat_id": u.telegram_chat_id, "department": u.department,
            "hik_person_id": u.hik_person_id, "google_linked": bool(u.google_sub)}


@router.get("")
async def list_staff(db: DbSession, _: Admin, q: str | None = None, role: UserRole | None = None) -> list[dict[str, Any]]:
    stmt = select(User).where(User.role.not_in([R.STUDENT, R.PARENT])).order_by(User.full_name)
    if role:
        stmt = stmt.where(User.role == role)
    rows = [_out(u) for u in (await db.execute(stmt)).scalars()]
    if q:
        ql = q.lower()
        rows = [r for r in rows if ql in r["full_name"].lower() or ql in r["email"].lower() or ql in (r["department"] or "").lower()]
    return rows


@router.post("/import")
async def import_staff(
    db: DbSession,
    _: Admin,
    file: Annotated[UploadFile, File()],
    domain: Annotated[str, Form()] = "school.uz",
    mapping: Annotated[str | None, Form(description='JSON {"Учителя": "Teacher", "Столовая персонал": "SKIP"}')] = None,
    dry_run: Annotated[bool, Query()] = True,
) -> dict[str, Any]:
    """Загрузить сотрудников. dry_run=true — предпросмотр. Ответ при загрузке содержит временные пароли новых
    учётных записей — их показывают один раз, для раздачи сотрудникам."""
    try:
        m = json.loads(mapping) if mapping else None
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="mapping — не JSON") from None
    data = await file.read(10 * 1024 * 1024 + 1)
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, detail="Файл больше 10 МБ")
    try:
        rep = await svc.import_staff(db, data, domain=domain, mapping=m, dry_run=dry_run)
    except svc.StaffImportError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e)) from None
    if dry_run:
        await db.rollback()
    else:
        await db.commit()
    return {**rep.__dict__, "accounts": [a.__dict__ for a in rep.accounts], "roles": [r.value for r in ASSIGNABLE]}


class StaffIn(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=255)
    role: UserRole
    phone: str | None = None
    department: str | None = None


class StaffPatch(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    role: UserRole | None = None
    phone: str | None = None
    telegram_chat_id: str | None = None
    department: str | None = None
    is_active: bool | None = None


def _check_role(actor: User, role: UserRole | None) -> None:
    if role in (R.STUDENT, R.PARENT):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Ученики и родители заводятся отдельно")
    if role is R.SUPER_ADMIN and actor.role is not R.SUPER_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Роль администратора системы может назначить только администратор")


async def _email_free(db: DbSession, email: str, user_id: int | None = None) -> None:
    other = (await db.execute(select(User.id).where(User.email == email.lower()))).scalar_one_or_none()
    if other is not None and other != user_id:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=f"Почта {email} уже занята")


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_staff(body: StaffIn, db: DbSession, actor: Admin) -> dict[str, Any]:
    _check_role(actor, body.role)
    await _email_free(db, body.email)
    password = secrets.token_urlsafe(6)
    u = User(email=body.email.lower(), full_name=body.full_name, role=body.role, phone=body.phone,
             department=body.department, is_active=True, hashed_password=await asyncio.to_thread(hash_password, password))
    db.add(u)
    await db.commit()
    return {**_out(u), "temporary_password": password}


@router.patch("/{user_id}")
async def update_staff(user_id: int, body: StaffPatch, db: DbSession, actor: Admin) -> dict[str, Any]:
    u = await db.get(User, user_id)
    if u is None or u.role in (R.STUDENT, R.PARENT):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Сотрудник не найден")
    changes = body.model_dump(exclude_unset=True)
    if u.role is R.SUPER_ADMIN and actor.role is not R.SUPER_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Учётную запись администратора системы меняет только администратор")
    if u.id == actor.id and (changes.get("is_active") is False or ("role" in changes and changes["role"] != actor.role)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Нельзя отключить себя или сменить себе роль")
    if "role" in changes:
        _check_role(actor, changes["role"])
    if changes.get("email"):
        changes["email"] = changes["email"].lower()
        await _email_free(db, changes["email"], u.id)
        if changes["email"] != u.email:
            u.google_sub = None  # новая почта — Google-аккаунт привяжется заново при входе
    for k, v in changes.items():
        setattr(u, k, v)
    await db.commit()
    return _out(u)


@router.post("/{user_id}/reset-password")
async def reset_password(user_id: int, db: DbSession, actor: Admin) -> dict[str, str]:
    u = await db.get(User, user_id)
    if u is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Сотрудник не найден")
    if u.role is R.SUPER_ADMIN and actor.role is not R.SUPER_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Пароль администратора системы меняет только администратор")
    password = secrets.token_urlsafe(6)
    u.hashed_password = await asyncio.to_thread(hash_password, password)
    await db.commit()
    return {"email": u.email, "temporary_password": password}
