"""
Integration tests for authentication endpoints:
- POST /auth/signup
- POST /auth/login
- POST /auth/logout
- GET  /auth/me
- PATCH /auth/settings
- DELETE /auth/delete-account
"""

import pytest
from httpx import AsyncClient

from apps.api.src.auth import SESSION_COOKIE_NAME

pytestmark = pytest.mark.anyio


async def test_signup_success(client: AsyncClient):
    payload = {
        "email": "dreamer@example.com",
        "password": "StrongPassword123!",
    }
    response = await client.post("/auth/signup", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "dreamer@example.com"
    assert data["user"]["settings"]["local_only_mode"] is False
    assert data["user"]["settings"]["allow_sharing"] is False

    # Verify session cookie was set
    assert SESSION_COOKIE_NAME in response.cookies


async def test_signup_duplicate_email_fails(client: AsyncClient):
    payload = {
        "email": "duplicate@example.com",
        "password": "Password123!",
    }
    resp1 = await client.post("/auth/signup", json=payload)
    assert resp1.status_code == 201

    resp2 = await client.post("/auth/signup", json=payload)
    assert resp2.status_code == 409
    assert "already exists" in resp2.json()["detail"]


async def test_signup_short_password_fails(client: AsyncClient):
    payload = {
        "email": "short@example.com",
        "password": "123",  # Under 8 chars
    }
    response = await client.post("/auth/signup", json=payload)
    assert response.status_code == 422


async def test_login_success(client: AsyncClient):
    # Register user first
    email = "login_test@example.com"
    password = "ValidPassword123!"
    await client.post("/auth/signup", json={"email": email, "password": password})

    # Log in
    response = await client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200

    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == email
    assert SESSION_COOKIE_NAME in response.cookies


async def test_login_invalid_password_fails(client: AsyncClient):
    email = "wrong_pwd@example.com"
    password = "RealPassword123!"
    await client.post("/auth/signup", json={"email": email, "password": password})

    response = await client.post("/auth/login", json={"email": email, "password": "WrongPassword456!"})
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["detail"]


async def test_get_me_with_bearer_token(client: AsyncClient):
    signup_resp = await client.post(
        "/auth/signup",
        json={"email": "me_test@example.com", "password": "Password123!"},
    )
    token = signup_resp.json()["access_token"]

    # Call /auth/me with Bearer token header
    me_resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "me_test@example.com"


async def test_get_me_unauthorized(client: AsyncClient):
    response = await client.get("/auth/me")
    assert response.status_code == 401


async def test_update_privacy_settings(client: AsyncClient):
    signup_resp = await client.post(
        "/auth/signup",
        json={"email": "privacy_user@example.com", "password": "Password123!"},
    )
    token = signup_resp.json()["access_token"]

    # Patch privacy settings
    patch_resp = await client.patch(
        "/auth/settings",
        headers={"Authorization": f"Bearer {token}"},
        json={"local_only_mode": True, "allow_sharing": True},
    )
    assert patch_resp.status_code == 200
    data = patch_resp.json()
    assert data["settings"]["local_only_mode"] is True
    assert data["settings"]["allow_sharing"] is True


async def test_logout(client: AsyncClient):
    response = await client.post("/auth/logout")
    assert response.status_code == 200
    assert response.json()["message"] == "Logged out successfully."


async def test_delete_account_and_all_data(client: AsyncClient):
    signup_resp = await client.post(
        "/auth/signup",
        json={"email": "erase_me@example.com", "password": "Password123!"},
    )
    token = signup_resp.json()["access_token"]

    # Request hard-delete
    del_resp = await client.delete(
        "/auth/delete-account",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_resp.status_code == 200
    assert "permanently erased" in del_resp.json()["message"]

    # Token should now fail since account is gone
    me_resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 401

