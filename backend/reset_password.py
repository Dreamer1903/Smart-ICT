"""Задать пароль сотруднику (или создать учётную запись, если её нет).

    python reset_password.py director@school.uz НовыйПароль
    python reset_password.py admin@school.uz НовыйПароль
    python reset_password.py ivanova@school.uz НовыйПароль --role Teacher --name "Иванова Анна"
"""

import argparse
import asyncio

from sqlalchemy import select

import app.models  # noqa: F401
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import User, UserRole

ROLES = {r.value: r for r in UserRole}


async def main(email: str, password: str, role: str | None, name: str | None) -> None:
    if len(password) < 6:
        raise SystemExit("Пароль слишком короткий: нужно минимум 6 символов")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as session:
        user = (await session.execute(select(User).where(User.email == email.lower()))).scalar_one_or_none()
        if user is None:
            if role is None:
                raise SystemExit(f"Нет пользователя {email}. Чтобы создать, добавьте --role (например --role Director)")
            user = User(email=email.lower(), full_name=name or email, role=ROLES[role], is_active=True,
                        hashed_password=hash_password(password))
            session.add(user)
            action = "создан"
        else:
            user.hashed_password = hash_password(password)
            user.is_active = True
            action = "пароль изменён"
        await session.commit()
        print(f"Готово: {user.email} ({user.role.value}) — {action}. Входите с новым паролем.")
    await engine.dispose()


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("email")
    p.add_argument("password")
    p.add_argument("--role", choices=sorted(ROLES), help="роль для новой учётной записи")
    p.add_argument("--name", help="ФИО для новой учётной записи")
    a = p.parse_args()
    asyncio.run(main(a.email, a.password, a.role, a.name))
