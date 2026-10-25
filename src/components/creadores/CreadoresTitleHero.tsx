"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Dot = {
  angle: number;
  dist: number;
  size: number;
  r: number;
  g: number;
  b: number;
  drift: number;
  phase: number;
};

const LILAC: Array<[number, number, number]> = [
  [111, 97, 184],
  [139, 132, 166],
  [196, 189, 220],
  [125, 114, 175],
  [168, 160, 205],
];

function hash(i: number) {
  const n = Math.sin(i * 12.9898) * 43758.5453;
  return n - Math.floor(n);
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function seed(count: number): Dot[] {
  const dots: Dot[] = [];
  for (let i = 0; i < count; i += 1) {
    const [r, g, b] = LILAC[Math.floor(hash(i + 2) * LILAC.length)];
    dots.push({
      angle: hash(i + 5) * Math.PI * 2,
      dist: 0.35 + hash(i + 9) * 0.65,
      size: 0.65 + hash(i + 13) * 1.35,
      r,
      g,
      b,
      drift: (hash(i + 17) - 0.5) * 0.35,
      phase: hash(i + 21) * Math.PI * 2,
    });
  }
  return dots;
}

function draw(
  ctx: CanvasRenderingContext2D,
  dots: Dot[],
  width: number,
  height: number,
  t: number,
) {
  const cx = width / 2;
  const cy = height / 2;
  const spread = Math.min(width, height) * 0.48;
  ctx.clearRect(0, 0, width, height);

  const gatherEnd = 0.42;
  const bloomStart = 0.38;
  const bloomEnd = 1;

  for (let i = 0; i < dots.length; i += 1) {
    const dot = dots[i];
    let radius = spread * dot.dist;
    let alpha = 0;

    if (t < gatherEnd) {
      const p = easeOutCubic(t / gatherEnd);
      const far = spread * (1.05 + dot.dist * 0.85);
      radius = far + (radius - far) * p;
      alpha = 0.08 + p * 0.52;
    } else if (t < bloomEnd) {
      const p = (t - bloomStart) / (bloomEnd - bloomStart);
      const eased = easeInOutCubic(Math.max(0, Math.min(1, p)));
      radius = spread * dot.dist * (1 + eased * 0.55);
      alpha = (1 - eased) * 0.58;
    }

    if (alpha <= 0.01) continue;

    const spin = t * (0.35 + dot.drift);
    const x = cx + Math.cos(dot.angle + spin + dot.phase * 0.2) * radius;
    const y = cy + Math.sin(dot.angle + spin * 0.92 + dot.phase) * radius * 0.72;

    const glow = alpha * 0.22;
    if (glow > 0.02) {
      ctx.fillStyle = `rgba(${dot.r},${dot.g},${dot.b},${glow})`;
      ctx.beginPath();
      ctx.arc(x, y, dot.size * 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = `rgba(${dot.r},${dot.g},${dot.b},${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, dot.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

type CreadoresTitleHeroProps = {
  children: ReactNode;
};

export function CreadoresTitleHero({ children }: CreadoresTitleHeroProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const text = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = wrap.current;
    const surface = canvas.current;
    const label = text.current;
    if (!node || !surface || !label) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ctx = surface.getContext("2d");
    if (!ctx) return;

    let disposed = false;
    let frame = 0;
    let width = 0;
    let height = 0;
    const count = window.innerWidth < 640 ? 320 : 520;
    const dots = seed(count);
    const duration = 2200;
    const started = performance.now();
    let revealed = false;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, node.clientWidth);
      height = Math.max(1, node.clientHeight);
      surface.width = Math.round(width * dpr);
      surface.height = Math.round(height * dpr);
      surface.style.width = `${width}px`;
      surface.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(node);
    resize();

    const finish = () => {
      if (revealed) return;
      revealed = true;
      label.classList.add("cr-title-hero-text--in");
    };

    if (reduce.matches) {
      finish();
      return () => ro.disconnect();
    }

    const tick = (now: number) => {
      if (disposed) return;
      const elapsed = now - started;
      const t = Math.min(1, elapsed / duration);
      draw(ctx, dots, width, height, t);
      if (t >= 0.32 && !revealed) finish();
      if (t < 1) frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={wrap} className="cr-title-hero">
      <canvas ref={canvas} className="cr-title-particles" aria-hidden />
      <div ref={text} className="cr-title-hero-text">
        {children}
      </div>
    </div>
  );
}
