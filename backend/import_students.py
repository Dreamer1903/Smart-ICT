"""Загрузка настоящих учеников из Excel (выгрузка HikCentral).

    python import_students.py ФАЙЛ.xlsx            # только показать, что будет (ничего не меняет)
    python import_students.py ФАЙЛ.xlsx --apply    # загрузить
    python import_students.py ФАЙЛ.xlsx --apply --fresh
        # начать с ЧИСТОЙ базы (демо-данные удаляются): создаются таблицы,
        # учётные записи администратора и директора со случайными паролями
"""

import argparse
import asyncio
import secrets
from pathlib import Path

from sqlalchemy import func, select

import app.models  # noqa: F401
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import User, UserRole
from app.services.importer import ImportError_, import_students


async def main(path: Path, apply: bool, fresh: bool) -> None:
    async with engine.begin() as conn:
        if fresh:
            await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as session:
        accounts = []
        if fresh and apply and not await session.scalar(select(func.count(User.id))):
            for email, name, role in (("admin@school.uz", "Администратор", UserRole.SUPER_ADMIN),
                                      ("director@school.uz", "Директор", UserRole.DIRECTOR)):
                password = secrets.token_urlsafe(9)
                session.add(User(email=email, full_name=name, role=role, is_active=True,
                                 hashed_password=hash_password(password)))
                accounts.append((email, password))
            await session.flush()
        try:
            r = await import_students(session, path.read_bytes(), None, dry_run=not apply)
        except ImportError_ as e:
            raise SystemExit(f"Ошибка: {e}") from None
        if apply:
            await session.commit()

    await engine.dispose()
    print(f"Лист «{r.sheet}»: {r.rows} учеников в файле")
    print(f"  новых: {r.created}, изменится: {r.updated} (из них сменили класс: {r.moved}), без изменений: {r.unchanged}")
    print(f"  новых классов: {len(r.classes_created)} {', '.join(r.classes_created)}")
    if r.not_in_file:
        print(f"  в базе, но нет в файле: {r.not_in_file} (не удаляются)")
    for w in r.warnings:
        print(f"  ! {w}")
    print("ЗАГРУЖЕНО." if apply else "Это предпросмотр. Чтобы загрузить, добавьте --apply")
    for email, password in accounts:
        print(f"  Вход: {email}  пароль: {password}   ← запишите, больше не покажется")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("file", type=Path)
    p.add_argument("--apply", action="store_true", help="загрузить (без него — только предпросмотр)")
    p.add_argument("--fresh", action="store_true", help="удалить демо-данные и начать с чистой базы")
    a = p.parse_args()
    asyncio.run(main(a.file, a.apply, a.fresh))
