"""HTTP models (pydantic schemas) — the Model layer for controllers."""
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class HistoryMsg(BaseModel):
    role: str = Field(pattern="^(user|model)$")
    text: str = Field(max_length=2000)


class ChatRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    lang: str = Field(default="auto", max_length=10)
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    history: List[HistoryMsg] = Field(default_factory=list)
    profile: Dict[str, Any] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    kind: str
    reply: str
    lang: str
    action: Optional[str] = None
    tool_calls: List[str] = Field(default_factory=list)
    fun: bool = False
    silent: bool = False
    profile_update: Optional[Dict[str, Any]] = None


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    lang: str = Field(default="en", max_length=10)
    voice: Optional[str] = None
