"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type PointerEvent } from "react";

type Film = "wait" | "ready" | "missing";

export type PhoneFilmHandle = {
  expand: () => void;
};

export const PhoneFilm = forwardRef<PhoneFilmHandle, { src: string; label: string }>(function PhoneFilm(
  { src, label },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [film, setFilm] = useState<Film>("wait");
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [progress, setProgress] = useState(0);
  const filmRef = useRef(film);
  filmRef.current = film;

  useImperativeHandle(ref, () => ({
    expand() {
      const video = videoRef.current;
      if (!video) return;
      const ios = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
      if (typeof ios.webkitEnterFullscreen === "function") {
        ios.webkitEnterFullscreen();
        return;
      }
      if (video.requestFullscreen) void video.requestFullscreen().catch(() => {});
    },
  }));

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const markReady = () => setFilm("ready");
    const markMissing = () => setFilm((current) => (current === "ready" ? current : "missing"));
    video.addEventListener("loadeddata", markReady);
    video.addEventListener("error", markMissing);
    if (video.readyState >= 2) markReady();
    else if (video.error) markMissing();
    return () => {
      video.removeEventListener("loadeddata", markReady);
      video.removeEventListener("error", markMissing);
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
      const video = videoRef.current;
      if (!video || filmRef.current !== "ready") return;
      if (event.code === "Space") {
        event.preventDefault();
        playOrPause(video);
      } else if (event.key === "ArrowRight") {
        video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
      } else if (event.key === "ArrowLeft") {
        video.currentTime = Math.max(0, video.currentTime - 5);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function playOrPause(video: HTMLVideoElement) {
    if (video.ended) video.currentTime = 0;
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
  }

  function toggle() {
    const video = videoRef.current;
    if (!video || film !== "ready") return;
    playOrPause(video);
  }

  function scrubTo(event: PointerEvent<HTMLDivElement>) {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    video.currentTime = ratio * video.duration;
  }

  function onScrubDown(event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    scrubTo(event);
  }

  function onScrubMove(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    scrubTo(event);
  }

  const started = progress > 0.004 || ended;
  const showScrub = film === "ready" && (playing || started);
  const action = ended ? `Ver de nuevo ${label}` : started ? `Reanudar ${label}` : `Reproducir ${label}`;
  const hint = film === "missing" ? "No se pudo abrir el video." : film === "ready" && !playing && !started ? "Toca para verlo." : "";

  return (
    <div className="uso-stage">
      <div className="uso-lift">
        <div className="uso-phone">
          <span className="uso-key uso-key-silent" />
          <span className="uso-key uso-key-up" />
          <span className="uso-key uso-key-down" />
          <span className="uso-key uso-key-power" />
          <div className="uso-bezel">
            <div
              className="uso-screen"
              data-ready={film === "ready" ? "true" : "false"}
              data-playing={playing ? "true" : "false"}
              onClick={toggle}
            >
              <video
                ref={videoRef}
                className="uso-video"
                data-on={film === "ready" ? "true" : "false"}
                src={src}
                playsInline
                preload="auto"
                disablePictureInPicture
                onLoadedData={() => setFilm("ready")}
                onError={() => setFilm("missing")}
                onPlay={() => {
                  setPlaying(true);
                  setEnded(false);
                }}
                onPause={() => setPlaying(false)}
                onEnded={() => {
                  setPlaying(false);
                  setEnded(true);
                  setProgress(1);
                }}
                onTimeUpdate={(event) => {
                  const video = event.currentTarget;
                  if (!video.duration) return;
                  setProgress(video.currentTime / video.duration);
                }}
              />

              <div className="uso-wait" data-hide={film === "ready" ? "true" : "false"}>
                <span className="uso-sheen" />
                <span className="uso-island" />
                <img className="uso-mark" src="/descargas/icon.png" alt="" width={96} height={96} draggable={false} />
                <span className="uso-home" />
              </div>

              {film === "ready" ? (
                <button
                  type="button"
                  className="uso-play"
                  aria-label={playing ? `Pausar ${label}` : action}
                  tabIndex={playing ? -1 : 0}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggle();
                  }}
                >
                  {ended ? <ReplayGlyph /> : <PlayGlyph />}
                </button>
              ) : null}

              {showScrub ? (
                <div
                  className="uso-scrub"
                  role="slider"
                  aria-label={`Avance de ${label}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress * 100)}
                  tabIndex={0}
                  onPointerDown={onScrubDown}
                  onPointerMove={onScrubMove}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    const video = videoRef.current;
                    if (!video || !video.duration) return;
                    if (event.key === "ArrowRight") video.currentTime = Math.min(video.duration, video.currentTime + 5);
                    if (event.key === "ArrowLeft") video.currentTime = Math.max(0, video.currentTime - 5);
                  }}
                >
                  <span className="uso-scrub-track">
                    <span className="uso-scrub-fill" style={{ width: `${progress * 100}%` }} />
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <p className="uso-hint" role="status">
        {hint || "\u00a0"}
      </p>
    </div>
  );
});

function PlayGlyph() {
  return (
    <svg className="uso-glyph uso-glyph-play" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.8 6.6v10.8L18 12 8.8 6.6z" fill="currentColor" />
    </svg>
  );
}

function ReplayGlyph() {
  return (
    <svg className="uso-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 5.5V3L7.2 6.8 12 10.6V8a5.2 5.2 0 1 1-4.9 6.8l-2.3.7A7.7 7.7 0 1 0 12 5.5z"
        fill="currentColor"
      />
    </svg>
  );
}
