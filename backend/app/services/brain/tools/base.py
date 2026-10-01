"""Plugin tool system: JSON schema, timeouts, permissions, call log."""
from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, List

from ....config import LOG_DIR

log = logging.getLogger("veda.tools")
LOG_FILE = LOG_DIR / "tool_calls.jsonl"

PERMISSIONS = ("read", "write", "confirm")


@dataclass
class Tool:
    name: str
    description: str
    parameters: Dict[str, Any]
    permission: str  # read | write | confirm
    timeout: float = 8.0
    run: Callable[[Dict[str, Any]], Awaitable[str]] = None  # type: ignore[assignment]

    def schema(self) -> Dict[str, Any]:
        return {"type": "function",
                "function": {"name": self.name, "description": self.description,
                             "parameters": self.parameters}}


REGISTRY: Dict[str, Tool] = {}


def register(tool: Tool) -> Tool:
    if tool.permission not in PERMISSIONS:
        raise ValueError(f"bad permission: {tool.permission}")
    REGISTRY[tool.name] = tool
    return tool


def log_call(name: str, args: Dict[str, Any], ok: bool, ms: int, error: str = "") -> None:
    entry = {"ts": time.time(), "tool": name, "args": args,
             "ok": ok, "ms": ms, "error": error}
    log.info("tool_call %s", json.dumps(entry))
    try:
        LOG_FILE.parent.mkdir(exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except OSError:
        pass


async def run_tool(name: str, args: Dict[str, Any]) -> str:
    tool = REGISTRY.get(name)
    if tool is None:
        return f"Unknown tool: {name}"
    if not isinstance(args, dict):
        return f"Bad arguments for {name}"
    t0 = time.monotonic()
    try:
        result = await asyncio.wait_for(tool.run(args), timeout=tool.timeout)
        log_call(name, args, True, int((time.monotonic() - t0) * 1000))
        return str(result)[:1500]
    except asyncio.TimeoutError:
        log_call(name, args, False, int((time.monotonic() - t0) * 1000), "timeout")
        return f"{name} timed out, please try again."
    except Exception as e:  # noqa: BLE001
        log_call(name, args, False, int((time.monotonic() - t0) * 1000), str(e)[:200])
        return f"{name} failed: {str(e)[:200]}"


def tool_schemas() -> List[Dict[str, Any]]:
    return [t.schema() for t in REGISTRY.values()]
