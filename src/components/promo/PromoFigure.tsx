"use client";

import { useEffect, useRef } from "react";

/**
 * «10%» enorme que arde en polvo: las mismas partículas finas del anillo del inicio,
 * que nacen de la cifra y suben como llama, de perla a lila.
 * La cifra es texto de verdad; el lienzo solo pinta el polvo encima.
 */

type Ember = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  phase: number;
  sway: number;
};

// Perla caliente → lila de la casa → violeta que se apaga.
const HOT: [number, number, number] = [246, 244, 252];
const LILAC: [number, number, number] = [176, 160, 238];
const DEEP: [number, number, number] = [111, 97, 184];

function mix(a: [number, number, number], b: [number, number, number], t: number) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function PromoFigure({ percent }: { percent: number }) {
  const box = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = box.current;
    const glyph = text.current;
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!host || !glyph || !cv || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let fontPx = 0;
    // Puntos de la cifra de donde nace el polvo, en píxeles del lienzo.
    let spawn: Float32Array = new Float32Array(0);
    let embers: Ember[] = [];
    let frame = 0;
    let last = 0;
    let visible = true;

    const measure = () => {
      const area = cv.getBoundingClientRect();
      const mark = glyph.getBoundingClientRect();
      if (area.width < 2 || mark.width < 2) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = area.width;
      height = area.height;
      cv.width = Math.round(width * dpr);
      cv.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // La misma cifra, dibujada aparte, para saber dónde hay tinta.
      const style = getComputedStyle(glyph);
      fontPx = parseFloat(style.fontSize) || 120;
      const step = Math.max(2, Math.round(fontPx / 70));
      const off = document.createElement("canvas");
      off.width = Math.ceil(width);
      off.height = Math.ceil(height);
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.font = `${style.fontWeight} ${fontPx}px ${style.fontFamily}`;
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      if ("letterSpacing" in octx) {
        (octx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = style.letterSpacing;
      }
      octx.fillStyle = "#fff";
      const cx = mark.left - area.left + mark.width / 2;
      const cy = mark.top - area.top + mark.height / 2;
      octx.fillText(glyph.textContent ?? "", cx, cy);
      const data = octx.getImageData(0, 0, off.width, off.height).data;
      const points: number[] = [];
      for (let y = 0; y < off.height; y += step) {
        for (let x = 0; x < off.width; x += step) {
          if (data[(y * off.width + x) * 4 + 3] > 120) points.push(x, y);
        }
      }
      spawn = new Float32Array(points);
      const count = Math.round(Math.min(3000, Math.max(800, width * 2.5)));
      embers = Array.from({ length: count }, () => born({ age: 0 } as Ember, true));
    };

    function born(ember: Ember, scatter = false): Ember {
      const pick = spawn.length ? Math.floor(Math.random() * (spawn.length / 2)) * 2 : 0;
      ember.x = spawn[pick] ?? width / 2;
      ember.y = spawn[pick + 1] ?? height / 2;
      ember.vx = (Math.random() - 0.5) * fontPx * 0.05;
      ember.vy = -fontPx * (0.12 + Math.random() * 0.5);
      ember.life = 1 + Math.random() * 2;
      // Al arrancar, repartidas en su vida: la llama ya está encendida, no nace de golpe.
      ember.age = scatter ? Math.random() * ember.life : 0;
      ember.size = 0.6 + Math.random() * 1.4;
      ember.phase = Math.random() * Math.PI * 2;
      ember.sway = fontPx * (0.03 + Math.random() * 0.07);
      if (scatter) {
        ember.x += ember.vx * ember.age;
        ember.y += ember.vy * ember.age;
      }
      return ember;
    }

    const draw = (now: number) => {
      frame = window.requestAnimationFrame(draw);
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      if (!visible || !spawn.length) return;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";
      const time = now / 1000;
      for (const ember of embers) {
        ember.age += dt;
        if (ember.age >= ember.life) born(ember);
        const t = ember.age / ember.life;
        // La llama se frena al subir y se mece: lenguas, no una lluvia recta.
        ember.y += ember.vy * dt * (1 - t * 0.45);
        ember.x += (ember.vx + Math.sin(time * 2.1 + ember.phase + ember.y * 0.012) * ember.sway) * dt;
        const [r, g, b] = t < 0.35 ? mix(HOT, LILAC, t / 0.35) : mix(LILAC, DEEP, (t - 0.35) / 0.65);
        const alpha = (t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88) * 0.85;
        ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${alpha.toFixed(3)})`;
        const size = ember.size * (1 - t * 0.35);
        ctx.fillRect(ember.x, ember.y, size, size);
      }
      ctx.globalCompositeOperation = "source-over";
    };

    measure();
    // La fuente puede terminar de cargar después: la cifra cambia de ancho.
    void document.fonts?.ready.then(measure).catch(() => undefined);
    const resize = new ResizeObserver(measure);
    resize.observe(host);
    const watch = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
    });
    watch.observe(host);
    frame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frame);
      resize.disconnect();
      watch.disconnect();
    };
  }, [percent]);

  return (
    <div ref={box} className="promo-figure">
      <canvas ref={canvas} className="promo-figure-dust" aria-hidden />
      <p className="promo-figure-copy">
        <span ref={text} className="promo-figure-number">
          {percent}%
        </span>
        <span className="promo-figure-word">de descuento</span>
      </p>
    </div>
  );
}
