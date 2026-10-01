// Model layer — domain types + API + persisted storage. No JSX here.
import type { Lang } from "./vedaBrain";

export type Status = "idle" | "listening" | "speaking" | "thinking";
export type Msg = { from: "you" | "veda"; text: string; lang?: Lang };
export type Cfg = {
  cloud: boolean;
  rate: number;
  voiceURI: string;
  recLang: Lang | "auto";
  debug: boolean;
};
export type Timings = { stt: number; brain: number; tts: number; total: number };

const _vedaApiEnv = process.env.NEXT_PUBLIC_VEDA_API;
// "/" (or "") = same-origin on Vercel services; undefined = local dev default.
export const API_BASE =
  _vedaApiEnv === undefined || _vedaApiEnv === null
    ? "http://127.0.0.1:8000"
    : _vedaApiEnv === "" || _vedaApiEnv === "/"
      ? ""
      : _vedaApiEnv.replace(/\/$/, "");

export const DEFAULT_CFG: Cfg = {
  cloud: false,
  rate: 1.1,
  voiceURI: "",
  recLang: "auto",
  debug: false,
};

export function loadCfg(): Cfg {
  try {
    const raw = localStorage.getItem("veda_cfg");
    if (raw) return { ...DEFAULT_CFG, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_CFG;
}

export function loadChat(): Msg[] {
  try {
    const raw = localStorage.getItem("veda_chat");
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.slice(-40);
    }
  } catch {}
  return [];
}

export function loadName(): string {
  try {
    return localStorage.getItem("veda_name") || "";
  } catch {
    return "";
  }
}

export function saveNameValue(name: string) {
  try {
    localStorage.setItem("veda_name", name);
  } catch {}
}

export function clearNameValue() {
  try {
    localStorage.removeItem("veda_name");
  } catch {}
}
