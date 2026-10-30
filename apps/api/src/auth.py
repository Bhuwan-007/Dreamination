"""
Authentication utilities, token issuance, and dependency injectors.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import Cookie, Depends, HTTPException, Header, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .crypto import hash_password, verify_password
from .database import get_db
from .models.user import User
from .repositories.user import UserRepository

JWT_ALGORITHM = "HS256"
SESSION_COOKIE_NAME = "dream_session"
DEFAULT_EXPIRY_DAYS = 7


def create_access_token(user_id: uuid.UUID | str, email: str, expires_delta: timedelta | None = None) -> str:
    """Creates a signed JWT access token for user sessions."""
    delta = expires_delta or timedelta(days=DEFAULT_EXPIRY_DAYS)
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": now,
        "exp": now + delta,
    }
    return jwt.encode(payload, settings.APP_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decodes and cryptographically verifies a JWT session token."""
    try:
        return jwt.decode(token, settings.APP_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired, please log in again",
        ) from err
    except jwt.InvalidTokenError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        ) from err


async def get_current_user(
    request: Request,
    authorization: str | None = Header(default=None),
    dream_session: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency extracting and verifying the authenticated user from
    either the Authorization Bearer header or the dream_session cookie.
    """
    token: str | None = None

    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
    elif dream_session:
        token = dream_session

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token claims",
        )

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token",
        ) from err

    repo = UserRepository(db)
    user = await repo.get_by_id(user_uuid)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists",
        )

    return user

