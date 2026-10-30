"""
LLM Provider Ladder: Gemini Free -> Ollama Local (llama3.1:8b).
Architecture Section 5 implementation for structured JSON generation.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Protocol

import httpx

from ..config import settings
from ..logging import logger


class LLMGenerationError(Exception):
    """Raised when all LLM providers fail to generate valid structured output."""


def clean_json_text(raw_text: str) -> str:
    """Strips markdown code fences, comments, and extra whitespace."""
    text = raw_text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


class LLMProvider(Protocol):
    """Protocol for LLM structured JSON generation."""

    async def generate_json(self, prompt: str) -> dict[str, Any]:
        """Generates structured JSON matching prompt requirements."""
        ...


class OllamaProvider:
    """Local Ollama LLM provider (zero cost, 100% private, offline)."""

    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
        timeout: float | None = None,
    ) -> None:
        self.base_url = (base_url or settings.OLLAMA_BASE_URL).rstrip("/")
        self.model = model or settings.OLLAMA_MODEL
        self.timeout = timeout or settings.OLLAMA_TIMEOUT_SECONDS

    async def is_available(self) -> bool:
        """Checks if local Ollama daemon is reachable."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                return resp.status_code == 200
        except Exception:
            return False

    async def generate_json(self, prompt: str) -> dict[str, Any]:
        """Calls local Ollama instance with format=json."""
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "format": "json",
            "stream": False,
            "options": {
                "temperature": 0.4,
                "num_predict": 1024,
            },
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                raise LLMGenerationError(
                    f"Ollama returned HTTP {resp.status_code}: {resp.text[:200]}"
                )
            data = resp.json()
            raw_response = data.get("response", "")
            if not raw_response:
                raise LLMGenerationError("Ollama returned an empty response")

            cleaned = clean_json_text(raw_response)
            try:
                parsed = json.loads(cleaned)
                if not isinstance(parsed, dict):
                    raise LLMGenerationError(f"Expected JSON object, got {type(parsed)}")
                return parsed
            except json.JSONDecodeError as exc:
                raise LLMGenerationError(f"Failed to parse JSON from Ollama: {exc}") from exc


class GeminiProvider:
    """Google Gemini LLM provider via official REST API (zero external SDK dependencies)."""

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")

    async def generate_json(self, prompt: str) -> dict[str, Any]:
        if not self.api_key:
            raise LLMGenerationError("No GEMINI_API_KEY configured")

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
            f"?key={self.api_key}"
        )
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.3,
            },
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                raise LLMGenerationError(
                    f"Gemini API returned HTTP {resp.status_code}: {resp.text[:300]}"
                )
            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                raise LLMGenerationError(f"Gemini returned no candidates: {data}")

            content_parts = candidates[0].get("content", {}).get("parts", [])
            if not content_parts:
                raise LLMGenerationError("Gemini returned candidate without parts")

            raw_text = content_parts[0].get("text", "")
            cleaned = clean_json_text(raw_text)
            try:
                parsed = json.loads(cleaned)
                if not isinstance(parsed, dict):
                    raise LLMGenerationError(f"Expected JSON object from Gemini, got {type(parsed)}")
                return parsed
            except json.JSONDecodeError as exc:
                raise LLMGenerationError(f"Failed to parse JSON from Gemini: {exc}") from exc


def get_llm_provider() -> LLMProvider:
    """Returns the primary configured provider based on availability."""
    api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
    if api_key:
        return GeminiProvider(api_key=api_key)
    return OllamaProvider()


async def complete_json(prompt: str) -> dict[str, Any]:
    """
    Executes prompt against the provider ladder:
    1. Gemini Free (if key exists)
    2. Ollama Local (http://localhost:11434 with llama3.1:8b)
    """
    if os.getenv("PYTEST_CURRENT_TEST") or settings.ENVIRONMENT == "test":
        raise LLMGenerationError("In test environment; external LLM calls bypassed for test isolation.")

    api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
    if api_key:
        try:
            return await GeminiProvider(api_key=api_key).generate_json(prompt)
        except Exception as exc:
            logger.warning(f"Gemini generation failed ({exc}); falling back to local Ollama.")

    # Try local Ollama
    ollama = OllamaProvider()
    try:
        return await ollama.generate_json(prompt)
    except Exception as exc:
        logger.warning(f"Local Ollama generation failed ({type(exc).__name__}: {exc}).")
        raise LLMGenerationError(f"All LLM providers failed: {type(exc).__name__}: {exc}") from exc
