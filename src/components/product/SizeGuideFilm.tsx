"use client";

import { useState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { SIZE_GUIDE_VIDEO } from "@/lib/presale";

export function SizeGuideFilm() {
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  return (
    <figure className="film-stage">
      <div className="film-stage-frame">
        {ready ? (
          <video
            src={SIZE_GUIDE_VIDEO.src}
            className="h-full w-full object-cover"
            controls={playing}
            playsInline
            autoPlay={playing}
            onPlay={() => setPlaying(true)}
          />
        ) : (
          <>
            <video
              src={SIZE_GUIDE_VIDEO.src}
              className="hidden"
              preload="metadata"
              onLoadedData={() => setReady(true)}
              onError={() => setReady(false)}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <BrandLogo
                variant="mark"
                className="h-10 w-10 object-contain opacity-80"
              />
              <p className="title-whisper mt-5 text-[1.35rem] text-ink/80">
                {SIZE_GUIDE_VIDEO.whisper}
              </p>
              <p className="mt-2 max-w-[16rem] text-[12px] leading-5 text-soft">
                El video se sienta aquí. Un gesto corto, bien encuadrado.
              </p>
            </div>
          </>
        )}
        {ready && !playing ? (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="film-play"
            aria-label="Reproducir guía de talla"
          >
            <span />
          </button>
        ) : null}
      </div>
      <figcaption className="mt-3 flex items-baseline justify-between gap-4">
        <span className="kicker">{SIZE_GUIDE_VIDEO.caption}</span>
        <span className="text-[12px] text-soft">El precio no cambia</span>
      </figcaption>
    </figure>
  );
}
