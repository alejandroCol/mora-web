/**
 * Escala real de la pantalla: cuántos px de CSS caben en un milímetro.
 * El navegador no la sabe (un «px» no mide lo mismo en cada pantalla), así que se calibra
 * contra una tarjeta bancaria (ISO 7810 ID-1: 85,60 × 53,98 mm) y se guarda en el equipo.
 */
export const CARD_WIDTH_MM = 53.98;
export const CARD_CORNER_MM = 3.18;

export const SCALE_MIN = 2.6;
export const SCALE_MAX = 9;

const KEY = "mora.medidor.escala.v1";

type Saved = { pxPerMm: number; dpr: number; w: number; h: number };

function signature() {
  const a = window.screen.width;
  const b = window.screen.height;
  return { dpr: window.devicePixelRatio || 1, w: Math.min(a, b), h: Math.max(a, b) };
}

/** Punto de partida antes de calibrar. Solo acerca la tarjeta virtual a la real; no reemplaza calibrar. */
export function guessPxPerMm(): number {
  const ua = navigator.userAgent;
  const dpr = window.devicePixelRatio || 1;
  const perInch = (points: number) => points / 25.4;
  if (/iPhone|iPod/.test(ua)) return perInch(dpr >= 3 ? 153 : 163);
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return perInch(132);
  if (/Android/.test(ua)) return perInch(160);
  if (/Macintosh/.test(ua) && dpr >= 2) return perInch(127);
  return perInch(96);
}

/**
 * iPhone en modo normal: puntos por pulgada de fábrica según el tamaño lógico de la pantalla.
 * Solo entran tamaños que identifican un panel sin duda. Quedan fuera 375×812@3 (lo comparten
 * X/XS/11 Pro y 12/13 mini, que miden distinto, y es lo que reporta un Max con «Pantalla ampliada»)
 * y 320×568@2 (SE viejo o un 4,7" ampliado): esos calibran con tarjeta.
 */
const IPHONE_POINTS_PER_INCH: Record<string, number> = {
  "375x667@2": 163,
  "414x896@2": 163,
  "414x736@3": 153.7,
  "414x896@3": 152.7,
  "428x926@3": 152.7,
  "390x844@3": 153.3,
  "393x852@3": 153.3,
  "402x874@3": 153.3,
  "420x912@3": 153.3,
  "430x932@3": 153.3,
  "440x956@3": 153.3,
};

/** La ventana ocupa la pantalla entera y sin zoom: lo que mide la pantalla vale para la página. */
function viewportIsWholeScreen(w: number) {
  // Zoom de página, «sitio de escritorio» o pantalla dividida cambian el ancho de la ventana.
  const portrait = window.innerHeight >= window.innerWidth;
  if (portrait && Math.abs(window.innerWidth - w) > 1) return false;
  if (window.visualViewport && Math.abs(window.visualViewport.scale - 1) > 0.01) return false;
  return true;
}

function iphonePxPerMm(): number | null {
  if (!/iPhone/.test(navigator.userAgent)) return null;
  const { dpr, w, h } = signature();
  const points = IPHONE_POINTS_PER_INCH[`${w}x${h}@${dpr}`];
  if (!points) return null;
  if (!viewportIsWholeScreen(w)) return null;
  return points / 25.4;
}

/**
 * Android: el navegador no dice cuánto mide la pantalla, pero sí el modelo del teléfono, y de cada
 * modelo se conoce la diagonal (`androidScreens.ts`). Con la diagonal y la proporción de la pantalla
 * sale su ancho en milímetros; ese ancho repartido entre los px de CSS que lo cubren es la escala.
 * No depende del «tamaño de pantalla» que el usuario elija en Ajustes: cambia los px, no el vidrio.
 */
async function androidModel(): Promise<string | null> {
  type Hints = { getHighEntropyValues?: (hints: string[]) => Promise<{ model?: string }> };
  const hints = (navigator as Navigator & { userAgentData?: Hints }).userAgentData;
  if (hints?.getHighEntropyValues) {
    try {
      const { model } = await hints.getHighEntropyValues(["model"]);
      if (model) return model.trim();
    } catch {
      // Sin permiso para ese dato: se intenta con el user agent.
    }
  }
  // WebViews (Instagram, Facebook) y navegadores viejos aún escriben el modelo en el user agent.
  // Chrome ya no: ahí pone «K», y sin HTTPS tampoco entrega `userAgentData`.
  const match = /Android [^;)]+;(?: [a-z]{2}[-_][a-zA-Z]{2};)? ([^;)]+?)(?: Build\/[^;)]*)?[;)]/.exec(navigator.userAgent);
  const model = match?.[1].trim();
  return model && model !== "K" ? model : null;
}

function pxPerMmFromDiagonal(inches: number): number | null {
  const { w, h } = signature();
  if (!viewportIsWholeScreen(w)) return null;
  const widthMm = (inches * 25.4 * w) / Math.hypot(w, h);
  const scale = w / widthMm;
  // Fuera de lo que da una pantalla real: modelo mal identificado. Mejor no medir.
  return scale >= 4.5 && scale <= 8.5 ? scale : null;
}

let androidResolved: number | null | undefined;

/**
 * Averigua la escala exacta del equipo sin calibrar. En Android pregunta el modelo y baja la tabla
 * de pantallas (solo ahí, solo una vez). `null` = equipo no reconocido.
 */
export async function resolveKnownPxPerMm(): Promise<number | null> {
  const iphone = iphonePxPerMm();
  if (iphone) return iphone;
  if (!/Android/.test(navigator.userAgent)) return null;
  if (androidResolved !== undefined) return androidResolved;
  try {
    const model = await androidModel();
    if (!model) return (androidResolved = null);
    const { diagonalInches } = await import("./androidScreens");
    const inches = diagonalInches(model);
    androidResolved = inches ? pxPerMmFromDiagonal(inches) : null;
  } catch {
    androidResolved = null;
  }
  return androidResolved;
}

/** Lo ya averiguado, sin esperar. En Android vale después de `resolveKnownPxPerMm()`. */
export function knownPxPerMm(): number | null {
  return iphonePxPerMm() ?? androidResolved ?? null;
}

/** La escala guardada, si sigue siendo de esta pantalla y con este zoom. */
export function loadScale(): number | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved;
    const now = signature();
    const same =
      Math.abs(saved.dpr - now.dpr) < 0.01 && saved.w === now.w && saved.h === now.h;
    if (!same || !(saved.pxPerMm >= SCALE_MIN && saved.pxPerMm <= SCALE_MAX)) return null;
    return saved.pxPerMm;
  } catch {
    return null;
  }
}

export function saveScale(pxPerMm: number) {
  try {
    const saved: Saved = { pxPerMm, ...signature() };
    window.localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Sin almacenamiento (modo privado): la medida sirve igual durante esta visita.
  }
}

export function currentZoom() {
  return window.devicePixelRatio || 1;
}
