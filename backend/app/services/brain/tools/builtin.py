"""Built-in tools v1 — all hit real services, no mocks."""
from __future__ import annotations

import json
import random
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Any, Dict

from .base import Tool, register


def _get(url: str, timeout: int = 7) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": "VedaVoice/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        ct = r.headers.get("Content-Type", "")
        body = r.read(60000).decode("utf-8", "replace")
    return json.loads(body) if "json" in ct else body


async def _time(args: Dict[str, Any]) -> str:  # noqa: ARG001
    now = datetime.now()
    return now.strftime("It is %I:%M %p on %A, %B %d.")


async def _math(args: Dict[str, Any]) -> str:
    expr = str(args.get("expression", "")).strip()
    if not expr or not set(expr) <= set("0123456789+-*/%(). ^"):
        return "I could not parse that calculation."
    try:
        val = eval(compile(expr.replace("^", "**"), "<calc>", "eval"), {"__builtins__": {}}, {})  # noqa: S307
        if not isinstance(val, (int, float)):
            return "I could not compute that."
        return f"That equals {round(val, 6)}."
    except Exception:  # noqa: BLE001
        return "I could not compute that."


JOKES = [
    "Why do programmers prefer dark mode? Because light attracts bugs.",
    "Why did the developer go broke? He used up all his cache.",
    "There are only ten kinds of people: those who understand binary and those who do not.",
    "My last joke was so bad, even the error handler cried.",
]


async def _joke(args: Dict[str, Any]) -> str:  # noqa: ARG001
    return random.choice(JOKES)


async def _web_search(args: Dict[str, Any]) -> str:
    q = str(args.get("query", "")).strip()
    if not q:
        return "Empty search query."
    # 1) instant answer
    try:
        ddg = _get("https://api.duckduckgo.com/?q=" + urllib.parse.quote(q)
                   + "&format=json&no_html=1&skip_disambig=1")
        abs_text = (ddg.get("AbstractText") or "").strip()  # type: ignore[union-attr]
        if abs_text and len(abs_text) > 30:
            return abs_text[:600]
    except Exception:  # noqa: BLE001
        pass
    # 2) wikipedia summary
    try:
        wiki = _get("https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(q))
        if isinstance(wiki, dict) and wiki.get("extract"):  # type: ignore[union-attr]
            return str(wiki["extract"])[:600]  # type: ignore[union-attr]
    except Exception:  # noqa: BLE001
        pass
    return f"I could not find a direct answer for '{q}'."


WMO = {0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
       45: "foggy", 48: "icy fog", 51: "light drizzle", 61: "light rain",
       63: "rain", 65: "heavy rain", 71: "light snow", 73: "snow",
       75: "heavy snow", 80: "rain showers", 95: "thunderstorm", 96: "thunderstorm with hail"}


async def _weather(args: Dict[str, Any]) -> str:
    city = str(args.get("city", "")).strip()
    if not city:
        return "Which city?"
    geo = _get("https://geocoding-api.open-meteo.com/v1/search?name="
               + urllib.parse.quote(city) + "&count=1&language=en&format=json")
    res = geo.get("results") if isinstance(geo, dict) else None  # type: ignore[union-attr]
    if not res:
        return f"I could not find '{city}'."
    lat, lon, name = res[0]["latitude"], res[0]["longitude"], res[0]["name"]
    fc = _get(f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
              f"&current=temperature_2m,weather_code")
    cur = fc["current"]  # type: ignore[index]
    cond = WMO.get(cur.get("weather_code", -1), "changing weather")
    return f"It is {round(cur['temperature_2m'])} degrees with {cond} in {name}."


async def _define(args: Dict[str, Any]) -> str:
    word = str(args.get("word", "")).strip().lower()
    if not word or len(word.split()) > 2:
        return "Give me a single word to define."
    try:
        data = _get("https://api.dictionaryapi.dev/api/v2/entries/en/" + urllib.parse.quote(word))
        d = data[0]["meanings"][0]["definitions"][0]["definition"]  # type: ignore[index]
        return f"{word}: {d}"
    except Exception:  # noqa: BLE001
        return f"I could not find a definition for '{word}'."


register(Tool(name="get_time", permission="read", timeout=3.0,
              description="Current local date and time.",
              parameters={"type": "object", "properties": {}},
              run=_time))
register(Tool(name="calculate", permission="read", timeout=3.0,
              description="Evaluate a math expression.",
              parameters={"type": "object",
                          "properties": {"expression": {"type": "string"}},
                          "required": ["expression"]},
              run=_math))
register(Tool(name="tell_joke", permission="read", timeout=3.0,
              description="Tell a short joke (triggers confetti).",
              parameters={"type": "object", "properties": {}},
              run=_joke))
register(Tool(name="web_search", permission="read",
              description="Live web facts: instant answers then Wikipedia.",
              parameters={"type": "object",
                          "properties": {"query": {"type": "string"}},
                          "required": ["query"]},
              run=_web_search))
register(Tool(name="get_weather", permission="read",
              description="Live weather for any city.",
              parameters={"type": "object",
                          "properties": {"city": {"type": "string"}},
                          "required": ["city"]},
              run=_weather))
register(Tool(name="define_word", permission="read",
              description="English dictionary definition.",
              parameters={"type": "object",
                          "properties": {"word": {"type": "string"}},
                          "required": ["word"]},
              run=_define))
