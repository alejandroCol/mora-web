"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";

const HOLO_WEBM = "/videos/medidor-holo.webm?v=2";
const HOLO_HEVC = "/videos/medidor-holo.mov?v=2";
const FRAME_W = 720;
const FRAME_H = 1176;

type Phase = "off" | "forming" | "live" | "leaving";

function holoSrc() {
  const ua = navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const safari =
    /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|FxiOS|Firefox/i.test(ua);
  return iOS || safari ? HOLO_HEVC : HOLO_WEBM;
}

function place(anchor: DOMRect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = anchor.left + anchor.width / 2;
  const base = anchor.top + anchor.height / 2;
  const aspect = FRAME_W / FRAME_H;
  let height = Math.min(vh * 0.58, 520, Math.max(180, base - 52)) * 0.25;
  let width = height * aspect;
  if (width > vw - 24) {
    width = vw - 24;
    height = width / aspect;
  }
  const gap = 14 + height * 0.1;
  let top = base - height - gap;
  if (top < 64) {
    height = Math.max(72, base - gap - 64);
    width = height * aspect;
    top = Math.max(64, base - height - gap);
  }
  let left = cx - width / 2;
  left = Math.max(14, Math.min(left, vw - width - 14));
  return { left, top, width, height, cx, base, vw, vh };
}

