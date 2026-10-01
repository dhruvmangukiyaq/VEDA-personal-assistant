"""M2: 55-utterance suite now runs against the REAL router.

- Deterministic kinds (ignore/smalltalk/action/clarify) run fully offline.
- Knowledge cases use a FakeProvider (adapter interface) so no money is
  spent; they assert dispatch (kind=knowledge, tools available) rather
  than answer text. Real LLM answers are covered by test_llm_live.py.
"""
import asyncio
import json
from pathlib import Path

from app.services.brain.llm import LLMProvider
from app.services.brain.router import route_utterance

DATA = Path(__file__).parent / "data" / "utterances.json"


class FakeProvider(LLMProvider):
    name = "fake"

    def complete(self, messages, tools=None, max_tokens=220, timeout=25):
        last = messages[-1]["content"] if messages else ""
        return {"role": "assistant",
                "content": f"(test-answer) Understood: {str(last)[:80]}"}


def load_cases():
    with open(DATA, encoding="utf-8") as f:
        return json.load(f)


def run(text, conf=1.0, profile=None):
    return asyncio.run(route_utterance(
        text, confidence=conf, profile=profile or {}, provider=FakeProvider()))


def test_every_case_routes_to_expected_kind():
    fails = []
    for c in load_cases():
        try:
            res = run(c["text"], conf=c.get("confidence", 1.0))
        except Exception as e:  # noqa: BLE001
            fails.append(f"{c['id']}: raised {e}")
            continue
        if res.kind != c["expect"]:
            fails.append(f"{c['id']}: want {c['expect']}, got {res.kind} ({res.reply[:60]!r})")
    assert fails == [], "routing mismatches:\n" + "\n".join(fails)


def test_must_not_search_cases_never_search():
    bad = []
    for c in load_cases():
        if not c.get("must_not_search"):
            continue
        res = run(c["text"], conf=c.get("confidence", 1.0))
        if "web_search" in res.tool_calls or (res.action or "").startswith("search:"):
            bad.append(c["id"])
    assert bad == [], f"these hit search: {bad}"


def test_filler_is_silent():
    res = run("ok")
    assert res.kind == "ignore" and res.silent and res.reply == ""


def test_greeting_never_asks_for_name():
    res = run("hello", profile={"name": "Dhruv"})
    assert res.kind == "smalltalk"
    assert "what is your name" not in res.reply.lower()
    assert "Dhruv" in res.reply


def test_name_roundtrip_without_db():
    saved = run("my name is Dhruv")
    assert saved.profile_update == {"name": "Dhruv"}
    recalled = run("what is my name", profile={"name": "Dhruv"})
    assert "Dhruv" in recalled.reply
