from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select

from pydantic import BaseModel

from app.api.deps import CurrentUser, DbSession
from app.core import google
from app.core.config import settings
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


class GoogleLoginIn(BaseModel):
    credential: str  # ID token от Google Identity Services


@router.get("/config", summary="Настройки входа для страницы логина")
async def auth_config() -> dict[str, object]:
    return {"google_client_id": settings.google_client_id or None,
            "google_allowed_domains": sorted(google._allowed_domains())}


@router.post("/google", response_model=Token, summary="Вход через Google")
async def login_google(body: GoogleLoginIn, db: DbSession) -> Token:
    """Пускаем только тех, кто уже есть в SchoolOS: Google-почта должна совпасть с email учётной записи.
    При первом входе аккаунт Google привязывается к пользователю (google_sub)."""
    try:
        claims = await google.verify(body.credential)
    except google.GoogleAuthError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=str(e)) from None
    sub, email = str(claims["sub"]), str(claims["email"]).lower()
    user = (await db.execute(select(User).where(User.google_sub == sub))).scalar_one_or_none()
    if user is None:
        user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if user is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN,
                                detail=f"Пользователь {email} не найден в SchoolOS. Попросите администратора школы добавить вас.")
        if user.google_sub and user.google_sub != sub:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Эта учётная запись привязана к другому Google-аккаунту")
        user.google_sub = sub
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Учётная запись отключена")
    await db.commit()
    return Token(access_token=create_access_token(user.id, user.role.value), user=UserOut.model_validate(user))
