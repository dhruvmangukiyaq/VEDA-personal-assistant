"""LLM provider adapter — swap models without touching the router.

Interface: complete(messages, tools) -> assistant message dict.
Providers: OpenRouter (OpenAI-compatible, default), Gemini direct.
"""
from __future__ import annotations

import json
import urllib.request
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from ... import config

SYSTEM_PROMPT = (
    "You are Veda, a friendly voice assistant like Siri. Rules: "
    "Always reply in the SAME language the user used (English, Hindi, Gujarati or any other). "
    "Keep replies short and spoken-style: 1-3 sentences, under 45 words, no markdown, no lists, no emojis. "
    "Use tools when live facts are needed. Never invent tool output."
)


class LLMProvider(ABC):
    name = "base"

    @abstractmethod
    def complete(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        max_tokens: int = 220,
        timeout: int = 25,
    ) -> Dict[str, Any]:
        """Return OpenAI-style message: {role, content, tool_calls?}."""

    def complete_stream(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        max_tokens: int = 220,
        timeout: int = 30,
    ):
        """Yield content tokens (str). Default: single chunk."""
        msg = self.complete(messages, tools, max_tokens, timeout)
        if msg.get("content"):
            yield msg["content"]


class OpenRouterProvider(LLMProvider):
    name = "openrouter"

    def __init__(self, api_key: str = "", model: str = "") -> None:
        self.api_key = api_key or config.OPENROUTER_API_KEY
        self.model = model or config.LLM_MODEL

    def complete(self, messages, tools=None, max_tokens=220, timeout=25):
        if not self.api_key:
            raise RuntimeError("OPENROUTER_API_KEY missing")
        body: Dict[str, Any] = {
            "model": self.model,
            "messages": [{"role": "system", "content": SYSTEM_PROMPT}] + messages,
            "max_tokens": max_tokens,
        }
        if tools:
            body["tools"] = tools
            body["tool_choice"] = "auto"
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            data=json.dumps(body).encode(),
            headers={"Authorization": "Bearer " + self.api_key,
                     "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.load(r)
        msg = data["choices"][0]["message"]
        out: Dict[str, Any] = {"role": "assistant", "content": msg.get("content") or ""}
        if msg.get("tool_calls"):
            out["tool_calls"] = [
                {"id": tc.get("id", ""), "name": tc["function"]["name"],
                 "arguments": tc["function"].get("arguments", "{}")}
                for tc in msg["tool_calls"]
            ]
        return out

    def complete_stream(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        max_tokens: int = 220,
        timeout: int = 30,
    ):
        """Yield content tokens via OpenRouter SSE. Used for first-sentence TTS."""
        if not self.api_key:
            raise RuntimeError("OPENROUTER_API_KEY missing")
        body: Dict[str, Any] = {
            "model": self.model,
            "messages": [{"role": "system", "content": SYSTEM_PROMPT}] + messages,
            "max_tokens": max_tokens,
            "stream": True,
        }
        if tools:
            body["tools"] = tools
            body["tool_choice"] = "auto"
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            data=json.dumps(body).encode(),
            headers={"Authorization": "Bearer " + self.api_key,
                     "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            buf = b""
            while True:
                chunk = r.read(1024)
                if not chunk:
                    break
                buf += chunk
                while b"\n" in buf:
                    line, buf = buf.split(b"\n", 1)
                    line = line.strip()
                    if not line.startswith(b"data:"):
                        continue
                    payload = line[5:].strip()
                    if payload == b"[DONE]":
                        return
                    try:
                        delta = json.loads(payload)["choices"][0]["delta"]
                    except (KeyError, ValueError, IndexError):
                        continue
                    if delta.get("content"):
                        yield delta["content"]


class GeminiDirectProvider(LLMProvider):
    """Swap-in alternative: Google AI Studio endpoint (same interface)."""

    name = "gemini-direct"

    def __init__(self, api_key: str = "", model: str = "gemini-2.0-flash") -> None:
        self.api_key = api_key or config.GEMINI_API_KEY
        self.model = model or config.GEMINI_MODEL

    def complete(self, messages, tools=None, max_tokens=220, timeout=25):  # noqa: ARG002
        if not self.api_key:
            raise RuntimeError("GEMINI_API_KEY missing")
        texts = "\n".join(f"{m['role']}: {m.get('content','')}" for m in messages[-8:])
        body = {"system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
                "contents": [{"role": "user", "parts": [{"text": texts}]}],
                "generationConfig": {"maxOutputTokens": max_tokens}}
        url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
               f"{self.model}:generateContent?key={self.api_key}")
        req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.load(r)
        parts = data["candidates"][0]["content"]["parts"]
        return {"role": "assistant", "content": "".join(p.get("text", "") for p in parts)}


def get_provider() -> LLMProvider:
    if config.LLM_PROVIDER == "gemini-direct":
        return GeminiDirectProvider()
    return OpenRouterProvider()
