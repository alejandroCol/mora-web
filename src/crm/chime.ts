/** Timbre corto de Mora: dos notas suaves, como un toque de anillo. */

let ctx: AudioContext | null = null;
let unlocked = false;
let lastAt = 0;

function context() {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function unlockMoraChime() {
  if (unlocked) return;
  const audio = context();
  void audio.resume();
  unlocked = audio.state === "running";
}

function tone(
  audio: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  gain: number,
) {
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  const filter = audio.createBiquadFilter();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, start);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1800, start);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(filter);
  filter.connect(amp);
  amp.connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playMoraChime() {
  const now = Date.now();
  if (now - lastAt < 1400) return;
  lastAt = now;
  unlockMoraChime();
  const audio = context();
  if (audio.state !== "running") return;
  const t = audio.currentTime + 0.01;
  tone(audio, 523.25, t, 0.42, 0.07);
  tone(audio, 783.99, t + 0.11, 0.55, 0.055);
}
