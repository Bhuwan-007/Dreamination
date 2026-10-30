"""
Integration tests for Dream Capture, Audio Transcription, and Follow-up Questions:
- POST /dreams
- POST /dreams/upload-audio
- GET  /dreams
- GET  /dreams/{id}
- POST /dreams/{id}/followups
- POST /dreams/{id}/answers
"""

import io
import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.anyio


async def _get_auth_header(client: AsyncClient, email_prefix: str = "dreamer") -> dict[str, str]:
    email = f"{email_prefix}_{uuid.uuid4().hex[:6]}@example.com"
    resp = await client.post("/auth/signup", json={"email": email, "password": "SecurePassword123!"})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def test_create_dream_with_text(client: AsyncClient):
    headers = await _get_auth_header(client)

    payload = {
        "raw_text": "I walked through a flooded corridor lined with copper doors.",
        "mood_on_waking": "serene",
        "recent_life_context": "Thinking about moving to a new apartment.",
    }

    response = await client.post("/dreams", json=payload, headers=headers)
    assert response.status_code == 201

    data = response.json()
    assert data["raw_text"] == payload["raw_text"]
    assert data["mood_on_waking"] == "serene"
    assert data["status"] == "captured"
    assert "id" in data


async def test_upload_audio_and_transcribe(client: AsyncClient):
    headers = await _get_auth_header(client)

    # Dummy WebM audio buffer
    dummy_audio = b"RIFF" + b"\x00" * 32000

    files = {"file": ("dream_recording.webm", io.BytesIO(dummy_audio), "audio/webm")}
    response = await client.post("/dreams/upload-audio", files=files, headers=headers)
    assert response.status_code == 200

    data = response.json()
    assert "storage_key" in data
    assert "raw_transcript" in data
    assert "cleaned_transcript" in data
    assert data["duration_seconds"] > 0
    # Confirm raw filler words like "um" / "er" are preserved in raw transcript
    assert "um" in data["raw_transcript"].lower() or "er" in data["raw_transcript"].lower()


async def test_dream_list_and_detail(client: AsyncClient):
    headers_a = await _get_auth_header(client, "alice")
    headers_b = await _get_auth_header(client, "bob")

    # Alice creates a dream
    create_resp = await client.post(
        "/dreams",
        json={"raw_text": "Alice's midnight ocean", "mood_on_waking": "wonder"},
        headers=headers_a,
    )
    dream_id = create_resp.json()["id"]

    # Alice lists dreams - sees her dream
    list_a = await client.get("/dreams", headers=headers_a)
    assert list_a.status_code == 200
    assert len(list_a.json()) == 1
    assert list_a.json()[0]["id"] == dream_id

    # Bob lists dreams - sees 0 dreams
    list_b = await client.get("/dreams", headers=headers_b)
    assert list_b.status_code == 200
    assert len(list_b.json()) == 0

    # Alice can get dream detail
    detail_a = await client.get(f"/dreams/{dream_id}", headers=headers_a)
    assert detail_a.status_code == 200
    assert detail_a.json()["raw_text"] == "Alice's midnight ocean"

    # Bob cannot get Alice's dream detail (returns 404)
    detail_b = await client.get(f"/dreams/{dream_id}", headers=headers_b)
    assert detail_b.status_code == 404


async def test_followup_questions_generation(client: AsyncClient):
    headers = await _get_auth_header(client)

    create_resp = await client.post(
        "/dreams",
        json={"raw_text": "I was standing in front of a giant rusted clock in the middle of a desert."},
        headers=headers,
    )
    dream_id = create_resp.json()["id"]

    # Request follow-up questions
    response = await client.post(f"/dreams/{dream_id}/followups", headers=headers)
    assert response.status_code == 200

    questions = response.json()["questions"]
    assert 0 < len(questions) <= 3
    for q in questions:
        assert "id" in q
        assert "text" in q
        assert q["targets"] in ["emotion", "sensation", "character", "transition", "ending"]


async def test_submit_followup_answers(client: AsyncClient):
    headers = await _get_auth_header(client)

    create_resp = await client.post(
        "/dreams",
        json={
            "raw_text": "A white owl was perched on a floating mirror.",
            "recent_life_context": "Initial notes",
        },
        headers=headers,
    )
    dream_id = create_resp.json()["id"]

    # Submit answers
    answers_payload = {
        "answers": [
            {
                "question_id": "q1",
                "question_text": "What did the air feel like around you?",
                "answer": "Frigid and smelling of crushed pine needles.",
            },
            {
                "question_id": "q2",
                "question_text": "Were you frightened?",
                "answer": "Not scared, mesmerized.",
            },
        ]
    }

    submit_resp = await client.post(f"/dreams/{dream_id}/answers", json=answers_payload, headers=headers)
    assert submit_resp.status_code == 200

    data = submit_resp.json()
    assert "Frigid and smelling of crushed pine needles" in data["recent_life_context"]
    assert "Not scared, mesmerized" in data["recent_life_context"]

