"use client";
import ParticleSphere from "@/views/ParticleSphere";
import SpaceDrift from "@/views/SpaceDrift";
import { useVedaController } from "@/controllers/useVedaController";
import type { Cfg } from "@/models/store";

export default function Home() {
  const v = useVedaController();
  const { status, chat, handsFree, setHandsFree, micState, typed, setTyped,
    confettiKey, showSettings, setShowSettings, cfg, setCfg, API_BASE,
    timings, voices, chatOpen, setChatOpen, unread, setUnread,
    handleUserText, retryMic, introKey, setIntroKey, setChat, clearName,
    testVoice, apiOk } = v;
  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#05030f] text-slate-200">
      <SpaceDrift />
      {/* aurora blobs */}
      <div className="aurora a1" /><div className="aurora a2" /><div className="aurora a3" />

      {/* confetti burst on jokes */}
      {confettiKey > 0 && (
        <div key={confettiKey} className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
          {Array.from({ length: 48 }).map((_, i) => (
            <span key={i} className="confetti" style={{
              left: `${(i * 37) % 100}%`,
              background: ["#22d3ee", "#fb923c", "#4ade80", "#e879f9", "#facc15"][i % 5],
              animationDelay: `${(i % 12) * 0.06}s`,
            }} />
          ))}
        </div>
      )}

      {/* TOP BAR — removed: fullscreen sphere mode (git history ma safe che) */}

      {/* SETTINGS DRAWER */}
      {showSettings && (
        <div className="absolute right-4 top-16 z-40 w-[320px] max-w-[92vw] rounded-2xl border border-white/15 bg-[#0a0618]/95 p-4 shadow-[0_0_50px_rgba(0,0,0,.7)] backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-black tracking-[0.25em] text-white">⚙ PRODUCTION SETTINGS</span>
            <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <label className="mb-1 block text-[11px] text-slate-400">Backend Brain (FastAPI + tools + cloud LLM)</label>
          <button onClick={() => setCfg((c) => ({ ...c, cloud: !c.cloud }))}
            className={`mb-3 w-full rounded-xl py-2 text-xs font-black ${cfg.cloud ? "bg-gradient-to-r from-fuchsia-400 to-cyan-300 text-black" : "bg-white/10 text-white"}`}>
            {cfg.cloud ? "☁ BACKEND ON" : "📴 BACKEND OFF (offline brain)"}
          </button>
          <div className="mb-3 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-[11px] text-slate-400">
            API: <span className="font-mono text-slate-200">{API_BASE}</span><br />
            {cfg.cloud
              ? (apiOk === null ? "⏳ backend check thay che…"
                : apiOk ? "● BACKEND ONLINE — smart javab malse"
                : "○ BACKEND OFFLINE — Vercel ma NEXT_PUBLIC_VEDA_API=/ ane OPENROUTER_API_KEY set karo, nahi to offline brain javab apse")
              : "📴 offline brain — smart javab mate BACKEND ON karo"}
            <br />Key server na <span className="font-mono">backend/.env</span> ma — browser ma key nathi.
          </div>
          <label className="mb-1 block text-[11px] text-slate-400">Voice speed: {cfg.rate.toFixed(2)}x</label>
          <input type="range" min={0.8} max={1.5} step={0.05} value={cfg.rate}
            onChange={(e) => setCfg((c) => ({ ...c, rate: parseFloat(e.target.value) }))}
            className="mb-3 w-full" />
          <label className="mb-1 block text-[11px] text-slate-400">Voice</label>
          <select value={cfg.voiceURI} onChange={(e) => setCfg((c) => ({ ...c, voiceURI: e.target.value }))}
            className="mb-3 w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs text-white outline-none">
            <option value="">Auto (best per language)</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>{v.name} — {v.lang}</option>
            ))}
          </select>
          <label className="mb-1 block text-[11px] text-slate-400">Listen language</label>
          <select value={cfg.recLang} onChange={(e) => setCfg((c) => ({ ...c, recLang: e.target.value as Cfg["recLang"] }))}
            className="mb-3 w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs text-white outline-none">
            <option value="auto">Auto (follows reply)</option>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="gu">Gujarati</option>
          </select>
          <label className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
            Debug timings
            <button onClick={() => setCfg((c) => ({ ...c, debug: !c.debug }))}
              className={`rounded-full px-3 py-1 text-[10px] font-black ${cfg.debug ? "bg-amber-300 text-black" : "bg-white/10 text-white"}`}>
              {cfg.debug ? "ON" : "OFF"}
            </button>
          </label>
          <div className="flex gap-2">
            <button onClick={() => { clearName(); setChat([]); }} className="flex-1 rounded-xl bg-white/10 py-2 text-[11px] font-bold hover:bg-white/20">Forget name</button>
            <button onClick={() => setChat([])} className="flex-1 rounded-xl bg-white/10 py-2 text-[11px] font-bold hover:bg-white/20">Clear chat</button>
          </div>
          <button onClick={testVoice} className="mt-2 w-full rounded-xl bg-gradient-to-r from-cyan-300 to-fuchsia-400 py-2 text-[11px] font-black text-black">🔊 TEST VOICE — AVAAJ CHECK KARO</button>
          <button onClick={() => setIntroKey((k) => k + 1)} className="mt-2 w-full rounded-xl bg-white/10 py-2 text-[11px] font-bold hover:bg-white/20">✨ Replay sphere intro</button>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Backend off hoy to badhu offline brain par chalse.</p>
        </div>
      )}

      {/* DEBUG TIMINGS */}
      {cfg.debug && timings && (
        <div className="fixed bottom-3 left-3 z-40 rounded-xl border border-amber-300/30 bg-black/85 px-3 py-2 font-mono text-[10px] leading-relaxed text-amber-200 backdrop-blur">
          <div>STT {timings.stt}ms • BRAIN {timings.brain}ms • TTS {timings.tts}ms</div>
          <div className={timings.total <= 1500 ? "font-bold text-emerald-300" : "font-bold text-rose-300"}>
            FIRST AUDIO {timings.total}ms (target ≤1500ms)
          </div>
        </div>
      )}

      {/* FIRST-TAP voice unlock overlay — removed: fullscreen mode, silent auto-unlock on first gesture */}

      {/* MAIN STAGE — fullscreen sphere */}
      <main className="z-10 flex flex-1 overflow-hidden p-0">
        <section id="stage" className="relative flex flex-1 flex-col overflow-hidden bg-black/60">
          <div className="absolute inset-0">
            <ParticleSphere state={status === "thinking" ? "thinking" : status === "speaking" ? "speaking" : status === "listening" ? "listening" : "idle"} introKey={introKey} />
          </div>

          {/* mic help banner — only when voice can't start */}
          {(micState === "denied" || micState === "unsupported") && (
            <div className="absolute left-1/2 top-12 z-20 w-[92%] max-w-md -translate-x-1/2 rounded-2xl border border-rose-400/40 bg-[#1a0a12]/90 p-4 text-center shadow-[0_0_40px_rgba(244,63,94,.3)] backdrop-blur">
              <div className="text-sm font-black text-rose-200">🎤 MIC {micState === "unsupported" ? "NOT SUPPORTED" : "BLOCKED"}</div>
              <div className="mt-1 text-xs leading-relaxed text-slate-300">
                {micState === "unsupported"
                  ? "Aa browser (Safari) ma voice-listening nathi. Chrome ma kholo: http://127.0.0.1:3000"
                  : "Mic permission apo: address-bar na lock/mic icon → Microphone Allow → pachhi niche RETRY dabavo."}
              </div>
              {micState === "denied" && (
                <button onClick={retryMic} className="mt-3 rounded-xl bg-gradient-to-r from-emerald-300 to-cyan-300 px-6 py-2 text-xs font-black text-black">🔄 RETRY MIC</button>
              )}
              <div className="mt-2 text-[11px] text-slate-400">Bolvu na hoy to jamni baju niche type pan kari sako cho.</div>
            </div>
          )}

          {/* live captions — removed: fullscreen sphere mode (git history ma safe che) */}
        </section>

        {/* FLOATING CHAT WIDGET */}
        <button
          onClick={() => { setChatOpen(true); setUnread(false); }}
          aria-label="Open chat"
          className={`fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-fuchsia-400 text-2xl text-black shadow-[0_0_30px_rgba(34,211,238,.5)] transition hover:scale-105 ${chatOpen ? "hidden" : ""}`}>
          💬
          {unread && <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-black bg-rose-500" />}
        </button>
        {chatOpen && (
        <aside className="fixed bottom-24 right-4 z-40 flex max-h-[70vh] w-[330px] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0a0618]/95 shadow-[0_0_50px_rgba(0,0,0,.7)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <span className="text-[11px] font-black tracking-[0.3em] text-white">🎧 VEDA CHAT</span>
            <div className="flex items-center gap-2">
            <button onClick={() => setChat([])} title="Clear chat"
              className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black hover:bg-white/20">🗑</button>
            <button
              onClick={() => { const v = !handsFree; setHandsFree(v); }}
              className={`rounded-full px-3 py-1 text-[10px] font-black ${handsFree ? "bg-gradient-to-r from-emerald-300 to-cyan-300 text-black" : "bg-white/10 text-white"}`}>
              {handsFree ? "HANDS-FREE ON" : "HANDS-FREE OFF"}
            </button>
            <button onClick={() => setChatOpen(false)} title="Close chat"
              className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black hover:bg-white/20">✕</button>
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3 text-[13px]">
            {chat.length === 0 && <div className="text-xs leading-relaxed text-slate-500">Just speak — I am listening!<br />• “What is the time”<br />• “Samay kya hai”<br />• “Atyare ketla vagya”<br />• “Mera naam Rahul hai”<br />• “Maru naam Dhruv che”</div>}
            {chat.map((m, i) => (
              <div key={i} className={m.from === "you" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[92%] rounded-2xl px-4 py-2.5 leading-relaxed ${m.from === "you" ? "rounded-br-sm bg-gradient-to-br from-cyan-300 to-fuchsia-400 font-medium text-black" : "rounded-bl-sm border border-white/10 bg-white/5 text-slate-100"}`}>
                  <div className="mb-0.5 text-[9px] font-black tracking-[0.25em] opacity-70">
                    {m.from === "you" ? "YOU" : "VEDA"}
                  </div>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 p-2">
            <div className="flex gap-2">
              <input value={typed} onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && typed.trim()) { handleUserText(typed); setTyped(""); } }}
                placeholder="…or type here"
                className="flex-1 rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none" />
              <button onClick={() => { if (typed.trim()) { handleUserText(typed); setTyped(""); } }} className="rounded-xl bg-white/15 px-3 text-sm font-black text-white">➤</button>
            </div>
          </div>
        </aside>
        )}
      </main>
    </div>
  );
}
