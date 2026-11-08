"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reproductor de notas de voz del CRM.
 *
 * WhatsApp manda los audios como `audio/ogg; codecs=opus`. Chrome y Firefox lo
 * reproducen tal cual; Safari (iPhone, Mac y el WKWebView de Super Admin) no
 * abre el contenedor Ogg, así que cuando el navegador no puede, se decodifica
 * en el cliente con un decoder Opus en WebAssembly y se reproduce como WAV.
 */

const SPEEDS = [1, 1.5, 2] as const;

type Phase = "preparing" | "ready" | "failed";

export function CrmVoiceNote({ blob, mimeType }: { blob: Blob; mimeType?: string }) {
  const [src, setSrc] = useState("");
  const [phase, setPhase] = useState<Phase>("preparing");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let url = "";
    let cancelled = false;
    const mime = mimeType || blob.type || "audio/ogg";
    (async () => {
      const playable = canPlayNatively(mime) ? blob : await transcodeOggOpusToWav(blob);
      if (cancelled) return;
      if (!playable) throw new Error("undecodable");
      url = URL.createObjectURL(playable);
      setSrc(url);
      setPhase("ready");
    })().catch(() => {
      if (cancelled) return;
      // Sin reproductor posible: al menos que se pueda bajar el archivo original.
      url = URL.createObjectURL(blob);
      setSrc(url);
      setPhase("failed");
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [blob, mimeType]);

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = speed;
  }, [speed, src]);

  function toggle() {
    const el = audio.current;
    if (!el) return;
    if (el.paused) {
      void el.play().catch(() => setPhase("failed"));
    } else {
      el.pause();
    }
  }

  function seek(event: React.ChangeEvent<HTMLInputElement>) {
    const el = audio.current;
    const next = Number(event.target.value);
    setTime(next);
    if (el && Number.isFinite(next)) el.currentTime = next;
  }

  function cycleSpeed() {
    const index = SPEEDS.indexOf(speed);
    setSpeed(SPEEDS[(index + 1) % SPEEDS.length]);
  }

  if (phase === "failed") {
    return (
      <a href={src || undefined} download="nota-de-voz.ogg" className="crm-media-file">
        <span className="crm-media-file-icon" aria-hidden>
          ⬇
        </span>
        <span className="min-w-0">
          <span className="block truncate">Nota de voz</span>
          <span className="block text-[10px] opacity-60">No se pudo reproducir aquí · Descargar</span>
        </span>
      </a>
    );
  }

  const total = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const progress = total ? Math.min(100, (time / total) * 100) : 0;

  return (
    <div className={`crm-voice ${phase === "preparing" ? "is-preparing" : ""}`}>
      {src ? (
        <audio
          ref={audio}
          src={src}
          preload="metadata"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setTime(0);
          }}
          onError={() => setPhase("failed")}
        />
      ) : null}
      <button
        type="button"
        onClick={toggle}
        disabled={phase !== "ready"}
        className="crm-voice-btn"
        aria-label={playing ? "Pausar" : "Reproducir nota de voz"}
      >
        {phase !== "ready" ? <span className="crm-voice-spin" aria-hidden /> : playing ? <PauseGlyph /> : <PlayGlyph />}
      </button>
      <div className="crm-voice-body">
        <input
          type="range"
          min={0}
          max={total || 1}
          step={0.05}
          value={Math.min(time, total || 1)}
          onChange={seek}
          disabled={!total}
          className="crm-voice-range"
          style={{ ["--p" as string]: `${progress}%` }}
          aria-label="Posición"
        />
        <div className="crm-voice-meta">
          <span>{phase === "preparing" ? "Preparando…" : formatTime(playing || time > 0 ? time : total)}</span>
          <button type="button" onClick={cycleSpeed} className="crm-voice-speed" aria-label="Velocidad">
            {speed}×
          </button>
        </div>
      </div>
    </div>
  );
}

function canPlayNatively(mime: string) {
  if (typeof document === "undefined") return true;
  const probe = document.createElement("audio");
  const base = mime.split(";")[0].trim();
  return Boolean(probe.canPlayType(mime) || probe.canPlayType(base));
}

async function transcodeOggOpusToWav(blob: Blob): Promise<Blob | null> {
  const { OggOpusDecoder } = await import("ogg-opus-decoder");
  const decoder = new OggOpusDecoder();
  await decoder.ready;
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const decoded = await decoder.decodeFile(bytes);
    if (!decoded.samplesDecoded) return null;
    return encodeWav(decoded.channelData, decoded.samplesDecoded, decoded.sampleRate);
  } finally {
    decoder.free();
  }
}

function encodeWav(channels: Float32Array[], frames: number, sampleRate: number): Blob {
  const channelCount = Math.max(1, channels.length);
  const blockAlign = channelCount * 2;
  const dataSize = frames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < frames; i += 1) {
    for (let c = 0; c < channelCount; c += 1) {
      const sample = Math.max(-1, Math.min(1, channels[c]?.[i] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.round(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function PlayGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.5v13a1 1 0 0 0 1.53.85l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}

function PauseGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}
