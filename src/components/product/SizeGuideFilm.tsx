"use client";

import { useEffect, useRef, useState } from "react";
import { SIZE_GUIDE_VIDEO } from "@/lib/presale";

function clock(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const total = Math.floor(value);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function SizeGuideFilm() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bar, setBar] = useState(true);

  useEffect(() => {
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);

  function armBar(nextPlaying: boolean) {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    setBar(true);
    if (!nextPlaying) return;
    hideTimer.current = window.setTimeout(() => setBar(false), 2200);
  }

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      armBar(true);
    } else {
      video.pause();
      armBar(false);
    }
  }

  function seek(next: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = next;
    setTime(next);
    armBar(!video.paused);
  }

  function fullscreen() {
    const video = videoRef.current;
    if (!video) return;
    const ios = video as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
      webkitSupportsFullscreen?: boolean;
    };
    if (typeof ios.webkitEnterFullscreen === "function") {
      video.setAttribute("controls", "true");
      const end = () => {
        video.removeAttribute("controls");
        video.removeEventListener("webkitendfullscreen", end);
      };
      video.addEventListener("webkitendfullscreen", end);
      ios.webkitEnterFullscreen();
      return;
    }
    const frame = video.parentElement;
    if (frame && frame.requestFullscreen) void frame.requestFullscreen();
    else void video.requestFullscreen();
  }

  const span = duration || 0;
  const pct = span > 0 ? Math.min(100, (time / span) * 100) : 0;

  return (
    <div className="size-player">
      <video
        ref={videoRef}
        src={SIZE_GUIDE_VIDEO.src}
        poster={SIZE_GUIDE_VIDEO.poster}
        playsInline
        preload="metadata"
        className="size-player-video"
        onPlay={() => {
          setPlaying(true);
          armBar(true);
        }}
        onPause={() => {
          setPlaying(false);
          armBar(false);
        }}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onClick={toggle}
      />

      {bar || !playing ? (
        <div className="size-player-bar">
          <button type="button" className="size-player-btn" aria-label={playing ? "Pausa" : "Reproducir"} onClick={toggle}>
            {playing ? <PauseMark /> : <PlayMark />}
          </button>
          <label className="size-player-scrub">
            <span className="size-player-track" aria-hidden>
              <span style={{ width: `${pct}%` }} />
            </span>
            <span className="size-player-thumb" style={{ left: `${pct}%` }} aria-hidden />
            <input
              type="range"
              min={0}
              max={span || 0}
              step={0.05}
              value={Math.min(time, span || 0)}
              aria-label="Momento del video"
              onChange={(event) => seek(Number(event.target.value))}
            />
          </label>
          <span className="size-player-time">{clock(time)}</span>
          <button type="button" className="size-player-btn" aria-label="Pantalla completa" onClick={fullscreen}>
            <FullMark />
          </button>
        </div>
      ) : (
        <button type="button" className="size-player-wake" aria-label="Mostrar controles" onClick={() => armBar(true)} />
      )}

      {!playing ? (
        <button type="button" className="size-player-play" aria-label="Reproducir" onClick={toggle}>
          <PlayMark large />
        </button>
      ) : null}
    </div>
  );
}

function PlayMark({ large = false }: { large?: boolean }) {
  const size = large ? 28 : 18;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M8.2 5.4v13.2L19 12 8.2 5.4Z" fill="currentColor" />
    </svg>
  );
}

function PauseMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M7 5h3.2v14H7V5Zm6.8 0H17v14h-3.2V5Z" fill="currentColor" />
    </svg>
  );
}

function FullMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 5H5v4M15 5h4v4M19 15v4h-4M5 15v4h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
