"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { audioBus, pumpAnalyser } from "@/lib/audioBus";
import { getVedaReply, tryLocalAction, detectLang, timerDoneText, isBadName, isRepeatAsk, isStopAsk, langSwitchAsk, type Lang } from "@/models/vedaBrain";
import { API_BASE, DEFAULT_CFG, loadCfg, loadChat, loadName, saveNameValue, clearNameValue, type Cfg, type Msg, type Status, type Timings } from "@/models/store";




const REC_CODE: Record<Lang, string> = { en: "en-US", hi: "hi-IN", gu: "gu-IN" };
export const LANG_COLOR: Record<Lang, string> = { en: "#22d3ee", hi: "#fb923c", gu: "#4ade80" };

function pickVoice(lang: Lang, uri: string): SpeechSynthesisVoice | null {  try {
    const vs = speechSynthesis.getVoices();
    if (!vs.length) return null;
    if (uri) {
      const exact = vs.find((v) => v.voiceURI === uri);
      if (exact) return exact;
    }
    const code = REC_CODE[lang];
    return (
      vs.find((v) => v.lang === code && /google|natural|neural|samantha|zira/i.test(v.name)) ||
      vs.find((v) => v.lang === code) ||
      vs.find((v) => v.lang.startsWith(lang)) ||
      vs.find((v) => v.lang.startsWith("en")) ||
      null
    );
  } catch { return null; }
}

