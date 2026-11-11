"""
Integration tests for the film render endpoints.
- POST /dreams/{id}/render          (background job)
- GET  /dreams/{id}/render/status
- GET  /dreams/{id}/manifest
"""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.anyio


async def _get_auth_header(client: AsyncClient) -> dict[str, str]:
    email = f"render_user_{uuid.uuid4().hex[:6]}@example.com"
    resp = await client.post("/auth/signup", json={"email": email, "password": "SecurePassword123!"})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _dream_with_story(client: AsyncClient, headers: dict[str, str], text: str) -> str:
    create_resp = await client.post("/dreams", json={"raw_text": text, "mood_on_waking": "wonder"}, headers=headers)
    assert create_resp.status_code == 201
    dream_id = create_resp.json()["id"]
    recon = await client.post(f"/dreams/{dream_id}/reconstruct", json={"mode": "faithful"}, headers=headers)
    assert recon.status_code == 200
    return dream_id


async def test_film_render_flow(client: AsyncClient):
    headers = await _get_auth_header(client)
    dream_id = await _dream_with_story(
        client, headers, "I was standing on a glass shore where the waves were speaking slowly. A clock floated past."
    )

    before = await client.get(f"/dreams/{dream_id}/render/status", headers=headers)
    assert before.status_code == 200
    assert before.json()["status"] == "not_started"
    assert (await client.get(f"/dreams/{dream_id}/manifest", headers=headers)).status_code == 404

    started = await client.post(f"/dreams/{dream_id}/render", headers=headers)
    assert started.status_code == 202

    # The ASGI test transport runs background tasks before returning, so the job is done.
    body = (await client.get(f"/dreams/{dream_id}/render/status", headers=headers)).json()
    assert body["status"] == "completed", body
    assert body["manifest_ready"] is True

    manifest = (await client.get(f"/dreams/{dream_id}/manifest", headers=headers)).json()
    assert manifest["version"] == 2
    assert manifest["stale"] is False
    assert manifest["totalDuration"] > 0
    assert manifest["cast"], "the dreamer must always be cast"
    scene = manifest["scenes"][0]
    assert scene["layers"][0]["url"].startswith("/storage/film/")
    assert scene["ambientUrl"].startswith("/storage/ambient/")
    assert all(c["figureUrl"].startswith("/storage/film/") for c in manifest["cast"])

    # Assets referenced by the manifest are actually served.
    assert (await client.get(scene["layers"][0]["url"])).status_code == 200


async def test_render_requires_a_story(client: AsyncClient):
    headers = await _get_auth_header(client)
    create_resp = await client.post("/dreams", json={"raw_text": "Only a colour, blue."}, headers=headers)
    dream_id = create_resp.json()["id"]
    resp = await client.post(f"/dreams/{dream_id}/render", headers=headers)
    assert resp.status_code == 400


async def test_render_endpoints_reject_other_users(client: AsyncClient):
    owner = await _get_auth_header(client)
    intruder = await _get_auth_header(client)
    dream_id = await _dream_with_story(client, owner, "A lighthouse that only shone inward.")

    for method, path in (
        ("post", f"/dreams/{dream_id}/render"),
        ("get", f"/dreams/{dream_id}/render/status"),
        ("get", f"/dreams/{dream_id}/manifest"),
    ):
        resp = await getattr(client, method)(path, headers=intruder)
        assert resp.status_code == 404, path


async def test_raw_dream_audio_is_not_publicly_served(client: AsyncClient):
    from apps.worker.src.tasks.storage_paths import storage_dir

    probe = storage_dir("audio") / f"probe_{uuid.uuid4().hex}.webm"
    probe.write_bytes(b"private dream voice")
    try:
        assert (await client.get(f"/storage/audio/{probe.name}")).status_code == 404
    finally:
        probe.unlink(missing_ok=True)

    manifests = storage_dir("manifests") / "x"
    manifests.mkdir(parents=True, exist_ok=True)
    (manifests / "film_manifest.json").write_text("{}")
    assert (await client.get("/storage/manifests/x/film_manifest.json")).status_code == 404

    # Rendered, content-hashed assets remain reachable for the player.
    asset = storage_dir("tts") / f"probe_{uuid.uuid4().hex}.wav"
    asset.write_bytes(b"RIFF")
    try:
        assert (await client.get(f"/storage/tts/{asset.name}")).status_code == 200
    finally:
        asset.unlink(missing_ok=True)
