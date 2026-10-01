"""Pluggable TTS providers. Browser voice stays the default fallback.

Keys live ONLY in server env vars (TTS_PROVIDER + TTS_API_KEY),
never in the frontend. Without keys, /api/tts reports
{"configured": false} and the UI keeps the browser voice.
"""
from __future__ import annotations

import json
import os
import urllib.request
from abc import ABC, abstractmethod
from typing import Optional, Tuple


class TTSProvider(ABC):
    name = "base"

    @abstractmethod
    def synth(self, text: str, lang: str, voice: str = "") -> Tuple[bytes, str]:
        """Return (audio bytes, mime type)."""


class ElevenLabsTTS(TTSProvider):
    name = "elevenlabs"

    def __init__(self, api_key: str = "", voice: str = "") -> None:
        self.api_key = api_key or os.getenv("TTS_API_KEY", "")
        self.voice = voice or os.getenv("TTS_VOICE", "Rachel")

    def synth(self, text: str, lang: str, voice: str = "") -> Tuple[bytes, str]:  # noqa: ARG002
        if not self.api_key:
            raise RuntimeError("TTS_API_KEY missing")
        vid = voice or self.voice
        body = json.dumps({"text": text[:500],
                           "model_id": "eleven_turbo_v2_5"}).encode()
        req = urllib.request.Request(
            f"https://api.elevenlabs.io/v1/text-to-speech/{vid}",
            data=body,
            headers={"xi-api-key": self.api_key, "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read(4_000_000), "audio/mpeg"


class OpenAITTS(TTSProvider):
    name = "openai"

    def __init__(self, api_key: str = "", voice: str = "") -> None:
        self.api_key = api_key or os.getenv("TTS_API_KEY", "")
        self.voice = voice or os.getenv("TTS_VOICE", "nova")

    def synth(self, text: str, lang: str, voice: str = "") -> Tuple[bytes, str]:  # noqa: ARG002
        if not self.api_key:
            raise RuntimeError("TTS_API_KEY missing")
        body = json.dumps({"model": "gpt-4o-mini-tts",
                           "input": text[:500],
                           "voice": voice or self.voice}).encode()
        req = urllib.request.Request(
            "https://api.openai.com/v1/audio/speech",
            data=body,
            headers={"Authorization": "Bearer " + self.api_key,
                     "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read(4_000_000), "audio/mpeg"


def get_tts() -> Optional[TTSProvider]:
    provider = os.getenv("TTS_PROVIDER", "").strip().lower()
    if provider == "elevenlabs" and os.getenv("TTS_API_KEY"):
        return ElevenLabsTTS()
    if provider == "openai" and os.getenv("TTS_API_KEY"):
        return OpenAITTS()
    return None