// Strip markdown/URLs/lists so speech never reads formatting aloud.
function cleanForSpeech(s: string): string {
  return s
    .replace(/https?:\/\/\S+/g, " link ")
    .replace(/[*_#`>|~]/g, "")
    .replace(/^\s*(?:[-•\d]+[.)])\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(s: string): string[] {
  const m = s.match(/[^.!?।\n]+[.!?।]+|[^.!?।\n]+$/g);
  return (m || [s]).map((x) => x.trim()).filter(Boolean);
}

// module-level: survives React StrictMode remounts, so boot runs exactly once
let bootDone = false;

export function useVedaController() {
  const [status, setStatus] = useState<Status>("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [chat, setChat] = useState<Msg[]>([]);
  const [cfg, setCfg] = useState<Cfg>(DEFAULT_CFG);
  const [showSettings, setShowSettings] = useState(false);
  const [clock, setClock] = useState("--:--");
  const [handsFree, setHandsFree] = useState(true);
  const [micError, setMicError] = useState("");
  const [micState, setMicState] = useState<"checking" | "ready" | "denied" | "unsupported">("checking");
  const [typed, setTyped] = useState("");
  const [activeLang, setActiveLang] = useState<Lang>("en");
  const [confettiKey, setConfettiKey] = useState(0);
  const [introKey, setIntroKey] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const [interim, setInterim] = useState("");
  const [streamText, setStreamText] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [timings, setTimings] = useState<Timings | null>(null);
  const [unlocked, setUnlocked] = useState(false); // first tap done → mobile may play sound
  const [apiOk, setApiOk] = useState<boolean | null>(null); // backend reachable?

  const statusRef = useRef<Status>("idle");
  const handsFreeRef = useRef(true);
  const activeLangRef = useRef<Lang>("en");
  const listeningRef = useRef(false);
  const blockedRef = useRef(false);
  const lastSpokenRef = useRef("");
  const lastHeardRef = useRef("");
  const speakEndRef = useRef(0);
  const speakTimer = useRef<NodeJS.Timeout | null>(null);
  const bootedRef = useRef(false);
  const timeMarks = useRef({ listenStart: 0, sttEnd: 0, brainStart: 0, firstToken: 0, speakStart: 0 });

  const computeTimings = () => {
    const m = timeMarks.current;
    return {
      stt: m.sttEnd && m.listenStart ? Math.round(m.sttEnd - m.listenStart) : 0,
      brain: m.firstToken && m.brainStart ? Math.round(m.firstToken - m.brainStart) : 0,
      tts: m.speakStart && m.firstToken ? Math.round(m.speakStart - m.firstToken) : 0,
      total: m.speakStart && m.listenStart ? Math.round(m.speakStart - m.listenStart) : 0,
    };
  };

  statusRef.current = status;
  handsFreeRef.current = handsFree;
  activeLangRef.current = activeLang;

  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const chatOpenRef = useRef(chatOpen);
  chatOpenRef.current = chatOpen;
  const chatRef = useRef(chat);
  chatRef.current = chat;

  useEffect(() => {
    try { localStorage.setItem("veda_cfg", JSON.stringify(cfg)); } catch {}
  }, [cfg]);
  useEffect(() => {
    try { localStorage.setItem("veda_chat", JSON.stringify(chat.slice(-40))); } catch {}
    const last = chat[chat.length - 1];
    if (last && last.from === "veda") setUnread((u) => u || !chatOpenRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat]);

  const pingBackend = useCallback(async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const r = await fetch(`${API_BASE}/health`, { signal: ctrl.signal });
      clearTimeout(t);
      setApiOk(r.ok);
    } catch { setApiOk(false); }
  }, []);

  useEffect(() => {
    if (cfg.cloud) pingBackend();
  }, [cfg.cloud, pingBackend]);

  useEffect(() => {
    const id = setInterval(() =>
      setClock(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })), 1000);
    // client-only persisted state — applied AFTER first render so SSR HTML matches
    setChat(loadChat());
    setCfg(loadCfg());
    const loadVoices = () => {
      try {
        const vs = speechSynthesis.getVoices();
        if (vs.length) setVoices(vs);
      } catch {}
    };
    loadVoices();
    try { speechSynthesis.onvoiceschanged = loadVoices; } catch {}
    // backend reachability (drives the ONLINE/OFFLINE badge in settings)
    pingBackend();
    // pre-warm backend (faster first answer) + check premium TTS
    fetch(`${API_BASE}/health`).catch(() => {});
    fetch(`${API_BASE}/api/tts/status`).then((r) => r.json()).then((d) => {
      ttsReadyRef.current = !!d.configured;
    }).catch(() => {});
    return () => { clearInterval(id); try { speechSynthesis.cancel(); } catch {}; if (micPumpRef.current) clearInterval(micPumpRef.current); try { micCtxRef.current?.close(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restartLoop = useCallback((ms: number) => {
    setTimeout(() => {
      if (blockedRef.current) return;
      if (handsFreeRef.current && (statusRef.current === "idle") && !listeningRef.current) listen();
    }, ms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- sentence-level TTS queue (no cutoffs, no overlap) ----
  const queueRef = useRef<{ text: string; lang: Lang }[]>([]);
  const speakingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioElRef = useRef<{ stop: () => void } | null>(null);
  const ttsReadyRef = useRef(false); // premium server voice available?
  const resumeWatchRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ttsStartedRef = useRef(false); // true once real audio actually started (mobile autoplay check)
  const pendingGreetRef = useRef<{ text: string; lang: Lang } | null>(null);
  const audioUnlockedRef = useRef(false); // true after first user tap (mobile needs a gesture for sound)

  const stopAllAudio = useCallback(() => {
    try { speechSynthesis.cancel(); } catch {}
    try { audioElRef.current?.stop(); } catch {}
    audioElRef.current = null;
    queueRef.current = [];
    speakingRef.current = false;
    if (speakTimer.current) clearInterval(speakTimer.current);
    if (resumeWatchRef.current) clearInterval(resumeWatchRef.current);
    audioBus.ttsLevel = 0;
    setAudioLevel(0);
  }, []);

  const utterBrowser = useCallback((text: string, lang: Lang, onend: () => void) => {
    const startInner = () => {
      try {
        try { speechSynthesis.resume(); } catch {}
        try { speechSynthesis.cancel(); } catch {}
        const u = new SpeechSynthesisUtterance(text);
        const v = pickVoice(lang, cfgRef.current.voiceURI);
        // voice+lang mismatch (e.g. gu-IN text on an en voice) = silent on Android → match them
        u.lang = v ? v.lang : REC_CODE[lang];
        if (v) u.voice = v;
        u.rate = cfgRef.current.rate; u.pitch = 0.95;
        u.onstart = () => {
          ttsStartedRef.current = true;
          setStatus("speaking");
          if (speakTimer.current) clearInterval(speakTimer.current);
          speakTimer.current = setInterval(() => {
            const v2 = 0.3 + Math.random() * 0.7;
            setAudioLevel(v2);
            audioBus.ttsLevel = Math.min(1, v2);
          }, 130);
          // Android Chrome pauses long utterances (~15s bug) — keep it alive
          if (resumeWatchRef.current) clearInterval(resumeWatchRef.current);
          resumeWatchRef.current = setInterval(() => {
            try {
              if (speechSynthesis.paused) speechSynthesis.resume();
              else if (speechSynthesis.speaking) speechSynthesis.resume();
            } catch {}
          }, 5000);
          if (!timeMarks.current.speakStart) {
            timeMarks.current.speakStart = performance.now();
            setTimings(computeTimings());
          }
        };
        // word events drive the orb when audio can't be tapped (Task 2 reads audioBus)
        u.onboundary = (e: SpeechSynthesisEvent) => {
          const w = text.slice(e.charIndex, e.charIndex + (e.charLength || 5));
          audioBus.pulse(Math.min(0.8, 0.25 + w.length * 0.05));
        };
        const done = () => {
          if (resumeWatchRef.current) clearInterval(resumeWatchRef.current);
          onend();
        };
        u.onend = done;
        u.onerror = done;
        speechSynthesis.speak(u);
      } catch { onend(); }
    };
    const start = () => {
      try {
        try { speechSynthesis.resume(); } catch {}
        // mobile Chrome: cancel() can leave the engine stuck in speaking=true with no
        // sound and no onend — reset first, then speak on the next tick
        if (speechSynthesis.speaking || speechSynthesis.pending) {
          try { speechSynthesis.cancel(); } catch {}
          setTimeout(startInner, 120);
        } else startInner();
      } catch { onend(); }
    };
    try {
      if (speechSynthesis.getVoices().length === 0) {
        let fired = false;
        const go = () => { if (!fired) { fired = true; start(); } };
        speechSynthesis.onvoiceschanged = go;
        setTimeout(go, 2500);
      } else start();
    } catch { onend(); }
  }, []);

  const utterBackend = useCallback(async (text: string, lang: Lang, onend: () => void) => {
    try {
      const r = await fetch(`${API_BASE}/api/tts`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 500), lang }),
      });
      if (!r.ok) throw new Error("tts off");
      const buf = await r.arrayBuffer();
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new AC();
      const actx = audioCtxRef.current;
      try { await actx.resume(); } catch {}
      const decoded = await actx.decodeAudioData(buf.slice(0));
      const src = actx.createBufferSource();
      src.buffer = decoded;
      const an = actx.createAnalyser();
      an.fftSize = 128;
      src.connect(an); an.connect(actx.destination);
      audioBus.ttsAnalyser = an;
      let stopped = false;
      audioElRef.current = { stop: () => { stopped = true; try { src.stop(); } catch {} } };
      setStatus("speaking");
      ttsStartedRef.current = true;
      if (!timeMarks.current.speakStart) {
        timeMarks.current.speakStart = performance.now();
        setTimings(computeTimings());
      }
      const pump = setInterval(() => {
        if (stopped) { clearInterval(pump); return; }
        pumpAnalyser(an, audioBus.ttsBands, (v) => {
          audioBus.ttsLevel = v;
          setAudioLevel(0.25 + v * 0.75);
        });
      }, 90);
      src.onended = () => {
        clearInterval(pump);
        audioElRef.current = null;
        audioBus.ttsAnalyser = null;
        onend();
      };
      src.start();
    } catch { utterBrowser(text, lang, onend); }
  }, [utterBrowser]);

  const pumpQueue = useCallback(() => {
    if (speakingRef.current) return;
    const next = queueRef.current.shift();
    if (!next) {
      setStatus("idle"); setAudioLevel(0);
      audioBus.ttsLevel = 0;
      speakEndRef.current = Date.now();
      if (speakTimer.current) clearInterval(speakTimer.current);
      restartLoop(900);
      return;
    }
    speakingRef.current = true;
    const finish = () => { speakingRef.current = false; pumpQueue(); };
    if (ttsReadyRef.current) utterBackend(next.text, next.lang, finish);
    else utterBrowser(next.text, next.lang, finish);
  }, [utterBackend, utterBrowser, restartLoop]);

  const speak = useCallback((text: string, lang: Lang) => {
    setChat((c) => [...c, { from: "veda", text, lang }]);
    lastSpokenRef.current = text;
    stopAllAudio();
    for (const s of splitSentences(cleanForSpeech(text))) {
      if (s) queueRef.current.push({ text: s, lang });
    }
    pumpQueue();
  }, [pumpQueue, stopAllAudio]);

  // First user gesture: unlock mobile audio, replay greeting if it never sounded.
  const unlockAudio = useCallback(() => {
    audioUnlockedRef.current = true;
    setUnlocked(true);
    try { speechSynthesis.resume(); } catch {}
    try { speechSynthesis.getVoices(); } catch {}
    try { void audioCtxRef.current?.resume?.(); } catch {}
    const g = pendingGreetRef.current;
    if (g && !ttsStartedRef.current) {
      pendingGreetRef.current = null;
      stopAllAudio();
      for (const s of splitSentences(cleanForSpeech(g.text))) {
        if (s) queueRef.current.push({ text: s, lang: g.lang });
      }
      pumpQueue();
    }
  }, [pumpQueue, stopAllAudio]);

  // Speaker check (settings button) — plays without polluting chat.
  const testVoice = useCallback(() => {
    unlockAudio();
    try { speechSynthesis.cancel(); } catch {}
    const lang = activeLangRef.current;
    const samples: Record<Lang, string> = {
      en: "Hello! I am Veda. Can you hear me clearly?",
      hi: "Namaste! Main Veda hoon. Kya aap mujhe saaf sun sakte hain?",
      gu: "Kem cho! Hu Veda chu. Shu tame mane saf sambhali shako cho?",
    };
    stopAllAudio();
    for (const s of splitSentences(cleanForSpeech(samples[lang]))) {
      if (s) queueRef.current.push({ text: s, lang });
    }
    pumpQueue();
  }, [pumpQueue, stopAllAudio, unlockAudio]);

  const pendingNameRef = useRef(true);

  const saveName = useCallback((rawName: string, lang: Lang) => {
    const v = rawName.trim().replace(/[.?!]+$/, "");
    if (!v || isBadName(v)) {
      const retry: Record<Lang, string> = {
        en: "Sorry, I didn't catch your name. Please tell me your name.",
        hi: "Maaf kijiye, main aapka naam samajh nahi paya. Kripya apna naam batayiye.",
        gu: "Maaf karsho, hu tamaru naam samji shakyo nahi. Krupaya tamaru naam kaho.",
      };
      setStatus("idle");
      setTimeout(() => speak(retry[lang], lang), 250);
      return;
    }
    const name = /^[a-z]+$/i.test(v) ? v[0].toUpperCase() + v.slice(1) : v;
    saveNameValue(name);
    pendingNameRef.current = false;
    const reply: Record<Lang, string> = {
      en: `Nice to meet you, ${name}! I will call you by your name from now on. How can I help you?`,
      hi: `Aapse milkar khushi hui, ${name}! Ab se main aapko aapke naam se bulaunga. Kahiye, main aapki kya madad kar sakta hoon?`,
      gu: `Tamne maline anand thayo, ${name}! Have thi hu tamne tamara naam thi bolavis. Kaho, hu tamari su madad karu?`,
    };
    setActiveLang(lang); activeLangRef.current = lang;
    setStatus("idle");
    setTimeout(() => speak(reply[lang], lang), 250);
  }, [speak]);

  const handleUserText = useCallback(async (text: string, conf = 1) => {
    if (!text.trim()) return;
    setChat((c) => [...c, { from: "you", text }]);
    // "stop / bas karo" — cut speech immediately
    if (isStopAsk(text)) {
      stopAllAudio();
      setStatus("idle");
      restartLoop(900);
      return;
    }
    // "fari kaho / repeat" — replay last Veda reply without re-asking the brain
    if (isRepeatAsk(text)) {
      const lang = activeLangRef.current;
      const lv = [...chatRef.current].reverse().find((m) => m.from === "veda");
      if (lv?.text) {
        stopAllAudio();
        for (const s of splitSentences(cleanForSpeech(lv.text))) {
          if (s) queueRef.current.push({ text: s, lang: lv.lang || lang });
        }
        pumpQueue();
      } else {
        const miss: Record<Lang, string> = {
          en: "There is nothing to repeat yet. Ask me something first.",
          hi: "Abhi dohrane ke liye kuch nahi hai. Pehle kuch poochhiye.",
          gu: "Hamna farithi kaheva jevu kai nathi. Pehla kai puchho.",
        };
        setStatus("idle");
        setTimeout(() => speak(miss[lang], lang), 250);
      }
      return;
    }
    // "hindi ma bol" — switch reply language
    const sw = langSwitchAsk(text);
    if (sw) {
      setActiveLang(sw); activeLangRef.current = sw;
      const ok: Record<Lang, string> = {
        en: "Done. From now on I will speak English.",
        hi: "Ho gaya. Ab se main Hindi mein bolunga.",
        gu: "Thai gayu. Have thi hu Gujarati ma bolis.",
      };
      setStatus("idle");
      setTimeout(() => speak(ok[sw], sw), 250);
      return;
    }
    setStatus("thinking");
    const lower = text.toLowerCase();
    // forget saved name
    if (/(forget (my )?name|delete (my )?name|remove (my )?name|naam (bhool|bhul|bhuli|delete)|नाम भूल|નામ ભૂલ)/.test(lower)) {
      clearNameValue();
      pendingNameRef.current = true;
      const lang = activeLangRef.current;
      const ask: Record<Lang, string> = {
        en: "Done. I have forgotten your name. Please tell me your name again.",
        hi: "Ho gaya. Main aapka naam bhool gaya. Kripya apna naam phir se batayiye.",
        gu: "Thai gayu. Hu tamaru naam bhuli gayo. Krupaya tamaru naam fari kaho.",
      };
      setStatus("idle");
      setTimeout(() => speak(ask[lang], lang), 250);
      return;
    }
    // first answer = user's name (e.g. just "Dhruv")
    if (pendingNameRef.current) {
      const clean = text.trim().replace(/[.?!]+$/, "");
      const words = clean.split(/\s+/);
      const isQuestion = /[?]|^(who|what|when|where|why|how|open|tell|play|set|calculate|time|date)/i.test(clean);
      const hasNamePattern = /(my name is|call me|i am called|mera naam|मेरा नाम|maru naam|મારું નામ)/i.test(clean);
      if (hasNamePattern) {
        pendingNameRef.current = false; // brain will save it below
      } else if (!isQuestion && words.length <= 3 && clean.length >= 2 && clean.length <= 30) {
        saveName(clean, activeLangRef.current);
        return;
      } else {
        pendingNameRef.current = false;
      }
    }
    try {
      const useLang = detectLang(text);
      timeMarks.current.brainStart = performance.now();
      // 1) instant offline actions first (fast + reliable)
      const quick = tryLocalAction(text);
      if (quick) {
        timeMarks.current.firstToken = performance.now();
        setTimings(computeTimings());
        setActiveLang(quick.lang); activeLangRef.current = quick.lang;
        if (quick.action) window.open(quick.action, "_blank");
        if (quick.fun) setConfettiKey((k) => k + 1);
        if (quick.timerSeconds) {
          speak(quick.text, quick.lang);
          const doneMsg = timerDoneText(quick.lang);
          setTimeout(() => speak(doneMsg, quick.lang), (quick.timerSeconds as number) * 1000);
          return;
        }
        setStatus("idle");
        setTimeout(() => speak(quick.text, quick.lang), 250);
        return;
      }
      // garbled mic input (low STT confidence, no local match) → ask again, don't search garbage
      if (conf < 0.45) {
        const lang = activeLangRef.current;
        const heard = text.length > 60 ? text.slice(0, 60) + "…" : text;
        const askAgain: Record<Lang, string> = {
          en: `I heard something like '${heard}'. Could you say it once more, a little slowly?`,
          hi: `Mujhe '${heard}' jaisa kuch sunai diya. Kripya ek baar phir se, thoda dheere kahiye?`,
          gu: `Mane '${heard}' jevu kai sambhlayu. Krupaya ek vaar fari, thodu dhire kaho?`,
        };
        setStatus("idle");
        setTimeout(() => speak(askAgain[lang], lang), 250);
        return;
      }
      // 2) backend brain (FastAPI router + tools + cloud LLM) — key stays on server
      //    streamed: first full sentence speaks ASAP (target first audio < 1.5s)
      const c = cfgRef.current;
      if (c.cloud) {
        timeMarks.current.brainStart = performance.now();
        let firstSpoken = false;
        let acked = false;
        const ackTimer = setTimeout(() => {
          if (!firstSpoken && statusRef.current === "thinking") {
            acked = true;
            const ack: Record<Lang, string> = { en: "One moment.", hi: "Ek second.", gu: "Ek second." };
            queueRef.current.push({ text: ack[activeLangRef.current], lang: activeLangRef.current });
            pumpQueue();
          }
        }, 1500);
        const speakSentence = (s: string, lang: Lang) => {
          if (!timeMarks.current.firstToken) {
            timeMarks.current.firstToken = performance.now();
            setTimings(computeTimings());
          }
          firstSpoken = true;
          lastSpokenRef.current += (lastSpokenRef.current ? " " : "") + s;
          queueRef.current.push({ text: s, lang });
          pumpQueue();
        };
        try {
          const ctrl = new AbortController();
          const to = setTimeout(() => ctrl.abort(), 45000);
          const r = await fetch(`${API_BASE}/api/chat/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: ctrl.signal,
            body: JSON.stringify({
              text,
              history: chatRef.current.slice(-8).map((m) => ({
                role: m.from === "you" ? "user" : "model", text: m.text,
              })),
              profile: { name: loadName() },
            }),
          });
          if (!r.ok || !r.body) throw new Error(`api ${r.status}`);
          const reader = r.body.getReader();
          const dec = new TextDecoder();
          let buf = "", pending = "", full = "";
          let meta: {
            kind: string; lang: Lang; action?: string;
            fun?: boolean; silent?: boolean; profile_update?: { name?: string | null };
          } | null = null;
          for (;;) {
            const { done: rd, value } = await reader.read();
            if (rd) break;
            buf += dec.decode(value, { stream: true });
            let idx: number;
            while ((idx = buf.indexOf("\n\n")) >= 0) {
              const raw = buf.slice(0, idx).trim();
              buf = buf.slice(idx + 2);
              if (!raw.startsWith("data:")) continue;
              const ev = JSON.parse(raw.slice(5)) as {
                t?: string;
                done?: {
                  kind: string; lang: Lang; action?: string; fun?: boolean;
                  silent?: boolean; profile_update?: { name?: string | null };
                };
              };
              if (typeof ev.t === "string" && ev.t) {
                full += ev.t;
                setStreamText(full);
                pending += ev.t;
                const parts = pending.match(/[^.!?।\n]+[.!?।]+|[^.!?।\n]+$/g) || [];
                if (parts.length > 1) {
                  // all but last are complete sentences → speak now
                  const lang0 = activeLangRef.current;
                  for (const p of parts.slice(0, -1)) {
                    if (p.trim()) speakSentence(p.trim(), lang0);
                  }
                  pending = parts[parts.length - 1];
                }
              } else if (ev.done) {
                meta = ev.done;
              }
            }
          }
          clearTimeout(to);
          clearTimeout(ackTimer);
          if (!meta) throw new Error("empty stream");
          const lang = (["en", "hi", "gu"] as Lang[]).includes(meta.lang) ? meta.lang : useLang;
          setActiveLang(lang); activeLangRef.current = lang;
          if (meta.profile_update && "name" in meta.profile_update) {
            try {
              if (meta.profile_update.name) saveNameValue(meta.profile_update.name);
              else clearNameValue();
            } catch {}
          }
          if (meta.silent) { setStatus("idle"); setStreamText(""); restartLoop(700); return; }
          if (meta.fun) setConfettiKey((k) => k + 1);
          if (meta.action) {
            if (meta.action.startsWith("open:")) window.open(meta.action.slice(5), "_blank");
            else if (meta.action.startsWith("timer:")) {
              const secs = parseInt(meta.action.slice(6), 10);
              if (pending.trim()) speakSentence(pending.trim(), lang);
              if (full.trim()) {
                setChat((cc) => [...cc, { from: "veda", text: full.trim(), lang }]);
                lastSpokenRef.current = full.trim();
              }
              setStreamText("");
              setTimeout(() => speak(timerDoneText(lang), lang), secs * 1000);
              return;
            } else if (meta.action.startsWith("search:")) {
              window.open(`https://www.google.com/search?q=${encodeURIComponent(meta.action.slice(7))}`, "_blank");
            }
          }
          if (pending.trim()) speakSentence(pending.trim(), lang);
          if (!timeMarks.current.firstToken) {
            timeMarks.current.firstToken = performance.now();
            setTimings(computeTimings());
          }
          if (full.trim()) {
            setChat((cc) => [...cc, { from: "veda", text: full.trim(), lang }]);
            lastSpokenRef.current = full.trim();
          } else if (!acked) {
            setStatus("idle");
            restartLoop(700);
          }
          setStreamText("");
          return;
        } catch {
          clearTimeout(ackTimer);
          setStreamText("");
          // backend down → fall through to offline brain
        }
      }
      // 3) offline brain (wikipedia / weather / dictionary / search)
      timeMarks.current.brainStart = performance.now();
      const { text: reply, action, timerSeconds, lang, fun } = await getVedaReply(text);
      timeMarks.current.firstToken = performance.now();
      setTimings(computeTimings());
      setActiveLang(lang); activeLangRef.current = lang;
      if (action) window.open(action, "_blank");
      if (fun) setConfettiKey((k) => k + 1);
      if (timerSeconds) {
        speak(reply, lang);
        const doneMsg = timerDoneText(lang);
        setTimeout(() => speak(doneMsg, lang), timerSeconds * 1000);
        return;
      }
      setStatus("idle");
      setTimeout(() => speak(reply, lang), 250);
    } catch {
      setStatus("idle");
      speak("Sorry, something went wrong. Please ask again.", "en");
    }
  }, [speak, pumpQueue, stopAllAudio]);

  const listen = useCallback(() => {
    if (blockedRef.current || !handsFreeRef.current) return;
    if (listeningRef.current || statusRef.current === "speaking" || statusRef.current === "thinking") return;
    const SR = (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;
    if (!SR) { setMicError("Voice not supported. Please use Chrome."); return; }
    try {
      const rec = new SR();
      const recLang = cfgRef.current.recLang === "auto" ? REC_CODE[activeLangRef.current] : REC_CODE[cfgRef.current.recLang as Lang];
      rec.lang = recLang;
      rec.interimResults = true; // live captions while talking (also lowers perceived latency)
      rec.maxAlternatives = 1;
      rec.onstart = () => {
        listeningRef.current = true;
        setStatus("listening"); setAudioLevel(0.5); setMicState("ready"); setMicError("");
        setInterim("");
        timeMarks.current = { listenStart: performance.now(), sttEnd: 0, brainStart: 0, firstToken: 0, speakStart: 0 };
      };
      rec.onresult = (e: any) => {
        let interimTxt = "";
        let finalTxt = "";
        let confSum = 0, confN = 0;
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript as string;
          const cf = e.results[i][0]?.confidence;
          if (typeof cf === "number" && cf > 0) { confSum += cf; confN++; }
          if (e.results[i].isFinal) finalTxt += t;
          else interimTxt += t;
        }
        if (interimTxt && !finalTxt) setInterim(interimTxt);
        if (!finalTxt) return;
        const txt = finalTxt;
        listeningRef.current = false;
        setStatus("idle"); setAudioLevel(0); setInterim("");
        timeMarks.current.sttEnd = performance.now();
        const clean = txt.trim();
        if (!clean) { restartLoop(400); return; }
        // ignore our own voice echoing back through the mic (hello-hello loop fix)
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u0900-\u097F\u0A80-\u0AFF ]/g, " ").replace(/\s+/g, " ").trim();
        const heard = norm(clean);
        const said = norm(lastSpokenRef.current || "");
        const dup = heard.length > 0 && heard === norm(lastHeardRef.current || "");
        const echo = heard.length > 3 && said.length > 3 && (said.includes(heard) || heard.includes(said));
        const tooSoon = Date.now() - speakEndRef.current < 1500;
        if (echo || (dup && tooSoon)) { restartLoop(900); return; }
        lastHeardRef.current = clean;
        handleUserText(clean, confN ? confSum / confN : 1);
      };
      rec.onerror = (e: any) => {
        listeningRef.current = false;
        if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
          blockedRef.current = true;
          setMicState("denied");
          setMicError("Microphone blocked. Allow mic access, then press RETRY MIC.");
          setStatus("idle"); return;
        }
        setStatus("idle"); setAudioLevel(0);
        restartLoop(1200);
      };
      rec.onend = () => {
        listeningRef.current = false;
        if (statusRef.current !== "idle") return;
        if (blockedRef.current || !handsFreeRef.current) return;
        restartLoop(700);
      };
      rec.start();
    } catch { listeningRef.current = false; restartLoop(1500); }
  }, [handleUserText, restartLoop]);

  const micCtxRef = useRef<AudioContext | null>(null);
  const micPumpRef = useRef<NodeJS.Timeout | null>(null);

  // real mic level → drives the sphere while listening (bus, no re-renders)
  const attachMic = useCallback((stream: MediaStream) => {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!micCtxRef.current) micCtxRef.current = new AC();
      const actx = micCtxRef.current;
      void actx.resume().catch(() => {});
      const src = actx.createMediaStreamSource(stream);
      const an = actx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      audioBus.micAnalyser = an;
      const buf = new Uint8Array(an.fftSize);
      if (micPumpRef.current) clearInterval(micPumpRef.current);
      micPumpRef.current = setInterval(() => {
        try {
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          audioBus.micLevel = Math.min(1, Math.sqrt(sum / buf.length) * 3.2);
        } catch {}
      }, 100);
    } catch {}
  }, []);

  const retryMic = useCallback(async () => {
    setMicError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      attachMic(stream); // keep alive for live mic level
      blockedRef.current = false;
      setMicState("ready"); setMicError("");
      listen();
    } catch {
      setMicState("denied");
      setMicError("Mic still blocked: address bar na lock/mic icon → Microphone Allow → RETRY MIC dabavo.");
    }
  }, [listen]);

  // auto-boot: start talking immediately on page load, no buttons
  useEffect(() => {
    if (bootDone) return;
    bootDone = true;
    if (bootedRef.current) return;
    bootedRef.current = true;
    const nav = typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "en";
    const start: Lang = nav.startsWith("hi") ? "hi" : nav.startsWith("gu") ? "gu" : "en";
    setActiveLang(start); activeLangRef.current = start;
    try { speechSynthesis.getVoices(); } catch {}
    const unlock = () => {
      if (blockedRef.current) { blockedRef.current = false; setMicError(""); }
      unlockAudio();
      try { speechSynthesis.resume(); } catch {}
      listen();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchend", unlock);
    let saved = loadName();
    if (saved && isBadName(saved)) {
      clearNameValue();
      saved = ""; // junk like "Hello" saved as name earlier — purge it
    }
    const greet: Record<Lang, string> = saved ? {
      en: `Hey ${saved}! I am Veda. Good to hear you again. How can I help you?`,
      hi: `Hey ${saved}! Mera naam Veda hai. Aapko phir se sunkar khushi hui. Kahiye, kya madad karu?`,
      gu: `Hey ${saved}! Maru naam Veda che. Tamne fari sambhdine anand thayo. Kaho, su madad karu?`,
    } : {
      en: "Hey! My name is Veda, your personal AI. What is your name?",
      hi: "Hey! Mera naam Veda hai, aapka niji AI sahayak. Aapka naam kya hai?",
      gu: "Hey! Maru naam Veda che, tamaro niji AI sahayak. Tamaru naam shu che?",
    };
    pendingNameRef.current = !saved;
    // voice-listen support check (Safari = no SpeechRecognition)
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    if (!SR) {
      setMicState("unsupported");
      setMicError("Voice listening needs Chrome. Safari ma mic-vaat nahi chale — Chrome ma kholo, ke jamni baju niche type karo.");
    } else {
      // mic permission preflight — triggers the Allow prompt reliably
      (async () => {
        try {
          if (!navigator.mediaDevices?.getUserMedia) throw new Error("no-gum");
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          attachMic(stream); // keep alive for live mic level
          setMicState("ready"); setMicError("");
          listen();
        } catch {
          setMicState("denied");
          setMicError("Mic permission needed: Allow dabavo, pachhi RETRY MIC.");
        }
      })();
    }
    const t2 = setTimeout(() => speak(greet[start], start), 1500);
    // Mobile autoplay policy blocks sound before the first tap: if nothing actually
    // started sounding, stash the greeting and replay it on the first tap instead.
    const t3 = setTimeout(() => {
      if (!ttsStartedRef.current && !audioUnlockedRef.current) {
        pendingGreetRef.current = { text: greet[start], lang: start };
      }
    }, 3500);
    return () => {
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchend", unlock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastYou = [...chat].reverse().find((m) => m.from === "you");
  const lastVeda = [...chat].reverse().find((m) => m.from === "veda");

  return {
    status,
    chat,
    clock,
    handsFree,
    setHandsFree,
    micError,
    micState,
    typed,
    setTyped,
    activeLang,
    confettiKey,
    showSettings,
    setShowSettings,
    cfg,
    setCfg,
    API_BASE,
    interim,
    streamText,
    timings,
    voices,
    chatOpen,
    setChatOpen,
    unread,
    setUnread,
    lastYou,
    lastVeda,
    handleUserText,
    retryMic,
    introKey,
    setIntroKey,
    setChat,
    LANG_COLOR,
    clearName: clearNameValue,
    unlocked,
    unlockAudio,
    testVoice,
    apiOk,
  };
}
