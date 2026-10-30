"""
Authentication routes:
- POST /auth/signup
- POST /auth/login
- POST /auth/logout
- GET  /auth/me
- PATCH /auth/settings
- DELETE /auth/delete-account (hard delete)
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import SESSION_COOKIE_NAME, create_access_token, get_current_user
from ..crypto import hash_password, verify_password
from ..database import get_db
from ..models.user import User
from ..repositories.user import UserRepository

router = APIRouter(prefix="/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128, description="Password must be at least 8 characters.")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SettingsUpdateRequest(BaseModel):
    local_only_mode: bool | None = None
    allow_sharing: bool | None = None
    preferred_style_preset: str | None = None


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    settings: dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    user: UserResponse
    access_token: str
    token_type: str = "bearer"


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    req: SignupRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    """Registers a new user account, enforces unique email and secure hashing."""
    repo = UserRepository(db)
    existing_user = await repo.get_by_email(req.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    pwd_hash = hash_password(req.password)
    user = await repo.create_user(email=req.email, password_hash=pwd_hash)

    token = create_access_token(user_id=user.id, email=user.email)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # Can be true in production with HTTPS
    )

    return AuthResponse(
        user=UserResponse(
            id=user.id,
            email=user.email,
            settings=user.settings,
            created_at=user.created_at,
        ),
        access_token=token,
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    req: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    """Logs in an existing user with constant-time password verification."""
    repo = UserRepository(db)
    user = await repo.get_by_email(req.email)
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token(user_id=user.id, email=user.email)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
    )

    return AuthResponse(
        user=UserResponse(
            id=user.id,
            email=user.email,
            settings=user.settings,
            created_at=user.created_at,
        ),
        access_token=token,
    )


@router.post("/logout")
async def logout(response: Response) -> dict[str, str]:
    """Clears the session cookie."""
    response.delete_cookie(key=SESSION_COOKIE_NAME)
    return {"message": "Logged out successfully."}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    """Returns the authenticated user profile and privacy settings."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        settings=current_user.settings,
        created_at=current_user.created_at,
    )


@router.patch("/settings", response_model=UserResponse)
async def update_settings(
    req: SettingsUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Updates user privacy settings (e.g. local_only_mode, allow_sharing)."""
    repo = UserRepository(db)
    updates = req.model_dump(exclude_unset=True)
    updated_user = await repo.update_settings(current_user.id, updates)
    if not updated_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    return UserResponse(
        id=updated_user.id,
        email=updated_user.email,
        settings=updated_user.settings,
        created_at=updated_user.created_at,
    )


@router.delete("/delete-account", status_code=status.HTTP_200_OK)
async def delete_account(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """
    Hard-deletes the user and ALL associated dream data, graph entities,
    render jobs, and history. Clears session cookies.
    """
    repo = UserRepository(db)
    success = await repo.hard_delete_user_and_all_data(current_user.id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    response.delete_cookie(key=SESSION_COOKIE_NAME)
    return {"message": "Account and all associated personal dream data have been permanently erased."}

