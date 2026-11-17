"""Библиотека: поурочные планы, планы-конспекты, книги, карточки, презентации.

Видимость: PRIVATE — только автор (черновик), TEACHERS — все сотрудники, ALL — сотрудники, ученики и родители.
Файлы хранятся на диске (LIBRARY_DIR) под случайным именем; скачивание — только через проверку прав.
"""

import uuid
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import FAMILY, STAFF_ALL, CurrentUser, DbSession, require_roles
from app.core.config import settings
from app.db.base import utcnow
from app.models import Material, MaterialKind, User, UserRole, Visibility

router = APIRouter(prefix="/library", tags=["library"])
MODERATORS = {UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.ZAVUCH, UserRole.ZAVUCH_ACADEMIC}
ALLOWED_EXT = {".pdf", ".ppt", ".pptx", ".odp", ".key", ".doc", ".docx", ".odt", ".rtf", ".txt", ".xls", ".xlsx",
               ".ods", ".png", ".jpg", ".jpeg", ".gif", ".zip", ".epub", ".djvu", ".mp4"}
KIND_LABEL = {MaterialKind.LESSON_PLAN: "Поурочный план", MaterialKind.OUTLINE: "План-конспект", MaterialKind.BOOK: "Книга",
              MaterialKind.CARDS: "Карточки", MaterialKind.PRESENTATION: "Презентация", MaterialKind.OTHER: "Другое"}


def _dir() -> Path:
    d = Path(settings.library_dir)
    d.mkdir(parents=True, exist_ok=True)
    return d


def _out(m: Material, user: User) -> dict[str, Any]:
    return {"id": m.id, "title": m.title, "kind": m.kind, "kind_label": KIND_LABEL[m.kind], "subject_id": m.subject_id,
            "subject_name": m.subject.name if m.subject else None, "grade_level": m.grade_level, "description": m.description,
            "file_name": m.file_name, "size_bytes": m.size_bytes, "visibility": m.visibility, "downloads": m.downloads,
            "author_id": m.author_id, "author_name": m.author.full_name if m.author else None,
            "created_at": m.created_at, "published_at": m.published_at,
            "can_edit": m.author_id == user.id or user.role in MODERATORS}


def _visible(user: User):  # noqa: ANN202
    if user.role in MODERATORS:
        return True
    if user.role in FAMILY:
        return Material.visibility == Visibility.ALL
    return or_(Material.author_id == user.id, Material.visibility.in_([Visibility.TEACHERS, Visibility.ALL]))


async def _get(db: DbSession, user: User, material_id: int) -> Material:
    m = (await db.execute(select(Material).options(selectinload(Material.subject), selectinload(Material.author))
                          .where(Material.id == material_id, _visible(user)))).scalar_one_or_none()
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Материал не найден")
    return m


@router.get("/materials")
async def list_materials(db: DbSession, user: CurrentUser, q: str | None = None, kind: MaterialKind | None = None,
                         subject_id: int | None = None, grade_level: int | None = None, mine: bool = False,
                         limit: Annotated[int, Query(le=500)] = 200) -> list[dict[str, Any]]:
    stmt = (select(Material).options(selectinload(Material.subject), selectinload(Material.author))
            .where(_visible(user)).order_by(Material.created_at.desc()).limit(limit))
    if mine:
        stmt = stmt.where(Material.author_id == user.id)
    if kind:
        stmt = stmt.where(Material.kind == kind)
    if subject_id:
        stmt = stmt.where(Material.subject_id == subject_id)
    if grade_level is not None:
        stmt = stmt.where(Material.grade_level == grade_level)
    rows = [_out(m, user) for m in (await db.execute(stmt)).scalars()]
    if q:  # поиск без учёта регистра (в т.ч. кириллица — в Python)
        ql = q.lower()
        rows = [r for r in rows if ql in r["title"].lower() or ql in (r["description"] or "").lower()]
    return rows


@router.post("/materials", status_code=status.HTTP_201_CREATED)
async def upload_material(
    db: DbSession,
    user: Annotated[User, Depends(require_roles(*STAFF_ALL))],
    file: Annotated[UploadFile, File()],
    title: Annotated[str, Form(min_length=1, max_length=255)],
    kind: Annotated[MaterialKind, Form()],
    subject_id: Annotated[int | None, Form()] = None,
    grade_level: Annotated[int | None, Form(ge=0, le=12)] = None,
    description: Annotated[str | None, Form()] = None,
    visibility: Annotated[Visibility, Form()] = Visibility.PRIVATE,
) -> dict[str, Any]:
    name = Path(file.filename or "file").name
    ext = Path(name).suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Тип файла {ext or '(без расширения)'} не поддерживается")
    limit = settings.library_max_mb * 1024 * 1024
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, detail=f"Файл больше {settings.library_max_mb} МБ")
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Пустой файл")
    stored = f"{uuid.uuid4().hex}{ext}"
    (_dir() / stored).write_bytes(data)
    m = Material(title=title, kind=kind, subject_id=subject_id, grade_level=grade_level, description=description,
                 file_name=name, stored_name=stored, content_type=file.content_type, size_bytes=len(data),
                 author_id=user.id, visibility=visibility, published_at=utcnow() if visibility is not Visibility.PRIVATE else None)
    db.add(m)
    await db.commit()
    return _out(await _get(db, user, m.id), user)


class MaterialPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    kind: MaterialKind | None = None
    subject_id: int | None = None
    grade_level: int | None = Field(default=None, ge=0, le=12)
    visibility: Visibility | None = None


@router.patch("/materials/{material_id}")
async def update_material(material_id: int, body: MaterialPatch, db: DbSession, user: CurrentUser) -> dict[str, Any]:
    """Изменить или опубликовать (visibility=TEACHERS / ALL)."""
    m = await _get(db, user, material_id)
    if not (m.author_id == user.id or user.role in MODERATORS):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Изменять материал может только автор")
    changes = body.model_dump(exclude_unset=True)
    if changes.get("visibility") not in (None, Visibility.PRIVATE) and m.published_at is None:
        m.published_at = utcnow()
    for k, v in changes.items():
        setattr(m, k, v)
    await db.commit()
    return _out(await _get(db, user, m.id), user)


@router.delete("/materials/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_material(material_id: int, db: DbSession, user: CurrentUser) -> None:
    m = await _get(db, user, material_id)
    if not (m.author_id == user.id or user.role in MODERATORS):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Удалить материал может только автор")
    (_dir() / m.stored_name).unlink(missing_ok=True)
    await db.delete(m)
    await db.commit()


@router.get("/materials/{material_id}/download")
async def download_material(material_id: int, db: DbSession, user: CurrentUser) -> FileResponse:
    m = await _get(db, user, material_id)
    path = _dir() / m.stored_name
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Файл не найден на сервере")
    m.downloads += 1
    await db.commit()
    return FileResponse(path, filename=m.file_name, media_type=m.content_type or "application/octet-stream")
