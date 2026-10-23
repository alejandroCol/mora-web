"use client";

import { useCallback, useRef } from "react";

const DEFAULT_THRESHOLD = 48;
const AXIS_LOCK_PX = 10;

type Options = {
  threshold?: number;
  enabled?: boolean;
};

export function useHorizontalSwipe(
  onPrev: () => void,
  onNext: () => void,
  options?: Options,
) {
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD;
  const enabled = options?.enabled ?? true;
  const origin = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<"x" | "y" | null>(null);

  const reset = useCallback(() => {
    origin.current = null;
    axis.current = null;
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0) return;
      origin.current = { x: event.clientX, y: event.clientY };
      axis.current = null;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled || !origin.current || axis.current) return;
      const dx = Math.abs(event.clientX - origin.current.x);
      const dy = Math.abs(event.clientY - origin.current.y);
      if (dx < AXIS_LOCK_PX && dy < AXIS_LOCK_PX) return;
      axis.current = dx > dy ? "x" : "y";
    },
    [enabled],
  );

  const finish = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled) {
        reset();
        return;
      }
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        /* ignore */
      }
      if (origin.current && axis.current === "x") {
        const dx = event.clientX - origin.current.x;
        if (dx > threshold) onPrev();
        else if (dx < -threshold) onNext();
      }
      reset();
    },
    [enabled, onNext, onPrev, reset, threshold],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      finish(event);
    },
    [finish],
  );

  const onPointerCancel = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      finish(event);
    },
    [finish],
  );

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
