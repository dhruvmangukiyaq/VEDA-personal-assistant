"""Central router: ignore / clarify / smalltalk / action / knowledge.

Deterministic pre-filters fix the prototype bugs (filler searched,
'hello' asking for name, garbled input searched). Anything needing
open knowledge goes to the LLM provider with tools.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .lang import detect_lang
from .llm import LLMProvider, get_provider
from .tools import base as tools_base
from .tools import builtin  # noqa: F401  (registers tools)


@dataclass
class RouteResult:
    kind: str  # ignore|clarify|smalltalk|action|knowledge
    reply: str
    lang: str
    action: Optional[str] = None
    tool_calls: List[str] = field(default_factory=list)
    fun: bool = False
    silent: bool = False
    profile_update: Optional[Dict[str, Any]] = None


FILLER = {"ok", "okay", "hmm", "hm", "achha", "acha", "haan", "han",
          "ha", "saru", "sahi", "huh", "uh", "umm", "oh", "ah"}

T = {
    "hello": {"en": "Hello {n}. What would you like to know?",
              "hi": "Namaste {n}. Aap kya jaanna chahte hain?",
              "gu": "Namaste {n}. Tame su janva mango cho?"},
    "howru": {"en": "I am operating at full capacity, {n}. How can I help?",
              "hi": "Main poori kshamta par hoon, {n}. Main kya madad karu?",
              "gu": "Hu puri kshamta par chu, {n}. Hu su madad karu?"},
    "who": {"en": "I am Veda, your personal voice assistant.",
            "hi": "Main Veda hoon, aapka niji voice assistant.",
            "gu": "Hu Veda chu, tamaro niji voice assistant."},
    "thanks": {"en": "Always at your service, {n}.",
               "hi": "Hamesha aapki seva mein, {n}.",
               "gu": "Hammesha tamari seva ma, {n}."},
    "bye": {"en": "Goodbye, {n}. I will be right here.",
            "hi": "Alvida, {n}. Main yahin rahunga.",
            "gu": "Avjo, {n}. Hu ahin j malsu."},
    "help": {"en": "Ask me anything, {n}: time, calculations, weather, jokes, websites, or knowledge questions.",
             "hi": "Mujhse kuch bhi poochhiye, {n}: samay, hisaab, mausam, chutkule, website ya gyaan.",
             "gu": "Mane kai pan puchho, {n}: samay, hisab, havaman, joke, website ke gnyan."},
    "abilities": {"en": "I can do a lot, {n}: time, date, calculations, weather, definitions, websites, timers, jokes, and knowledge questions. Just speak!",
                  "hi": "Main bahut kuch kar sakta hoon, {n}: samay, tarikh, hisaab, mausam, shabd ka arth, website, timer, chutkule aur gyaan ke sawaal. Bas boliye!",
                  "gu": "Hu ghano badhu kari shaku chu, {n}: samay, tarikh, hisab, havaman, shabd no arth, website, timer, joke ane gnyan na saval. Bas bolo!"},
    "maker": {"en": "I was built by Dhruv, {n} — your personal voice assistant, living right inside this app.",
              "hi": "Mujhe Dhruv ne banaya hai, {n} — aapka niji voice assistant, isi app ke andar rehta hoon.",
              "gu": "Mane Dhruv e banavyo che, {n} — tamaro niji voice assistant, aa app ni andar j rahu chu."},
    "askcity": {"en": "Which city, {n}? Say: weather in Ahmedabad.",
                "hi": "Kaun se sheher ka mausam, {n}? Kahiye: Ahmedabad ka mausam.",
                "gu": "Kya shaher nu havaman, {n}? Kaho: Ahmedabad nu havaman."},
    "where": {"en": "I live right here, inside this app, {n}.",
              "hi": "Main yahin rehta hoon, is app ke andar, {n}.",
              "gu": "Hu ahin j rahu chu, aa app ni andar, {n}."},
    "clarify": {"en": "Sorry, I didn't catch that. Could you say it again?",
                "hi": "Maaf kijiye, main samajh nahi paya. Dobara kahiye?",
                "gu": "Maaf karsho, hu samji shakyo nahi. Fari kaho?"},
    "confirm_heard": {"en": "Did you mean '{t}'?",
                      "hi": "Kya aapka matlab '{t}' tha?",
                      "gu": "Shu tamaro matlab '{t}' hato?"},
    "named": {"en": "Nice to meet you, {v}. I will remember your name.",
              "hi": "Aapse milkar khushi hui, {v}. Main yaad rakhunga.",
              "gu": "Tamne maline anand thayo, {v}. Hu yaad rakhis."},
    "known": {"en": "Your name is {v}, of course.",
              "hi": "Aapka naam {v} hai, bilkul.",
              "gu": "Tamaru naam {v} che, chokkas."},
    "noname": {"en": "You have not told me your name yet.",
               "hi": "Aapne abhi tak apna naam nahi bataya.",
               "gu": "Tame hamna sudhi naam kidhu nathi."},
    "forgot": {"en": "Done. I have forgotten your name.",
               "hi": "Ho gaya. Main naam bhool gaya.",
               "gu": "Thai gayu. Hu naam bhuli gayo."},
}

NAME_RE = re.compile(r"(?:my name is|call me|mera naam(?: hai)?|maru naam(?: che)?|मेरा नाम(?: है)?|મારું નામ)\s+([a-z\u0900-\u097F\u0A80-\u0AFF]+)", re.I)
SITE_RE = re.compile(r"open\s+([a-z0-9.-]+\.[a-z]{2,})", re.I)
SITES = {"youtube": "https://youtube.com", "google": "https://google.com",
         "gmail": "https://mail.google.com", "maps": "https://maps.google.com",
         "github": "https://github.com"}


def _words(s: str) -> List[str]:
    return re.findall(r"[a-z\u0900-\u097F\u0A80-\u0AFF]+", s.lower())


def _edit_dist(a: str, b: str) -> int:
    """Tiny edit distance for STT-garbled words (phone mics mangle them)."""
    if abs(len(a) - len(b)) > 2:
        return 99
    m, n = len(a), len(b)
    dp = list(range(n + 1))
    for i in range(1, m + 1):
        prev, dp[0] = dp[0], i
        for j in range(1, n + 1):
            t = dp[j]
            dp[j] = min(dp[j] + 1, dp[j - 1] + 1, prev + (0 if a[i - 1] == b[j - 1] else 1))
            prev = t
    return dp[n]


def _fuzzy_has(words: List[str], keys: List[str]) -> bool:
    """True if any word equals (or closely resembles) any key."""
    for w in words:
        for k in keys:
            if w == k:
                return True
            if len(w) >= 4 and len(k) >= 4:
                md = 2 if len(k) >= 6 else 1
                if abs(len(w) - len(k)) <= md and _edit_dist(w, k) <= md:
                    return True
    return False


# intent vocabularies (include common STT mishearings)
V_HELLO = ["hello", "helo", "hallo", "namaste", "namaskar", "kemcho", "sasriyakal"]
V_RU = ["kemcho", "kemchho", "majama", "kaise", "kaisi", "kese"]
V_WHO = ["kaun", "kaon"]
V_THANKS = ["thanks", "thankyou", "thanku", "shukriya", "dhanyavad", "aabhar"]
V_BYE = ["bye", "goodbye", "alvida", "avjo", "goodnight"]
V_TIME = ["time", "taim", "samay", "vagya", "vagye", "baje", "ketla", "kitne", "clock"]
V_DATE = ["date", "today", "tarikh", "tareekh", "aaj", "aaje"]
V_JOKE = ["joke", "jok", "funny", "chutkula", "majak", "mazak", "hassavu", "hasavo", "laugh"]
V_WEATHER = ["weather", "wether", "mausam", "mosam", "havaman", "havaman", "temperature", "barish", "varsad", "thandi", "garmi",
             "rain", "rainy", "raining", "snow", "storm", "stormy", "cloudy", "sunny", "windy", "humid"]
V_OPENVERB = ["open", "khol", "kholo", "kholu", "kol", "kolo"]
V_HELP = ["help", "madad", "abilities", "features", "feature"]
V_MAKER = ["banavyu", "banaya", "banai", "creator", "developer", "malik", "owner"]


def _is_weather(s: str, words: List[str]) -> bool:
    """Weather intent? Checked BEFORE date — "what's the weather like today" is weather, not date."""
    return bool(re.search(r"weather|wether|mausam|mosam|havaman|barish|varsad|rain|snow|storm|cloud|temperatur", s)) \
        or _fuzzy_has(words, V_WEATHER)


def _guess_city(s: str, words: List[str]) -> Optional[str]:
    """Loose city guess for garbled weather queries ("ahmedabad nu havaman")."""
    stop = _CITY_STOP | {"in", "mein", "men", "ma", "maa", "par", "no", "nu", "wether",
                         "mosam", "kahe", "kahevay", "batao", "kaho", "temperature",
                         "what", "like", "will", "with", "tell", "know"}
    cands = [w for w in words if len(w) >= 4 and w not in V_WEATHER and w not in stop]
    return max(cands, key=len) if cands else None


_CITY_STOP = {"weather", "mausam", "havaman", "kaho", "batao", "kya", "hai",
              "che", "nu", "ka", "ki", "ke", "ne", "mate", "kaho", "like",
              "today", "tomorrow", "now", "there", "outside", "karo"}


def _weather_city(s: str) -> Optional[str]:
    m = re.search(r"(?:weather|wether|mausam|havaman|rain|barish)[^.?!]*?(?:in|mein|ma)\s+([a-z ]+)", s)
    if m:
        return m.group(1).strip()
    m = re.search(r"([a-z\u0900-\u097F\u0A80-\u0AFF ]+?)\s+ka\s+(?:mausam|weather|rain)", s)
    if m:
        return m.group(1).strip().split()[-1]
    kw = re.search(r"(?:weather|wether|mausam|havaman|rain|barish)\b(.*)", s)
    if kw:
        cands = [w for w in re.findall(r"[a-z]{4,}", kw.group(1)) if w not in _CITY_STOP]
        if cands:
            return max(cands, key=len)
    return None


def _to_expr(s: str) -> Optional[str]:
    x = f" {s.lower()} "
    for pat, op in [("multiplied by|multiply by|times", "*"), ("divided by|divide by", "/"),
                    ("plus|add", "+"), ("minus|subtract", "-")]:
        x = re.sub(pat, op, x)
    x = re.sub(r"[^0-9+\-*/%(). ]", " ", x)
    x = re.sub(r"\s+", " ", x).strip()
    if x and any(c.isdigit() for c in x) and set(x) <= set("0123456789+-*/%(). "):
        return x
    return None


async def fast_path(
    clean: str,
    s: str,
    words: List[str],
    lg: str,
    name: str,
    confidence: float,
    profile: Optional[Dict[str, Any]],
) -> Optional[RouteResult]:
    """Deterministic steps 1-6. Returns None when open knowledge is needed."""
    if not clean:
        return RouteResult("ignore", "", "en", silent=True)

    # 1) filler / ack → ignore, never search
    if s in FILLER or (len(words) <= 2 and all(w in FILLER for w in words)):
        return RouteResult("ignore", "", lg, silent=True)

    # 2) garbled / too short → clarify, never search literally
    alpha = sum(c.isalpha() for c in clean)
    if len(clean) < 2 or alpha == 0 or (len(words) == 1 and len(words[0]) < 2):
        return RouteResult("clarify", T["clarify"][lg], lg)
    if confidence < 0.5 and not re.search(
            r"my name is|mera naam|maru naam|\btime\b|samay|vagya|timer|open|khol|joke|majak|"
            r"calculate|plus|minus|times", s):
        return RouteResult("clarify", T["confirm_heard"][lg].format(t=clean), lg)

    # 3) name memory (profile passed in; DB lands in M4)
    m = NAME_RE.search(s)
    if m:
        v = m.group(1)
        v = v[0].upper() + v[1:] if re.match(r"^[a-z]+$", v, re.I) else v
        return RouteResult("action", T["named"][lg].format(v=v), lg,
                           profile_update={"name": v})
    if re.search(r"what is my name|what's my name|mera naam kya|maru naam su", s):
        saved = (profile or {}).get("name")
        return RouteResult("action",
                           T["known"][lg].format(v=saved) if saved else T["noname"][lg], lg)
    if re.search(r"forget (my )?name|naam (bhool|bhul)", s):
        return RouteResult("action", T["forgot"][lg], lg, profile_update={"name": None})

    # 4) smalltalk — never asks for name, never searches
    if re.match(r"^(hi|hello|hey|namaste|good (morning|evening|afternoon))\b", s) or "hello veda" in s or _fuzzy_has(words, V_HELLO):
        return RouteResult("smalltalk", T["hello"][lg].format(n=name), lg)
    if re.search(r"how are you|kaise ho|kem cho", s) or _fuzzy_has(words, V_RU):
        return RouteResult("smalltalk", T["howru"][lg].format(n=name), lg)
    if re.search(r"who are you|your name|tum kaun|tame kon", s) or _fuzzy_has(words, V_WHO):
        return RouteResult("smalltalk", T["who"][lg], lg)
    if _fuzzy_has(words, V_MAKER) or re.search(r"who made you|kisne banaya|kone banavyu|who created", s):
        return RouteResult("smalltalk", T["maker"][lg].format(n=name), lg)
    if re.search(r"\bthank|shukriya|dhanyavad|aabhar", s) or _fuzzy_has(words, V_THANKS):
        return RouteResult("smalltalk", T["thanks"][lg].format(n=name), lg)
    if re.search(r"\bbye\b|good ?night|see you|alvida|avjo", s) or _fuzzy_has(words, V_BYE):
        return RouteResult("smalltalk", T["bye"][lg].format(n=name), lg)
    if re.search(r"help|what can you do|madad|kari shako|kar sakte|abilities|features|tame shu", s) or _fuzzy_has(words, V_HELP):
        return RouteResult("smalltalk", T["abilities"][lg].format(n=name), lg)
    if re.search(r"where are you from|where do you live|tum kahan se", s):
        return RouteResult("smalltalk", T["where"][lg].format(n=name), lg)

    # 5) deterministic actions (tools, real calls)
    if "timer" not in s and (re.search(r"\btime\b|samay|vagya|kitne baje", s) or _fuzzy_has(words, V_TIME)):
        out = await tools_base.run_tool("get_time", {})
        return RouteResult("action", f"{out} {name}.".replace(" .", "."), lg, tool_calls=["get_time"])
    if (re.search(r"\bdate\b|today|tarikh|aaj|aaje", s) or _fuzzy_has(words, V_DATE)) and not _is_weather(s, words):
        out = await tools_base.run_tool("get_time", {})
        return RouteResult("action", out, lg, tool_calls=["get_time"])
    tm = re.search(r"timer.*?(\d+)\s*(second|minute|hour)", s)
    if "timer" in s and tm:
        secs = int(tm.group(1)) * {"second": 1, "minute": 60, "hour": 3600}[tm.group(2)]
        return RouteResult("action", f"Timer set for {tm.group(1)} {tm.group(2)}s, {name}.",
                           lg, action=f"timer:{secs}")
    for k, url in SITES.items():
        if f"open {k}" in s or (k in s and (re.search(r"open|khol|kholo|खोल|ખોલ", s) or _fuzzy_has(words, V_OPENVERB))):
            return RouteResult("action", f"Opening {k}, {name}.", lg, action=f"open:{url}")
    mo = SITE_RE.search(s)
    if mo:
        url = mo.group(1) if mo.group(1).startswith("http") else "https://" + mo.group(1)
        return RouteResult("action", f"Opening {mo.group(1)}, {name}.", lg, action=f"open:{url}")
    if "music" in s and "play" in s:
        return RouteResult("action", f"Opening music, {name}.", lg,
                           action="open:https://music.youtube.com")
    if "joke" in s or "funny" in s or "majak" in s or _fuzzy_has(words, V_JOKE):
        out = await tools_base.run_tool("tell_joke", {})
        return RouteResult("action", out, lg, tool_calls=["tell_joke"], fun=True)
    if "fact" in s or "rochak" in s or "hakeekat" in s:
        return RouteResult("knowledge", "", lg)  # let LLM answer facts w/ tools
    expr = _to_expr(s) if re.search(r"calcul|comput|solve|plus|minus|times|multipl|divid|percent|\+|-|\*|/", s) else None
    if expr:
        out = await tools_base.run_tool("calculate", {"expression": expr})
        return RouteResult("action", f"{out} {name}.".replace(" .", "."), lg, tool_calls=["calculate"])
    wm_city = _weather_city(s)
    if wm_city:
        out = await tools_base.run_tool("get_weather", {"city": wm_city})
        return RouteResult("action", out, lg, tool_calls=["get_weather"])
    # garbled weather ask ("ahmedabad nu havaman", "wether in paris")
    if _fuzzy_has(words, V_WEATHER):
        g = _guess_city(s, words)
        if g:
            out = await tools_base.run_tool("get_weather", {"city": g})
            if out.startswith("I could not find"):
                return RouteResult("clarify", T["askcity"][lg].format(n=name), lg)
            return RouteResult("action", out, lg, tool_calls=["get_weather"])
        return RouteResult("clarify", T["askcity"][lg].format(n=name), lg)
    dm = re.search(r"(?:meaning of|define|definition of)\s+([a-z]+)", s)
    if dm:
        out = await tools_base.run_tool("define_word", {"word": dm.group(1)})
        return RouteResult("action", out, lg, tool_calls=["define_word"])

    # 6) reminders/notes/memory need M4 DB — honest, no fake
    if re.search(r"remind me|remember (that|this)|note (this|down)|what do you know about me", s):
        return RouteResult(
            "action",
            {"en": f"Noted in this chat, {name} — persistent reminders and memory arrive in milestone 4, with full view and delete.",
             "hi": f"Is chat mein likh liya, {name} — permanent yaadein milestone 4 mein aayengi.",
             "gu": f"Aa chat ma nondhi lidhu, {name} — kaymi yaado milestone 4 ma avse. "}[lg], lg)
    return None


async def route_utterance(
    text: str,
    lang: str = "auto",
    confidence: float = 1.0,
    history: Optional[List[Dict[str, str]]] = None,
    profile: Optional[Dict[str, Any]] = None,
    provider: Optional[LLMProvider] = None,
) -> RouteResult:
    clean = (text or "").strip().strip(".?!")
    lg = lang if lang in ("en", "hi", "gu") else detect_lang(clean or text or "")
    s = (clean or "").lower()
    words = _words(s)
    name = (profile or {}).get("name") or "sir"
    hit = await fast_path(clean, s, words, lg, name, confidence, profile)
    if hit is not None:
        return hit

    # 7) open knowledge → LLM with tools (or offline web_search fallback)
    prov = provider or get_provider()
    try:
        msgs = [{"role": m["role"], "content": m["text"]} for m in (history or [])[-8:]]
        msgs.append({"role": "user", "content": clean})
        used: List[str] = []
        for i in range(3):
            msg = await _call_provider(prov, msgs)
            tcs = msg.get("tool_calls") or []
            if not tcs:
                return RouteResult("knowledge", (msg.get("content") or "").strip()[:1200], lg,
                                   tool_calls=used)
            for tc in tcs:
                res = await tools_base.run_tool(tc["name"], _parse_args(tc.get("arguments", "{}")))
                used.append(tc["name"])
                msgs.append({"role": "assistant", "content": "",
                             "tool_calls": [{"id": tc.get("id", f"c{i}"), "type": "function",
                                            "function": {"name": tc["name"],
                                                       "arguments": tc.get("arguments", "{}")}}]})
                msgs.append({"role": "tool", "tool_call_id": tc.get("id", f"c{i}"), "content": res})
        return RouteResult("knowledge", "That took too many steps, please ask more simply.", lg,
                           tool_calls=used)
    except Exception as e:  # noqa: BLE001
        out = await tools_base.run_tool("web_search", {"query": clean})
        if out and not out.startswith("I could not find"):
            return RouteResult("knowledge", out, lg, tool_calls=["web_search"])
        return RouteResult("knowledge",
                           {"en": f"I searched for '{clean}' but found nothing solid, {name}.",
                            "hi": f"Maine '{clean}' khoja par kuch pakka nahi mila, {name}.",
                            "gu": f"Me '{clean}' shodhyu pan nakkar malyun nahi, {name}."}[lg],
                           lg, action=f"search:{clean}")


async def _call_provider(prov, msgs):
    import asyncio
    return await asyncio.to_thread(prov.complete, msgs, tools_base.tool_schemas())


async def _stream_tokens(prov, msgs):
    """Yield LLM tokens from a worker thread (urllib is blocking)."""
    import asyncio
    import queue
    import threading
    q: "queue.Queue" = queue.Queue()

    def work() -> None:
        try:
            for tok in prov.complete_stream(msgs, tools_base.tool_schemas()):
                q.put(("t", tok))
        except Exception as e:  # noqa: BLE001
            q.put(("e", e))
        finally:
            q.put(("x", None))

    th = threading.Thread(target=work, daemon=True)
    th.start()
    loop = asyncio.get_event_loop()
    while True:
        kind, payload = await loop.run_in_executor(None, q.get)
        if kind == "x":
            return
        if kind == "e":
            raise payload
        yield payload


def _done_dict(res: RouteResult) -> dict:
    return {"kind": res.kind, "reply": res.reply, "lang": res.lang,
            "action": res.action, "tool_calls": res.tool_calls,
            "fun": res.fun, "silent": res.silent,
            "profile_update": res.profile_update}


async def route_utterance_stream(
    text: str,
    lang: str = "auto",
    confidence: float = 1.0,
    history: Optional[List[Dict[str, str]]] = None,
    profile: Optional[Dict[str, Any]] = None,
    provider: Optional[LLMProvider] = None,
):
    """Async generator: yields {"t": token} chunks, then {"done": result}.

    Fast paths (ignore/smalltalk/action) resolve in one step; open
    knowledge streams the final synthesis after the tool loop.
    """
    clean = (text or "").strip().strip(".?!")
    lg = lang if lang in ("en", "hi", "gu") else detect_lang(clean or text or "")
    s = (clean or "").lower()
    words = _words(s)
    name = (profile or {}).get("name") or "sir"
    hit = await fast_path(clean, s, words, lg, name, confidence, profile)
    if hit is not None:
        yield {"done": _done_dict(hit)}
        return
    prov = provider or get_provider()
    try:
        msgs = [{"role": m["role"], "content": m["text"]} for m in (history or [])[-8:]]
        msgs.append({"role": "user", "content": clean})
        used: List[str] = []
        for i in range(3):
            msg = await _call_provider(prov, msgs)
            tcs = msg.get("tool_calls") or []
            if not tcs:
                txt = (msg.get("content") or "").strip()[:1200]
                yield {"t": txt}
                yield {"done": _done_dict(RouteResult("knowledge", txt, lg, tool_calls=used))}
                return
            for tc in tcs:
                res = await tools_base.run_tool(tc["name"], _parse_args(tc.get("arguments", "{}")))
                used.append(tc["name"])
                msgs.append({"role": "assistant", "content": "",
                             "tool_calls": [{"id": tc.get("id", f"c{i}"), "type": "function",
                                            "function": {"name": tc["name"],
                                                       "arguments": tc.get("arguments", "{}")}}]})
                msgs.append({"role": "tool", "tool_call_id": tc.get("id", f"c{i}"), "content": res})
        full = ""
        async for tok in _stream_tokens(prov, msgs):
            full += tok
            yield {"t": tok}
        yield {"done": _done_dict(RouteResult("knowledge", full.strip()[:1200], lg, tool_calls=used))}
    except Exception:  # noqa: BLE001
        out = await tools_base.run_tool("web_search", {"query": clean})
        if out and not out.startswith("I could not find"):
            yield {"done": _done_dict(RouteResult("knowledge", out, lg, tool_calls=["web_search"]))}
        else:
            yield {"done": _done_dict(RouteResult(
                "knowledge",
                {"en": f"I searched for '{clean}' but found nothing solid, {name}.",
                 "hi": f"Maine '{clean}' khoja par kuch pakka nahi mila, {name}.",
                 "gu": f"Me '{clean}' shodhyu pan nakkar malyun nahi, {name}."}[lg],
                lg, action=f"search:{clean}"))}


def _parse_args(raw: str) -> dict:
    import json
    try:
        v = json.loads(raw or "{}")
        return v if isinstance(v, dict) else {}
    except Exception:  # noqa: BLE001
        return {}
