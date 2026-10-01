"use client";
import ParticleSphere from "@/views/ParticleSphere";
import SpaceDrift from "@/views/SpaceDrift";
import { useVedaController, LANG_COLOR } from "@/controllers/useVedaController";
import type { Cfg } from "@/models/store";

export default function Home() {
  const v = useVedaController();
  const { status, chat, clock, handsFree, setHandsFree, micError, micState, typed, setTyped,
    confettiKey, showSettings, setShowSettings, cfg, setCfg, API_BASE, interim, streamText,
    timings, voices, chatOpen, setChatOpen, unread, setUnread, lastYou, lastVeda,
    handleUserText, retryMic, introKey, setIntroKey, setChat, clearName,
    unlocked, unlockAudio, testVoice } = v;
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

      {/* TOP BAR */}
      <header className="z-10 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/40 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-400 via-cyan-300 to-emerald-300 font-black text-black shadow-[0_0_30px_#e879f9]">V</div>
          <div>
            <div className="bg-gradient-to-r from-cyan-200 via-fuchsia-200 to-amber-200 bg-clip-text text-sm font-black tracking-[0.3em] text-transparent">VEDA VOICE CORE</div>
            <div className="text-[10px] tracking-widest text-slate-400">JUST SPEAK • I REPLY</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-white">{clock}</span>
          <span className={`rounded-full border px-3 py-1 text-[10px] font-black tracking-widest ${cfg.cloud ? "border-fuchsia-300/50 bg-fuchsia-400/15 text-fuchsia-200" : "border-white/10 bg-white/5 text-slate-400"}`}>
            {cfg.cloud ? "☁ BACKEND BRAIN" : "📴 LOCAL BRAIN"}
          </span>
          <span className="flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[11px] font-bold">
            <span className={`h-2 w-2 rounded-full ${status === "speaking" ? "bg-amber-400" : status === "listening" ? "bg-rose-500 animate-pulse" : status === "thinking" ? "bg-violet-400 animate-pulse" : "bg-emerald-400"}`} />
            {status.toUpperCase()}
          </span>
          <button onClick={() => setShowSettings(!showSettings)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm hover:bg-white/15">⚙</button>
        </div>
      </header>

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
            Key server na <span className="font-mono">backend/.env</span> ma — browser ma key nathi.
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

      {/* FIRST-TAP voice unlock — mobile blocks all sound before a user gesture */}
      {!unlocked && (
        <div onClick={unlockAudio} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-fuchsia-300/30 bg-[#0a0618] p-6 text-center shadow-[0_0_60px_rgba(232,121,249,.35)]">
            <div className="text-5xl">🔊</div>
            <div className="mt-3 text-lg font-black text-white">TAP TO START VEDA</div>
            <div className="mt-1 text-xs leading-relaxed text-slate-400">
              Phone browser avaaj mate ek tap mange che.<br />Tap karo — pachhi Veda bolshe.
            </div>
            <button onClick={unlockAudio} className="mt-4 w-full rounded-2xl bg-gradient-to-r from-cyan-300 to-fuchsia-400 py-3 text-sm font-black text-black">🎙 START — AVAAJ CHALU KARO</button>
          </div>
        </div>
      )}

      {/* MAIN STAGE */}
      <main className="z-10 grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4">
        <section id="stage" className="relative flex min-h-[420px] flex-col overflow-hidden rounded-[2rem] border border-fuchsia-300/20 bg-black/60 shadow-[0_0_90px_rgba(232,121,249,.18)]">
          <div className="absolute inset-0">
            <ParticleSphere state={status === "thinking" ? "thinking" : status === "speaking" ? "speaking" : status === "listening" ? "listening" : "idle"} introKey={introKey} />
          </div>
          <div className="pointer-events-none absolute left-5 top-4 text-[10px] tracking-[0.3em] text-white/60">PLASMA SPHERE</div>

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

          {/* live captions */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-6 pt-16 text-center">
            <div>
              <div className="flex items-center justify-center gap-2 text-xs font-black tracking-[0.3em]">
                <span className={`h-2.5 w-2.5 rounded-full ${status === "listening" ? "bg-rose-500 animate-ping" : status === "speaking" || status === "thinking" ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
                <span className="text-white">
                  {status === "listening" ? "LISTENING — SPEAK NOW" : status === "speaking" ? "VEDA SPEAKING…" : status === "thinking" ? "THINKING…" : "LIVE • JUST SPEAK!"}
                </span>
              </div>
              {micError && <div className="mt-2 text-xs font-bold text-rose-400">{micError}</div>}
              {lastYou && <div className="mx-auto mt-3 max-w-xl rounded-2xl border border-white/10 bg-black/60 px-4 py-2 text-base font-bold text-white">“{lastYou.text}”</div>}
              {status === "listening" && interim && (
                <div className="mx-auto mt-2 max-w-xl text-sm italic text-cyan-200/80">“{interim}…”</div>
              )}
              {streamText && (
                <div className="mx-auto mt-2 max-w-xl text-sm text-slate-200"><span className="font-black text-fuchsia-300">VEDA: </span>{streamText}</div>
              )}
              {lastVeda && <div className="mx-auto mt-2 max-w-xl text-sm text-slate-200"><span className="font-black" style={{ color: LANG_COLOR[lastVeda.lang || "en"] }}>VEDA: </span>{lastVeda.text}</div>}
            </div>
          </div>
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
