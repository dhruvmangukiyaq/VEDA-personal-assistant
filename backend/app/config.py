"""VEDA backend — production FastAPI service (Milestone 1 skeleton)."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

APP_NAME = "veda-api"
APP_VERSION = "0.1.0-m1"

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openrouter")  # openrouter | gemini-direct
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "google/gemini-3.5-flash-lite")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./veda.db")
LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()]
