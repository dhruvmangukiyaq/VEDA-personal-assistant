# VEDA — Personal Voice Assistant

Hands-free, trilingual (English / Hindi / Gujarati) voice assistant in the
browser. Speak naturally — Veda detects your language and answers in it —
with a real-time particle-sphere visual that reacts to your voice.

- 🎙️ **Hands-free voice loop** — mic → speech → reply, no buttons needed
- 🗣️ **Same-language replies** — English, Hindi (Devanagari + roman),
  Gujarati (script + roman), auto-detected per utterance
- 🧠 **Two brains** — instant offline brain + FastAPI backend
  (LLM router with function calling, streaming)
- 🔥 **Plasma sphere** — 30k GPU particles, voice-reactive, space backdrop
- 💬 **Chat widget** — transcript, type fallback, unread badge
- 🎊 Jokes trigger confetti. Obviously.

## Architecture (MVC)

```
VEDA personal assistant/
├── src/
│   ├── app/page.tsx          # VIEW — JSX only, thin binding
│   ├── views/                # VIEW — ParticleSphere, SpaceDrift
│   ├── controllers/          # CONTROLLER — useVedaController (voice pipeline)
│   ├── models/              # MODEL — vedaBrain, store (types/API/storage)
│   └── lib/                  # shared utils (audioBus)
├── backend/app/
│   ├── controllers/          # HTTP only (chat, audio, memory, tools)
│   ├── services/             # brain (router/llm/tools), tts
│   ├── models/               # pydantic schemas
│   └── main.py               # FastAPI entrypoint
└── scripts/                  # headless screenshot / verify harnesses
```

Frontend (Next.js) owns the voice loop and renders state.
Backend (FastAPI) owns the LLM router, tools, and secrets.
Rule: **no API keys in the frontend** — keys live in `backend/.env` only.

## Quick start

Requirements: Node 20+, Python 3.9+ (3.11 recommended), Chrome (mic + voices).

```bash
# 1) web UI
npm install
npm run dev            # → http://127.0.0.1:3000

# 2) backend brain (second terminal)
cd backend
pip install -r requirements.txt
cp .env.example .env   # then add your key (below)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Open the page, allow the microphone, just speak.
In ⚙ settings, turn **BACKEND ON** to use the server brain
(LLM + tools + streaming); OFF = fully offline brain.

## Environment (`backend/.env`)

| Key | Needed for | Default |
|---|---|---|
| `LLM_PROVIDER` | `openrouter` or `gemini-direct` | `openrouter` |
| `OPENROUTER_API_KEY` | cloud brain via OpenRouter | — |
| `LLM_MODEL` | chat model id | `google/gemini-3.5-flash-lite` |
| `TTS_PROVIDER` / `TTS_API_KEY` | premium voice (`elevenlabs`/`openai`) | browser voice |
| `DATABASE_URL` | memory DB (M4) | sqlite file |
| `CORS_ORIGINS` | allowed web origins | localhost:3000 |

## Voice pipeline

```
mic → Web Speech STT (en-US/hi-IN/gu-IN, interim captions)
  → echo-guard (ignores Veda hearing herself) + confidence clarify
  → brain: local actions → backend SSE stream → offline fallback
  → sentence-queue TTS (browser voice or /api/tts mp3) → audioBus levels → sphere
```

First audio target ≤ 1.5 s: instant local actions (~ms),
streamed first sentence, "One moment." ack on slow calls.
⚙ → **Debug ON** shows live STT/BRAIN/TTS timings.

## Tools (backend plugins)

Each tool: name + JSON schema + timeout + permission
(`read`/`write`/`confirm`), every call logged to
`backend/logs/tool_calls.jsonl`. v1: `get_time`, `calculate`,
`tell_joke`, `web_search` (DuckDuckGo + Wikipedia),
`get_weather` (Open-Meteo), `define_word`.

**Add a tool:** implement `async def _x(args)` in
`backend/app/services/brain/tools/builtin.py` and `register(Tool(...))`
— the LLM picks it up automatically via the schema.

## Testing

```bash
python -m pytest backend/tests -q            # 26 pass (offline-safe)
VEDA_LIVE_TESTS=1 python -m pytest backend/tests/test_llm_live.py -q  # real key, tiny spend
npm run build                                  # frontend type-check + build
node scripts/shot.mjs /tmp/shots               # headless stage screenshot
node scripts/frames.mjs                         # motion check (2 frames, pixel diff)
node scripts/verify-center.mjs                  # centering @ DSF 1+2
```

`backend/tests/data/utterances.json` holds 55 regression utterances
(filler, greetings, noise, Hinglish/Gujlish…) — `test_router.py`
asserts none of them ever hit raw web search.

## Docker / CI

```bash
docker compose up --build   # api :8000 + web :3000 (needs backend/.env)
```
`.github/workflows/ci.yml` runs pytest + `npm run build` on push/PR.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Sphere off-center / cropped | Hard-refresh; fixed by canvas CSS-size fix — see `ParticleSphere.tsx` resize block |
| Mic banner / no listening | Use **Chrome** (Safari has no SpeechRecognition), Allow mic, RETRY MIC |
| Greeting repeats / "Hello Hello" | Name got saved as "Hello" — say **"forget my name"** |
| Backend brain silent | API running? `curl localhost:8000/health`; ⚙ BACKEND ON? |
| Hydration "1 Issue" badge | Fixed by client-only store hydration; hard-refresh (Cmd+Shift+R) |

## Roadmap

M3 voice upgrades (wake-word, barge-in) · M4 persistent memory DB ·
M5 reminders/notes/calendar · M6 Google OAuth + confirmations ·
M7 auth/hardening · M8 deploy docs.
