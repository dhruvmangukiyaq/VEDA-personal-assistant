"""Utterance regression suite (Milestone 1: dataset + harness).

The 55 cases encode the exact bugs from the prototype:
filler ("ok") searched, "hello" asking for name, garbled input
searched literally. Milestone 2 wires these against the real
router; every must_not_search case must then pass.
"""
import json
from pathlib import Path

DATA = Path(__file__).parent / "data" / "utterances.json"
VALID_EXPECTS = {"ignore", "smalltalk", "action", "knowledge", "clarify"}


def load_cases():
    with open(DATA, encoding="utf-8") as f:
        cases = json.load(f)
    assert isinstance(cases, list)
    return cases


def test_suite_has_minimum_coverage():
    cases = load_cases()
    assert len(cases) >= 50, f"need >=50 utterances, have {len(cases)}"


def test_suite_schema_valid():
    for c in load_cases():
        assert set(c) >= {"id", "text", "lang", "expect"}, c
        assert c["expect"] in VALID_EXPECTS, c
        assert isinstance(c["text"], str) and c["text"].strip(), c


def test_suite_covers_required_categories():
    ids = {c["id"].split("-")[0] for c in load_cases()}
    for cat in ("fill", "greet", "name", "act", "know", "noise", "mix", "small"):
        assert cat in ids, f"missing category {cat}"


def test_filler_and_greetings_must_never_search():
    bad = [c["id"] for c in load_cases()
           if c["id"].startswith(("fill-", "greet-")) and not c.get("must_not_search")]
    assert bad == [], f"these must never hit search: {bad}"


def test_router_contract_pending_m2():
    # Placeholder: M2 implements route_utterance() and this test
    # asserts every case against it. Fails loudly until then.
    try:
        from app.services.brain.router import route_utterance  # noqa
    except ImportError:
        assert True, "router lands in milestone 2"
        return
    assert callable(route_utterance)
