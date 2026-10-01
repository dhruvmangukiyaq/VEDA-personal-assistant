"""Chat controller — HTTP only, all logic lives in services."""
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from ..models.schemas import ChatRequest, ChatResponse
from ..services.brain.router import route_utterance, route_utterance_stream

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    history = [{"role": m.role, "text": m.text} for m in req.history]
    res = await route_utterance(
        text=req.text, lang=req.lang, confidence=req.confidence,
        history=history, profile=req.profile,
    )
    return ChatResponse(
        kind=res.kind, reply=res.reply, lang=res.lang, action=res.action,
        tool_calls=res.tool_calls, fun=res.fun, silent=res.silent,
        profile_update=res.profile_update,
    )


@router.post("/stream")
async def chat_stream(req: ChatRequest) -> StreamingResponse:
    """Server-sent events: `data: {"t": token}` chunks, then `data: {"done": {...}}`."""
    import json as _json

    history = [{"role": m.role, "text": m.text} for m in req.history]

    async def gen():
        async for ev in route_utterance_stream(
            text=req.text, lang=req.lang, confidence=req.confidence,
            history=history, profile=req.profile,
        ):
            yield "data: " + _json.dumps(ev, ensure_ascii=False) + "\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")
