"""
Unit tests for cryptographic engine:
- AES-256-GCM encryption/decryption roundtrips
- User key isolation (cross-user decryption fails)
- AAD ownership verification
- Ciphertext and tag tamper detection
- Password hashing and verification
"""

import uuid
import pytest

from apps.api.src.crypto import (
    DecryptionFailedError,
    decrypt_field,
    derive_user_key,
    encrypt_field,
    hash_password,
    verify_password,
)


def test_encryption_roundtrip():
    user_id = uuid.uuid4()
    original_text = (
        "I was standing on a floating obsidian staircase under two moons. "
        "A clock with melting brass hands whispered: 'Do not wake before seven.' 🌙⏳"
    )

    ciphertext = encrypt_field(original_text, user_id)
    assert ciphertext is not None
    assert isinstance(ciphertext, bytes)
    assert ciphertext != original_text.encode("utf-8")

    decrypted = decrypt_field(ciphertext, user_id)
    assert decrypted == original_text


def test_encryption_handles_empty_and_none():
    user_id = uuid.uuid4()
    assert encrypt_field(None, user_id) is None
    assert decrypt_field(None, user_id) is None

    # Empty string should encrypt and decrypt cleanly
    empty_ct = encrypt_field("", user_id)
    assert empty_ct is not None
    assert decrypt_field(empty_ct, user_id) == ""


def test_user_key_isolation_cross_user_fails():
    user_a = uuid.uuid4()
    user_b = uuid.uuid4()
    text = "Secret dream memory in an ancient submerged library."

    ciphertext_a = encrypt_field(text, user_a)
    assert ciphertext_a is not None

    # User B attempting to decrypt User A's ciphertext must strictly fail
    with pytest.raises(DecryptionFailedError):
        decrypt_field(ciphertext_a, user_b)


def test_ciphertext_tamper_detection():
    user_id = uuid.uuid4()
    text = "A labyrinth where every hallway mirrors a childhood regret."
    ciphertext = bytearray(encrypt_field(text, user_id))

    # Flip a single bit in the ciphertext / tag region
    ciphertext[-5] ^= 0x01

    with pytest.raises(DecryptionFailedError):
        decrypt_field(bytes(ciphertext), user_id)


def test_nonce_tamper_detection():
    user_id = uuid.uuid4()
    text = "A white wolf guided me across a lake made of mercury."
    ciphertext = bytearray(encrypt_field(text, user_id))

    # Flip a bit in the nonce (first 12 bytes)
    ciphertext[3] ^= 0xFF

    with pytest.raises(DecryptionFailedError):
        decrypt_field(bytes(ciphertext), user_id)


def test_malformed_truncated_ciphertext():
    user_id = uuid.uuid4()
    with pytest.raises(DecryptionFailedError):
        decrypt_field(b"too_short", user_id)


def test_different_master_keys_produce_different_keys():
    user_id = uuid.uuid4()
    key1 = derive_user_key(user_id, master_key=b"master_key_alpha_0123456789abcde")
    key2 = derive_user_key(user_id, master_key=b"master_key_beta__0123456789abcde")
    assert key1 != key2
    assert len(key1) == 32
    assert len(key2) == 32


def test_password_hashing_and_verification():
    raw_pwd = "SuperSecretDreamPassword!123"
    hashed = hash_password(raw_pwd)

    assert hashed != raw_pwd
    assert hashed.startswith("$2b$") or hashed.startswith("$2a$")
    assert verify_password(raw_pwd, hashed) is True
    assert verify_password("WrongPassword!123", hashed) is False
    assert verify_password("", hashed) is False


def test_password_unique_salts():
    raw_pwd = "ConsistentPassword456"
    hash1 = hash_password(raw_pwd)
    hash2 = hash_password(raw_pwd)

    assert hash1 != hash2  # Unique salt per hash
    assert verify_password(raw_pwd, hash1) is True
    assert verify_password(raw_pwd, hash2) is True

