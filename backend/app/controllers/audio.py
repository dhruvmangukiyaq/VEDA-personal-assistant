"""TTS controller — HTTP only, synthesis lives in services."""
import asyncio

from fastapi import APIRouter
from fastapi.responses import Response

from ..models.schemas import TTSRequest
from ..services import tts as ttsmod

router = APIRouter(prefix="/api/tts", tags=["tts"])


@router.get("/status")
def tts_status() -> dict:
    p = ttsmod.get_tts()
    return {"configured": p is not None, "provider": p.name if p else "browser"}


@router.post("")
async def tts_synth(req: TTSRequest) -> Response:
    p = ttsmod.get_tts()
    if p is None:
        return Response(content='{"detail":"no TTS provider configured"}',
                        status_code=501, media_type="application/json")
    audio, mime = await asyncio.to_thread(p.synth, req.text, req.lang, req.voice or "")
    return Response(content=audio, media_type=mime)
