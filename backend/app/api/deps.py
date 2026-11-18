"""Зависимости FastAPI: текущий пользователь из JWT и проверка ролей (RBAC)."""

from collections.abc import Callable, Coroutine
from typing import Annotated, Any

import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_v1_prefix}/auth/token", auto_error=False)

DbSession = Annotated[AsyncSession, Depends(get_db)]

_CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Не удалось проверить учётные данные",
    headers={"WWW-Authenticate": "Bearer"},
)


async def user_from_token(db: AsyncSession, token: str | None) -> User:
    if not token:
        raise _CREDENTIALS_ERROR
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise _CREDENTIALS_ERROR from None
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise _CREDENTIALS_ERROR
    return user


async def get_current_user(db: DbSession, token: Annotated[str | None, Depends(oauth2_scheme)]) -> User:
    return await user_from_token(db, token)


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: UserRole) -> Callable[..., Coroutine[Any, Any, User]]:
    """Фабрика зависимостей: пропускает только указанные роли. SuperAdmin проходит всегда."""
    allowed = set(roles) | {UserRole.SUPER_ADMIN}

    async def checker(user: CurrentUser) -> User:
        if user.role not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Недостаточно прав для этой операции")
        return user

    return checker


# Наборы ролей, переиспользуемые в роутерах
MANAGEMENT = (UserRole.DIRECTOR, UserRole.ZAVUCH)
# Все сотрудники с назначенной ролью (без учеников и родителей — у них только свой дневник;
# без «Staff» — роль ещё не назначена администратором)
STAFF_ALL = tuple(r for r in UserRole if r not in (UserRole.STUDENT, UserRole.PARENT, UserRole.STAFF))
FAMILY = (UserRole.STUDENT, UserRole.PARENT)
GATE_OPERATORS = (UserRole.DIRECTOR, UserRole.ZAVUCH, UserRole.DUTY_TEACHER)


async def gate_auth(
    db: DbSession,
    token: Annotated[str | None, Depends(oauth2_scheme)],
    x_gate_api_key: Annotated[str | None, Header()] = None,
) -> str:
    """Турникет авторизуется ключом X-Gate-Api-Key; симулятор в UI — JWT дежурного/администрации."""
    if x_gate_api_key is not None:
        if x_gate_api_key != settings.gate_api_key:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Неверный ключ турникета")
        return "gate-device"
    user = await user_from_token(db, token)
    if user.role not in set(GATE_OPERATORS) | {UserRole.SUPER_ADMIN}:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Недостаточно прав для симуляции турникета")
    return f"user:{user.id}"
