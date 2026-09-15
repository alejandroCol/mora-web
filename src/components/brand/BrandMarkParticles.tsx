"use client";

import { useEffect, useRef, useState } from "react";
import { BRAND, type BrandAsset } from "@/brand";
import { BrandLogo } from "./BrandLogo";

type Sample = {
  nx: number;
  ny: number;
  r: number;
  g: number;
  b: number;
  angle: number;
  purple: boolean;
};

type SampledLogo = {
  points: Sample[];
  aspect: number;
};

type Particle = Sample & {
  x: number;
  y: number;
  sx: number;
  sy: number;
  delay: number;
  size: number;
};

const sampleCache = new Map<string, SampledLogo>();

function hash(i: number) {
  const n = Math.sin(i * 12.9898) * 43758.5453;
  return n - Math.floor(n);
}

async function sampleAsset(src: string, budget: number): Promise<SampledLogo> {
  const key = `${src}:${budget}`;
  const hit = sampleCache.get(key);
  if (hit) return hit;

  const img = new Image();
  img.decoding = "async";
  img.src = src;
  await img.decode();

  const maxW = 280;
  const scale = Math.min(1, maxW / img.naturalWidth);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { points: [], aspect: 1 };
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const raw: Sample[] = [];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 70) continue;
      const nx = x / (w - 1) - 0.5;
      const ny = y / (h - 1) - 0.5;
      raw.push({
        nx,
        ny,
        r,
        g,
        b,
        angle: Math.atan2(ny, nx),
        purple: b > r + 12 && r > g + 8,
      });
    }
  }

  const stride = Math.max(1, Math.ceil(raw.length / budget));
  const sampled = { points: raw.filter((_, i) => i % stride === 0), aspect: w / h };
  sampleCache.set(key, sampled);
  return sampled;
}

function seedParticles(
  samples: Sample[],
  width: number,
  height: number,
): Particle[] {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.46;
  return samples.map((sample, i) => {
    const spin = sample.angle + (hash(i + 3) - 0.5) * 0.8;
    const orbit = radius * (0.72 + hash(i + 7) * 0.55);
    return {
      ...sample,
      sx: cx + Math.cos(spin) * orbit,
      sy: cy + Math.sin(spin) * orbit,
      x: 0,
      y: 0,
      delay: (sample.angle + Math.PI) / (Math.PI * 2) * 0.38 + hash(i) * 0.1,
      size: sample.purple ? 1.7 : 1.05 + hash(i + 11) * 0.55,
    };
  });
}

type BrandMarkParticlesProps = {
  asset?: BrandAsset;
  loop?: boolean;
  className?: string;
  density?: number;
  "aria-label"?: string;
};

export function BrandMarkParticles({
  asset = "mark",
  loop = false,
  className = "",
  density = 900,
  "aria-label": ariaLabel,
}: BrandMarkParticlesProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [staticLogo, setStaticLogo] = useState(false);

  useEffect(() => {
    const node = wrap.current;
    const surface = canvas.current;
    if (!node || !surface) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) {
      setStaticLogo(true);
      return;
    }

    let disposed = false;
    let frame = 0;
    let particles: Particle[] = [];
    let aspect = 1;
    let started = 0;
    let visible = loop;
    let width = 0;
    let height = 0;
    let finished = false;

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && started === 0) started = performance.now();
      },
      { threshold: 0.2 },
    );
    io.observe(node);

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const nextW = Math.max(1, node.clientWidth);
      const nextH = Math.max(1, node.clientHeight);
      width = nextW;
      height = nextH;
      surface.width = Math.round(nextW * dpr);
      surface.height = Math.round(nextH * dpr);
      surface.style.width = `${nextW}px`;
      surface.style.height = `${nextH}px`;
      const ctx = surface.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (particles.length) {
        particles = seedParticles(particles, nextW, nextH);
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(node);
    resize();

    const src = BRAND.assets[asset];
    void sampleAsset(src, density).then((sampled) => {
      if (disposed || sampled.points.length === 0) return;
      aspect = sampled.aspect;
      particles = seedParticles(sampled.points, width || node.clientWidth, height || node.clientHeight);
      if (visible) started = performance.now();
    });

    const ctx = surface.getContext("2d");
    if (!ctx) return;

    const tick = (now: number) => {
      if (!visible || particles.length === 0) {
        frame = window.requestAnimationFrame(tick);
        return;
      }

      const elapsed = Math.max(0, (now - (started || now)) / 1000);
      const assemble = Math.min(1, elapsed / 1.35);

      if (!loop && !finished && elapsed >= 1.55) {
        finished = true;
        setStaticLogo(true);
        window.cancelAnimationFrame(frame);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      const loopTime = loop ? Math.max(0, elapsed - 1.05) : 0;
      const canvasAspect = width / Math.max(1, height);
      const drawW =
        canvasAspect > aspect ? height * 0.86 * aspect : width * 0.86;
      const drawH = drawW / aspect;
      const cx = width / 2;
      const cy = height / 2;

      for (const p of particles) {
        const local = Math.min(1, Math.max(0, (assemble - p.delay) / 0.55));
        const ease = 1 - (1 - local) ** 3;
        const tx = cx + p.nx * drawW;
        const ty = cy + p.ny * drawH;
        const x = p.sx + (tx - p.sx) * ease;
        const y = p.sy + (ty - p.sy) * ease;

        const phase = (p.angle + Math.PI + loopTime * 2.15) % (Math.PI * 2);
        const sweep = loop ? Math.max(0, Math.cos(phase)) ** 10 : 0;
        const pulse =
          loop && p.purple ? 0.35 + Math.sin(loopTime * 3.4) * 0.25 : 0;
        const live =
          loop && assemble > 0.88
            ? Math.sin(loopTime * 1.6 + p.angle * 3) * 0.6
            : 0;

        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${0.22 + ease * 0.7 + sweep * 0.28 + pulse})`;
        ctx.beginPath();
        ctx.arc(x + live, y + live * 0.4, p.size * (0.7 + ease * 0.55 + sweep * 0.9 + pulse * 0.8), 0, Math.PI * 2);
        ctx.fill();
      }

      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      io.disconnect();
      ro.disconnect();
    };
  }, [asset, density, loop]);

  const variant = asset === "wordmark" ? "wordmark" : "mark";

  return (
    <div ref={wrap} className={`relative ${className}`} aria-label={ariaLabel} role={ariaLabel ? "img" : undefined}>
      {staticLogo ? (
        <BrandLogo variant={variant} className="h-full w-full object-contain" />
      ) : (
        <canvas ref={canvas} className="block h-full w-full" aria-hidden />
      )}
    </div>
  );
}
