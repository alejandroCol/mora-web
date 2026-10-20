"use client";

import { useEffect, useRef } from "react";

type Kind = "band" | "halo" | "dust";

type Particle = {
  kind: Kind;
  u: number;
  v: number;
  jitter: number;
  size: number;
  r: number;
  g: number;
  b: number;
  speed: number;
  phase: number;
};

const PEARL: Array<[number, number, number]> = [
  [228, 228, 234],
  [214, 214, 222],
  [200, 200, 208],
  [188, 188, 196],
  [220, 218, 226],
  [242, 242, 246],
];

function hash(i: number) {
  const n = Math.sin(i * 12.9898) * 43758.5453;
  return n - Math.floor(n);
}

function pickPearl(i: number, bright: boolean): [number, number, number] {
  if (bright) return PEARL[hash(i + 2) > 0.55 ? 5 : 0];
  return PEARL[Math.min(4, Math.floor(hash(i + 5) * 5))];
}

function seed(count: number): Particle[] {
  const band = Math.round(count * 0.78);
  const halo = Math.round(count * 0.16);
  const dust = Math.max(0, count - band - halo);
  const particles: Particle[] = [];

  for (let i = 0; i < band; i += 1) {
    const [r, g, b] = pickPearl(i, hash(i) > 0.82);
    particles.push({
      kind: "band",
      u: (i / band) * Math.PI * 2 + hash(i + 3) * 0.08,
      v: hash(i + 9) * Math.PI * 2,
      jitter: (hash(i + 13) - 0.5) * 0.1,
      size: 0.55 + hash(i + 17) * 0.75,
      r,
      g,
      b,
      speed: 0.22 + hash(i + 21) * 0.12,
      phase: hash(i + 25),
    });
  }

  for (let i = 0; i < halo; i += 1) {
    const [r, g, b] = pickPearl(i + 400, true);
    particles.push({
      kind: "halo",
      u: (i / Math.max(1, halo)) * Math.PI * 2,
      v: (hash(i + 31) - 0.5) * 0.18,
      jitter: 0.18 + hash(i + 35) * 0.55,
      size: 0.35 + hash(i + 39) * 0.5,
      r,
      g,
      b,
      speed: 0.55 + hash(i + 43) * 0.45,
      phase: hash(i + 47),
    });
  }

  for (let i = 0; i < dust; i += 1) {
    const [r, g, b] = pickPearl(i + 800, hash(i) > 0.7);
    particles.push({
      kind: "dust",
      u: hash(i + 51) * Math.PI * 2,
      v: (hash(i + 55) - 0.5) * 1.2,
      jitter: 0.35 + hash(i + 59) * 0.9,
      size: 0.35 + hash(i + 63) * 0.55,
      r,
      g,
      b,
      speed: 0.12 + hash(i + 67) * 0.2,
      phase: hash(i + 71),
    });
  }

  return particles;
}

function project(
  x: number,
  y: number,
  z: number,
  yaw: number,
  tilt: number,
  scale: number,
  cx: number,
  cy: number,
) {
  const cyaw = Math.cos(yaw);
  const syaw = Math.sin(yaw);
  const x1 = x * cyaw - z * syaw;
  const z1 = x * syaw + z * cyaw;
  const ctilt = Math.cos(tilt);
  const stilt = Math.sin(tilt);
  const y1 = y * ctilt - z1 * stilt;
  const z2 = y * stilt + z1 * ctilt;
  return { x: cx + x1 * scale, y: cy + y1 * scale, depth: z2 };
}

function pose(
  p: Particle,
  elapsed: number,
): { x: number; y: number; z: number } {
  if (p.kind === "band") {
    const u = p.u + elapsed * p.speed;
    const tube = 0.21 * (1 + p.jitter);
    const major = 1;
    return {
      x: (major + tube * Math.cos(p.v)) * Math.cos(u),
      y: (major + tube * Math.cos(p.v)) * Math.sin(u),
      z: tube * Math.sin(p.v),
    };
  }

  if (p.kind === "halo") {
    const u = p.u + elapsed * p.speed;
    const spiral = 1.08 + p.jitter * 0.42 + Math.sin(u * 2 + p.phase * 6) * 0.04;
    return {
      x: spiral * Math.cos(u),
      y: spiral * Math.sin(u),
      z: p.v + Math.sin(u * 3 + elapsed * 0.8) * 0.03,
    };
  }

  const u = p.u + elapsed * p.speed;
  const reach = 0.7 + p.jitter;
  return {
    x: reach * Math.cos(u),
    y: reach * Math.sin(u) * 0.92,
    z: p.v * 0.35,
  };
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  width: number,
  height: number,
  elapsed: number,
  spinning: boolean,
) {
  const cx = width / 2;
  const cy = height / 2;
  const scale = Math.min(width, height) * 0.41;
  const yaw = spinning ? elapsed * 0.48 : 0.35;
  const tilt = 1.08;

  const drawn = particles.map((p) => {
    const point = pose(p, spinning ? elapsed : 0);
    const screen = project(point.x, point.y, point.z, yaw, tilt, scale, cx, cy);
    return { p, ...screen };
  });
  drawn.sort((a, b) => a.depth - b.depth);

  ctx.clearRect(0, 0, width, height);

  for (const item of drawn) {
    const depth = (item.depth + 1.35) / 2.7;
    const shade = 0.22 + Math.max(0, Math.min(1, depth)) * 0.78;
    const alpha = (item.p.kind === "dust" ? 0.38 : 0.62) * shade;
    const size = item.p.size * (0.5 + shade * 0.7);

    if (item.p.kind !== "dust" && shade > 0.55) {
      ctx.fillStyle = `rgba(${item.p.r},${item.p.g},${item.p.b},${alpha * 0.16})`;
      ctx.beginPath();
      ctx.arc(item.x, item.y, size * 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = `rgba(${item.p.r},${item.p.g},${item.p.b},${alpha})`;
    ctx.beginPath();
    ctx.arc(item.x, item.y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

type SpiralParticlesProps = {
  className?: string;
  count?: number;
};

export function SpiralParticles({ className = "", count = 6600 }: SpiralParticlesProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const node = wrap.current;
    const surface = canvas.current;
    if (!node || !surface) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ctx = surface.getContext("2d");
    if (!ctx) return;

    let disposed = false;
    let frame = 0;
    let width = 0;
    let height = 0;
    let visible = true;
    let started = performance.now();
    const particles = seed(count);

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

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) started = performance.now();
      },
      { threshold: 0.15 },
    );
    io.observe(node);

    const ro = new ResizeObserver(resize);
    ro.observe(node);
    resize();

    if (reduce.matches) {
      drawFrame(ctx, particles, width, height, 0, false);
      return () => {
        io.disconnect();
        ro.disconnect();
      };
    }

    const tick = (now: number) => {
      if (disposed) return;
      if (!visible) {
        frame = window.requestAnimationFrame(tick);
        return;
      }
      drawFrame(ctx, particles, width, height, (now - started) / 1000, true);
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      io.disconnect();
      ro.disconnect();
    };
  }, [count]);

  return (
    <div ref={wrap} className={`relative ${className}`} aria-hidden>
      <canvas ref={canvas} className="block h-full w-full" />
    </div>
  );
}
