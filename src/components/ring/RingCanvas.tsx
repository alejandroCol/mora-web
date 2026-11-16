"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Canvas } from "@react-three/fiber";
import type { FinishId, ModelId } from "@/lib/catalog";
import { RingIntro } from "./RingIntro";

const ConfigureScene = dynamic(
  () => import("./ConfigureScene").then((mod) => mod.ConfigureScene),
  { ssr: false },
);
const RingScene = dynamic(
  () => import("./RingScene").then((mod) => mod.RingScene),
  { ssr: false },
);

type RingCanvasProps = {
  finishId?: FinishId;
  original?: boolean;
  className?: string;
  paused?: boolean;
  scale?: number;
  intro?: boolean;
  configure?: boolean;
  floatOnly?: boolean;
  modelId?: ModelId;
};

export function RingCanvas({
  finishId,
  original = false,
  className = "",
  paused = false,
  scale,
  intro = false,
  configure = false,
  floatOnly = false,
  modelId,
}: RingCanvasProps) {
  const frame = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(true);

  // Fuera de pantalla el anillo no se dibuja: deja la GPU libre para el scroll.
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const seen = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { rootMargin: "120px 0px" },
    );
    seen.observe(node);
    return () => seen.disconnect();
  }, []);

  return (
    <div ref={frame} className={`relative ${className}`}>
      <Canvas
        frameloop={onScreen ? "always" : "never"}
        camera={{ position: [0, floatOnly ? -0.06 : 0.12, 3.55], fov: 28 }}
        dpr={[1, 1.8]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          {intro ? (
            <RingIntro scale={scale ?? 0.756} />
          ) : configure && finishId ? (
            <ConfigureScene
              finishId={finishId}
              modelId={modelId}
              scale={scale ?? 0.9}
              floatOnly={floatOnly}
            />
          ) : (
            <RingScene
              finishId={finishId}
              original={original}
              paused={paused}
              scale={scale}
            />
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}
