import { jsonError } from "../adminAuth";
import { MetaAdsError } from "./graph";

/** Respuesta de error para las rutas de anuncios: traduce los fallos de Meta a algo que se pueda leer. */
export function adsError(error: unknown) {
  if (error instanceof MetaAdsError) {
    const message =
      error.code === 190
        ? "El token de anuncios venció o lo revocaron. Conéctalo de nuevo."
        : error.code === 17 || error.code === 80004 || error.code === 80000
          ? "Meta pide esperar unos minutos: se hicieron muchas consultas seguidas a la cuenta."
          : `Meta: ${error.message}`;
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
  return jsonError(error);
}
