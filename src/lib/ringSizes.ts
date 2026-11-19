/**
 * Tallas de Mora: numeración de EE. UU., la misma de las joyerías en Colombia (talla 5 = 15,7 mm por dentro).
 * `diameterMm` y `aroundMm` son del anillo (ficha de fábrica).
 */
export type RingSizeRow = {
  size: number;
  diameterMm: number;
  aroundMm: number;
};

export const RING_SIZES: RingSizeRow[] = [
  { size: 7, diameterMm: 17.5, aroundMm: 55 },
  { size: 8, diameterMm: 18.3, aroundMm: 57.5 },
  { size: 9, diameterMm: 19.1, aroundMm: 60 },
  { size: 10, diameterMm: 20, aroundMm: 62.8 },
  { size: 11, diameterMm: 20.8, aroundMm: 65.4 },
  { size: 12, diameterMm: 21.6, aroundMm: 67.9 },
  { size: 13, diameterMm: 22.3, aroundMm: 70 },
];

const decimal = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
const centimeters = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

export function ringSize(size: number): RingSizeRow | undefined {
  return RING_SIZES.find((row) => row.size === size);
}

/** «17,5 mm» */
export function diameterLabel(row: RingSizeRow) {
  return `${decimal.format(row.diameterMm)} mm`;
}

/** «5,5 cm» */
export function aroundLabel(row: RingSizeRow) {
  return `${centimeters.format(row.aroundMm / 10)} cm`;
}
