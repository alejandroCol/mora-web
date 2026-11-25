/**
 * Contador de vendidos de la ficha. No se guarda en ningún lado: es una cuenta que depende solo
 * de la hora. Cada día de Colombia trae entre `min` y `max` ventas por anillo, a horas fijas entre
 * `OPEN_HOUR` y `CLOSE_HOUR`, sacadas de un sorteo con semilla (el número del día). Así todos ven
 * el mismo número en el mismo instante, sin base de datos, sin cron y sin pedirle nada al servidor.
 */

import type { ModelId } from "@/lib/catalog";

/** Desde aquí cuenta: el 24 de noviembre de 2026 a las 8:00 p. m. */
const ANCHOR_AT = Date.parse("2026-11-24T20:00:00-05:00");

/** Cada anillo lleva su número, su ritmo y su propio sorteo de horas. */
const MODELS: Record<ModelId, { start: number; min: number; max: number; seed: number }> = {
  aero: { start: 1103, min: 9, max: 16, seed: 0x51a7 },
  titan: { start: 867, min: 6, max: 12, seed: 0x7e2d },
};
const OPEN_HOUR = 7;
const CLOSE_HOUR = 23;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Colombia es UTC−5 todo el año. */
const BOGOTA_OFFSET = 5 * HOUR;
const EPOCH_DAY = dayOf(ANCHOR_AT);

function dayOf(ms: number) {
  return Math.floor((ms - BOGOTA_OFFSET) / DAY);
}

function dayStart(day: number) {
  return day * DAY + BOGOTA_OFFSET;
}

/** Entero de 32 bits estable en cualquier navegador. */
function hash(a: number, b: number) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

function salesOn(modelId: ModelId, day: number) {
  const { min, max, seed } = MODELS[modelId];
  return min + (hash(day ^ seed, 0) % (max - min + 1));
}

function saleAt(modelId: ModelId, day: number, index: number) {
  const span = (CLOSE_HOUR - OPEN_HOUR) * HOUR;
  return dayStart(day) + OPEN_HOUR * HOUR + (hash(day ^ MODELS[modelId].seed, index + 1) % span);
}

/** Ventas del día `day` en el tramo (from, to]. */
function salesBetween(modelId: ModelId, day: number, from: number, to: number) {
  let count = 0;
  for (let i = salesOn(modelId, day) - 1; i >= 0; i -= 1) {
    const at = saleAt(modelId, day, i);
    if (at > from && at <= to) count += 1;
  }
  return count;
}

export function soldCountAt(modelId: ModelId, now: number) {
  const start = MODELS[modelId].start;
  if (now <= ANCHOR_AT) return start;
  const today = dayOf(now);
  if (today === EPOCH_DAY) return start + salesBetween(modelId, today, ANCHOR_AT, now);
  let total = start + salesBetween(modelId, EPOCH_DAY, ANCHOR_AT, Infinity);
  for (let day = EPOCH_DAY + 1; day < today; day += 1) total += salesOn(modelId, day);
  return total + salesBetween(modelId, today, -Infinity, now);
}

/** El próximo instante en que el número sube. */
export function nextSaleAt(modelId: ModelId, now: number) {
  for (let day = dayOf(now); ; day += 1) {
    let next = Infinity;
    for (let i = salesOn(modelId, day) - 1; i >= 0; i -= 1) {
      const at = saleAt(modelId, day, i);
      if (at > now && at < next) next = at;
    }
    if (next !== Infinity) return next;
  }
}
