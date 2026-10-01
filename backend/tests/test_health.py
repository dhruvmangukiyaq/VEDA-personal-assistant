"""Smoke tests for the API skeleton (Milestone 1)."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_ok():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "veda-api"


def test_version_present():
    r = client.get("/version")
    assert r.status_code == 200
    assert "version" in r.json()


def test_chat_router_live_m2():
    # M2: router wired. Contract check on a greeting.
    r = client.post("/api/chat", json={"text": "hello"})
    assert r.status_code == 200
    body = r.json()
    assert body["kind"] == "smalltalk"
    assert body["reply"]
    assert "web_search" not in body["tool_calls"]


def test_chat_validates_input():
    r = client.post("/api/chat", json={"text": ""})
    assert r.status_code in (422, 501)
