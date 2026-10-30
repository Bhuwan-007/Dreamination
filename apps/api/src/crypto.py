"""
Application-layer Field-Level Encryption & Password Hashing.

Enforces:
- AES-256-GCM envelope encryption for sensitive dream text fields.
- Per-user data encryption key (DEK) derived via HKDF-SHA256 from the application master key.
- Associated Authenticated Data (AAD) bound to the owner's user_id to prevent cross-account ciphertext transplant attacks.
- Bcrypt password hashing with constant-time verification.
- Zero dream plaintext ever emitted to logs.
"""

from __future__ import annotations

import os
from uuid import UUID

import bcrypt
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from .config import settings

HKDF_SALT = b"dream-machine-dek-v1"
NONCE_LENGTH = 12


class CryptoError(Exception):
    """Base exception for cryptographic operations."""


class DecryptionFailedError(CryptoError):
    """Raised when decryption fails due to tampering, wrong key, or wrong user_id."""


def _get_master_key_bytes(master_key: bytes | str | None = None) -> bytes:
    if master_key is None:
        key_str = settings.APP_SECRET_KEY
        return key_str.encode("utf-8") if isinstance(key_str, str) else key_str
    if isinstance(master_key, str):
        return master_key.encode("utf-8")
    return master_key


def derive_user_key(user_id: str | UUID, master_key: bytes | str | None = None) -> bytes:
    """
    Derives a 256-bit per-user data key using HKDF-SHA256 with user_id as context.
    """
    uid_str = str(user_id)
    raw_master = _get_master_key_bytes(master_key)
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=HKDF_SALT,
        info=f"user:{uid_str}".encode("utf-8"),
    )
    return hkdf.derive(raw_master)


def encrypt_field(
    plaintext: str | None,
    user_id: str | UUID,
    master_key: bytes | str | None = None,
) -> bytes | None:
    """
    Encrypts a plaintext string using AES-256-GCM.
    Returns: 12-byte nonce + AES-GCM ciphertext (including 16-byte authentication tag).
    AAD: user_id string to enforce cryptographic ownership binding.
    """
    if plaintext is None:
        return None

    uid_str = str(user_id)
    user_key = derive_user_key(uid_str, master_key)
    aesgcm = AESGCM(user_key)
    nonce = os.urandom(NONCE_LENGTH)
    aad = uid_str.encode("utf-8")
    data = plaintext.encode("utf-8")

    ciphertext_with_tag = aesgcm.encrypt(nonce, data, aad)
    return nonce + ciphertext_with_tag


def decrypt_field(
    ciphertext_blob: bytes | None,
    user_id: str | UUID,
    master_key: bytes | str | None = None,
) -> str | None:
    """
    Decrypts an AES-256-GCM encrypted byte blob.
    Verifies authentication tag and ownership binding (AAD = user_id).
    Raises DecryptionFailedError if modified or decrypted by unauthorized user.
    """
    if ciphertext_blob is None:
        return None

    if len(ciphertext_blob) < NONCE_LENGTH + 16:
        raise DecryptionFailedError("Ciphertext payload is too short or malformed.")

    uid_str = str(user_id)
    nonce = ciphertext_blob[:NONCE_LENGTH]
    ct_with_tag = ciphertext_blob[NONCE_LENGTH:]
    aad = uid_str.encode("utf-8")
    user_key = derive_user_key(uid_str, master_key)
    aesgcm = AESGCM(user_key)

    try:
        decrypted_bytes = aesgcm.decrypt(nonce, ct_with_tag, aad)
        return decrypted_bytes.decode("utf-8")
    except InvalidTag as err:
        raise DecryptionFailedError(
            "Authentication tag verification failed: ciphertext is corrupt, tampered, or owner mismatch."
        ) from err
    except Exception as err:
        raise DecryptionFailedError(f"Decryption failed: {err}") from err


def hash_password(password: str) -> str:
    """Hashes a plaintext password with bcrypt and a work factor of 12."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    """Verifies a password against its bcrypt hash in constant time."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

