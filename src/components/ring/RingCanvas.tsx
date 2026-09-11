"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import type { FinishId } from "@/lib/catalog";
import { ConfigureScene } from "./ConfigureScene";
import { RingIntro } from "./RingIntro";
import { RingScene } from "./RingScene";

type RingCanvasProps = {
  finishId?: FinishId;
  original?: boolean;
  className?: string;
  paused?: boolean;
  scale?: number;
  intro?: boolean;
  configure?: boolean;
};

export function RingCanvas({
  finishId,
  original = false,
  className = "",
  paused = false,
  scale,
  intro = false,
  configure = false,
}: RingCanvasProps) {
  return (
    <div className={`relative ${className}`}>
      <Canvas
        camera={{ position: [0, 0.12, 3.55], fov: 28 }}
        dpr={[1, 1.8]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          {intro ? (
            <RingIntro scale={scale ?? 0.756} />
          ) : configure && finishId ? (
            <ConfigureScene finishId={finishId} scale={scale ?? 0.9} />
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
