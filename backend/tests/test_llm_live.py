"""M2: LIVE integration — real OpenRouter key, real money (fractions of a cent).

Runs only with VEDA_LIVE_TESTS=1 so CI never spends. Run locally:
    VEDA_LIVE_TESTS=1 python3 -m pytest backend/tests/test_llm_live.py -q
"""
import os

import pytest

from app.services.brain.llm import OpenRouterProvider
from app.services.brain.router import route_utterance

LIVE = os.getenv("VEDA_LIVE_TESTS") == "1"


@pytest.mark.skipif(not LIVE, reason="needs VEDA_LIVE_TESTS=1 + key in backend/.env")
def test_live_greeting_english():
    import asyncio
    res = asyncio.run(route_utterance("hello", provider=None))
    assert res.kind == "smalltalk" and len(res.reply) > 5


@pytest.mark.skipif(not LIVE, reason="needs VEDA_LIVE_TESTS=1 + key in backend/.env")
def test_live_knowledge_with_tools():
    import asyncio
    res = asyncio.run(route_utterance("who is Albert Einstein", provider=None))
    assert res.kind == "knowledge"
    # Correct answer matters; tools are used only when the model needs live facts.
    assert "Einstein" in res.reply or "relativity" in res.reply.lower()


@pytest.mark.skipif(not LIVE, reason="needs VEDA_LIVE_TESTS=1 + key in backend/.env")
def test_live_tool_calling_forced():
    # Bypass the deterministic weather shortcut and force the LLM to
    # call get_weather itself — proves end-to-end function calling.
    from app.services.brain.llm import OpenRouterProvider
    from app.services.brain.tools.base import tool_schemas
    p = OpenRouterProvider()
    msg = p.complete(
        [{"role": "user", "content": "What is the current weather in Ahmedabad? You MUST call get_weather."}],
        tools=tool_schemas(), max_tokens=150,
    )
    assert msg.get("tool_calls"), f"expected a tool call, got: {msg.get('content', '')[:100]}"
    assert msg["tool_calls"][0]["name"] == "get_weather"


@pytest.mark.skipif(not LIVE, reason="needs VEDA_LIVE_TESTS=1 + key in backend/.env")
def test_live_provider_smoke():
    p = OpenRouterProvider()
    msg = p.complete([{"role": "user", "content": "Reply with exactly: LIVE_OK"}], max_tokens=10)
    assert "LIVE_OK" in msg["content"]
    assert p.name == "openrouter"
