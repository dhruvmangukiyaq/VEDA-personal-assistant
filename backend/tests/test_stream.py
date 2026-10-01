"""Streaming + TTS contract tests (no keys needed)."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _events(path, payload):
    with client.stream("POST", path, json=payload) as r:
        assert r.status_code == 200
        buf = ""
        for chunk in r.iter_text():
            buf += chunk
            while "\n\n" in buf:
                raw, buf = buf.split("\n\n", 1)
                for line in raw.splitlines():
                    if line.startswith("data:"):
                        import json as _j
                        yield _j.loads(line[5:])


def test_stream_fast_path_single_event():
    evs = list(_events("/api/chat/stream", {"text": "hello"}))
    assert evs and evs[-1]["done"]["kind"] == "smalltalk"
    assert evs[-1]["done"]["reply"]


def test_stream_filler_silent():
    evs = list(_events("/api/chat/stream", {"text": "ok"}))
    assert evs[-1]["done"]["silent"] is True


def test_tts_status_unconfigured():
    r = client.get("/api/tts/status")
    assert r.status_code == 200
    body = r.json()
    assert body["configured"] is False
    assert body["provider"] == "browser"


def test_tts_synth_501_without_provider():
    r = client.post("/api/tts", json={"text": "hello"})
    assert r.status_code == 501
