/** Scroll de página animado a mano: curva sin tirón al arrancar ni al frenar, cancelable por el usuario. */

const MIN_MS = 560;
const MAX_MS = 1100;

let cancelActive: (() => void) | null = null;

/** Smootherstep: velocidad y aceleración cero en ambos extremos. */
function ease(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function durationFor(distance: number) {
  return Math.min(MAX_MS, Math.max(MIN_MS, 400 + Math.sqrt(distance) * 16));
}

function targetTop(element: Element) {
  const margin = parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const top = element.getBoundingClientRect().top + window.scrollY - margin;
  return Math.min(max, Math.max(0, top));
}

export function glideTo(element: Element) {
  cancelActive?.();

  const root = document.documentElement;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo({ top: targetTop(element), behavior: "instant" });
    return;
  }

  const from = window.scrollY;
  const distance = Math.abs(targetTop(element) - from);
  if (distance < 2) return;

  const duration = durationFor(distance);
  const snap = root.style.scrollSnapType;
  const behavior = root.style.scrollBehavior;
  // El snap y el smooth nativo pelean cada scrollTo del frame.
  root.style.scrollSnapType = "none";
  root.style.scrollBehavior = "auto";

  let frame = 0;
  let started = 0;

  const finish = () => {
    window.cancelAnimationFrame(frame);
    root.style.scrollSnapType = snap;
    root.style.scrollBehavior = behavior;
    window.removeEventListener("wheel", finish);
    window.removeEventListener("touchstart", finish);
    window.removeEventListener("keydown", finish);
    if (cancelActive === finish) cancelActive = null;
  };

  const tick = (now: number) => {
    if (!started) started = now;
    const t = Math.min(1, (now - started) / duration);
    // Se recalcula cada frame por si una imagen cambia el layout a mitad de camino.
    const to = targetTop(element);
    window.scrollTo(0, from + (to - from) * ease(t));
    if (t < 1) {
      frame = window.requestAnimationFrame(tick);
      return;
    }
    finish();
  };

  cancelActive = finish;
  window.addEventListener("wheel", finish, { passive: true });
  window.addEventListener("touchstart", finish, { passive: true });
  window.addEventListener("keydown", finish);
  frame = window.requestAnimationFrame(tick);
}
