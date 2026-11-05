from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.core.security import create_access_token, verify_password
from app.models import User
from app.schemas.auth import LoginRequest, Token, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


async def _authenticate(db: DbSession, email: str, password: str) -> Token:
    user = (await db.execute(select(User).where(User.email == email.lower()))).scalar_one_or_none()
    if user is None or not verify_password(password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Неверный email или пароль")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Учётная запись отключена")
    token = create_access_token(user.id, user.role.value)
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=Token, summary="Вход по email/паролю (JSON)")
async def login(body: LoginRequest, db: DbSession) -> Token:
    return await _authenticate(db, body.email, body.password)


@router.post("/token", response_model=Token, summary="OAuth2 password flow (для Swagger UI)")
async def token(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: DbSession) -> Token:
    return await _authenticate(db, form.username, form.password)


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> User:
    return user
