"""VEDA API entrypoint."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .controllers import audio, chat, memory, tools

app = FastAPI(title=config.APP_NAME, version=config.APP_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": config.APP_NAME, "version": config.APP_VERSION}


@app.get("/version")
def version() -> dict:
    return {"version": config.APP_VERSION}


app.include_router(audio.router)
app.include_router(chat.router)
app.include_router(memory.router)
app.include_router(tools.router)
