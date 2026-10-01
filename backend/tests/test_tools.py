"""M2: tool unit tests — all hit REAL free services (no mocks)."""
import asyncio

from app.services.brain.tools.base import REGISTRY, run_tool


def run(name, args):
    return asyncio.run(run_tool(name, args))


def test_registry_has_v1_tools():
    assert set(REGISTRY) >= {"get_time", "calculate", "tell_joke",
                             "web_search", "get_weather", "define_word"}
    for t in REGISTRY.values():
        assert t.permission in ("read", "write", "confirm")
        assert t.schema()["function"]["name"] == t.name


def test_unknown_tool_handled():
    assert "Unknown tool" in run("nope_tool", {})


def test_time_tool():
    out = run("get_time", {})
    assert any(k in out for k in ("AM", "PM", "Monday", "2026", ":"))


def test_calculate_tool():
    assert "540" in run("calculate", {"expression": "45 * 12"})
    assert "could not" in run("calculate", {"expression": "hello"}).lower()


def test_joke_tool():
    assert len(run("tell_joke", {})) > 10


def test_web_search_real():
    out = run("web_search", {"query": "Albert Einstein"})
    assert len(out) > 50  # live DDG or Wikipedia answer


def test_weather_real():
    out = run("get_weather", {"city": "Ahmedabad"})
    assert "degree" in out and "Ahmedabad" in out


def test_define_real():
    out = run("define_word", {"word": "serendipity"})
    assert "serendipity" in out.lower()