export function SizerHologram() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("off");
  const [shown, setShown] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const phaseRef = useRef<Phase>("off");
  const openedRef = useRef(false);
  phaseRef.current = phase;
  const active = phase !== "off";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (phase === "off") setShown(false);
  }, [phase]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(() => setPhase("off"), reduce ? 180 : 500);
    return () => window.clearTimeout(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "off") {
      openedRef.current = true;
      return;
    }
    const video = videoRef.current;
    if (video) {
      video.pause();
      if (video.src) video.currentTime = 0;
    }
    if (openedRef.current) buttonRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    if (!active) return;
    const node = buttonRef.current;
    const scroller = node?.closest(".overflow-y-auto");
    if (!(scroller instanceof HTMLElement)) return;
    const prev = scroller.style.overflowY;
    scroller.style.overflowY = "hidden";
    return () => {
      scroller.style.overflowY = prev;
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      videoRef.current?.pause();
      setPhase((current) => (current === "off" || current === "leaving" ? current : "leaving"));
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  useEffect(() => {
    if (phase !== "forming" && phase !== "live") return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const spec = document.createElement("canvas");
    spec.width = 1;
    spec.height = 11;
    const specCtx = spec.getContext("2d");
    if (specCtx) {
      specCtx.clearRect(0, 0, 1, 5);
      specCtx.fillStyle = "rgba(255,255,255,0.92)";
      specCtx.fillRect(0, 10, 1, 1);
    }
    const lines = specCtx ? ctx.createPattern(spec, "repeat") : null;
    let frame = 0;

    const paint = () => {
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (cssW < 2 || cssH < 2) {
        frame = window.requestAnimationFrame(paint);
        return;
      }
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const pw = Math.round(cssW * dpr);
      const ph = Math.round(cssH * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, pw, ph);
      if (video.readyState >= 2) {
        const now = performance.now();
        const flicker = !reduce && Math.sin(now * 0.0024) > 0.995 ? 0.78 : 1;
        ctx.globalAlpha = 0.9 * flicker;
        ctx.drawImage(video, 0, 0, pw, ph);
        ctx.globalCompositeOperation = "source-atop";
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = "rgb(198, 208, 240)";
        ctx.fillRect(0, 0, pw, ph);
        if (lines) {
          ctx.globalAlpha = 0.09;
          ctx.fillStyle = lines;
          ctx.fillRect(0, 0, pw, ph);
        }
        if (!reduce) {
          const span = ph * 0.16;
          const y = ((now * 0.08) % (ph + span * 2)) - span;
          const band = ctx.createLinearGradient(0, y, 0, y + span);
          band.addColorStop(0, "rgba(255,255,255,0)");
          band.addColorStop(0.5, "rgba(244,247,255,0.22)");
          band.addColorStop(1, "rgba(255,255,255,0)");
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = band;
          ctx.fillRect(0, y, pw, span);
        }
      }
      frame = window.requestAnimationFrame(paint);
    };

    frame = window.requestAnimationFrame(paint);
    return () => window.cancelAnimationFrame(frame);
  }, [phase]);

  function leave() {
    const video = videoRef.current;
    video?.pause();
    setPhase((current) => (current === "off" || current === "leaving" ? current : "leaving"));
  }

  function open() {
    if (phase !== "off") {
      leave();
      return;
    }
    const node = buttonRef.current;
    const video = videoRef.current;
    if (!node || !video) return;
    const rect = node.getBoundingClientRect();
    if (!video.getAttribute("src")) {
      video.src = holoSrc();
      video.load();
    } else {
      video.currentTime = 0;
    }
    flushSync(() => {
      setAnchor(rect);
      setPhase("forming");
    });
    void video.play().catch(() => setPhase("off"));
  }

  const openPhase = phase !== "off";
  const box = openPhase && anchor ? place(anchor) : null;
  const figCx = box ? box.left + box.width / 2 : 0;
  const figBottom = box ? box.top + box.height : 0;

  const stage = (
    <div
      className="holo-stage"
      data-open={openPhase}
      data-state={phase}
      data-live={shown}
      aria-hidden={openPhase ? undefined : true}
      role={openPhase ? "dialog" : undefined}
      aria-modal={openPhase ? true : undefined}
      aria-label={openPhase ? "Explicación del medidor" : undefined}
      inert={openPhase ? undefined : true}
    >
      <button ref={closeRef} type="button" className="holo-scrim" aria-label="Cerrar" onClick={leave} />
      {box ? (
        <svg className="holo-beam" viewBox={`0 0 ${box.vw} ${box.vh}`} aria-hidden>
          <defs>
            <linearGradient id="holo-beam-fill" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="0.35" stopColor="#d4daf6" stopOpacity="0.5" />
              <stop offset="1" stopColor="#d4daf6" stopOpacity="0.05" />
            </linearGradient>
            <filter id="holo-beam-blur" x="-40%" y="-20%" width="180%" height="140%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>
          <polygon
            filter="url(#holo-beam-blur)"
            fill="url(#holo-beam-fill)"
            points={`${box.cx - 7},${box.base} ${box.cx + 7},${box.base} ${figCx + box.width * 0.46},${figBottom - box.height * 0.22} ${figCx - box.width * 0.46},${figBottom - box.height * 0.22}`}
          />
        </svg>
      ) : null}
      {box ? (
        <div
          className="holo-halo"
          style={{
            left: box.left - box.width * 0.42,
            top: box.top - box.height * 0.12,
            width: box.width * 1.84,
            height: box.height * 1.14,
          }}
        />
      ) : null}
      <div
        className="holo-person"
        style={
          box
            ? { left: box.left, top: box.top, width: box.width, height: box.height }
            : undefined
        }
      >
        <video
          ref={videoRef}
          className="holo-video"
          playsInline
          preload="none"
          disablePictureInPicture
          controls={false}
          onPlaying={() => {
            if (phaseRef.current !== "forming") return;
            setShown(true);
            setPhase("live");
          }}
          onEnded={() => {
            window.setTimeout(() => {
              if (phaseRef.current === "live") leave();
            }, 260);
          }}
        />
        <canvas ref={canvasRef} className="holo-canvas" aria-hidden />
        <div className="holo-floor" />
      </div>
      {box ? <div className="holo-spark" style={{ left: box.cx, top: box.base }} /> : null}
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="size-info"
        aria-label="Ver explicación del medidor"
        aria-pressed={openPhase}
        aria-haspopup="dialog"
        onClick={open}
      >
        <svg className="size-video-mark" width="8" height="8" viewBox="0 0 8 8" aria-hidden>
          <path d="M2.05 1.1v5.8L6.75 4 2.05 1.1Z" fill="currentColor" />
        </svg>
      </button>
      {mounted ? createPortal(stage, document.body) : null}
    </>
  );
}
