/** Tope del aviso manual. Más largo no cabe junto a las tallas en el celular. */
export const SCARCITY_MAX = 9;

export type ScarcityNote = { on: boolean; count: number };

export function leftLabel(count: number) {
  return count === 1 ? "queda 1" : `quedan ${count}`;
}

/** Número que se puede guardar a mano. Vacío borra el aviso. */
export function parseScarcityCount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const count = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(count) || count < 1 || count > SCARCITY_MAX) {
    throw new Error(`El aviso va de 1 a ${SCARCITY_MAX}.`);
  }
  return count;
}

/**
 * Lo que ve la ficha. El aviso solo sale si en inventario está prendido.
 * Con 0 unidades no se anuncia: esa talla va bloqueada.
 */
export function sizeBadge(
  available: number | null,
  note: { on: boolean; count: number } | null,
): number | null {
  if (!note?.on) return null;
  if (available === 0) return null;
  if (note.count >= 1 && note.count <= SCARCITY_MAX) return note.count;
  return null;
}

/** Hay fila de stock y no queda ninguna unidad libre. */
export function sizeIsOut(available: number | null) {
  return available === 0;
}
