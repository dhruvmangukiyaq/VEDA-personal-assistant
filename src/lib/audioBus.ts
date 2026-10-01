// Shared live-audio bus: producers (TTS playback, mic analyser,
// speechSynthesis boundary events) write here at 60fps; the orb
// (Task 2) reads without triggering React re-renders.
export const audioBus = {
  /** 0..1 voice loudness right now */
  ttsLevel: 0,
  /** 8 frequency bands 0..1 */
  ttsBands: new Array<number>(8).fill(0),
  /** 0..1 mic loudness right now */
  micLevel: 0,
  /** live analysers (Task 2 reads these directly) */
  ttsAnalyser: null as AnalyserNode | null,
  micAnalyser: null as AnalyserNode | null,
  /** word-boundary bump for speechSynthesis (no audio tap possible) */
  pulse(strength = 0.6) {
    audioBus.ttsLevel = Math.min(1, audioBus.ttsLevel + strength);
  },
};

const _freq = new Uint8Array(64);

export function pumpAnalyser(node: AnalyserNode | null, bands: number[], setLevel: (v: number) => void) {
  if (!node) return;
  node.getByteFrequencyData(_freq);
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) b += _freq[i * 8 + j] || 0;
    const v = Math.min(1, b / 8 / 160);
    bands[i] += (v - bands[i]) * 0.4;
    sum += bands[i];
  }
  setLevel(Math.min(1, sum / 8));
}

export function decayBus() {
  audioBus.ttsLevel *= 0.90;
  audioBus.micLevel *= 0.90;
  for (let i = 0; i < 8; i++) audioBus.ttsBands[i] *= 0.90;
}
