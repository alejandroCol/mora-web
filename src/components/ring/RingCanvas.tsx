"use client";

import { Suspense } from "react";
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
  return (
    <div className={`relative ${className}`}>
      <Canvas
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
