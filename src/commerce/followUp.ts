import type { MoraOrder } from "./types";

/**
 * Plantilla de Meta «Post-entrega» (`scripts/whatsapp-templates.mjs`). Si Ajustes
 * del CRM la tiene registrada, manda lo de Ajustes; esto es el respaldo.
 */
export const FOLLOW_UP_TEMPLATE = {
  name: "seguimiento_entrega",
  language: "es",
  billingCategory: "utility" as const,
  variables: 1,
  body:
    "¡Hola {{1}}! 💜\n\n¡Esperamos que estés disfrutando de tu Mora Ring! ✨\n\nQueremos saber si tu pedido llegó correctamente y cómo ha sido tu primera experiencia con nosotros.\n\n¿Ya pudiste probar tu anillo y conectarlo con la app? Nos encantaría saber qué tal te ha ido y acompañarte en tus primeros días con Mora.\n\nRecuerda que estamos aquí para ayudarte con cualquier duda que tengas.\n\n¡Gracias por ser parte de Mora Ring!\n\nBaja tu marea. 🌊💜",
};

/** Solo cuando los anillos ya salieron: antes no hay entrega que seguir. */
export function canFollowUp(order: Pick<MoraOrder, "status">) {
  return order.status === "in_transit" || order.status === "delivered";
}

/** `{{1}}` de la plantilla: primer nombre con mayúscula. Meta no acepta variables vacías. */
export function followUpName(order: Pick<MoraOrder, "customer">) {
  const first = order.customer.firstName.trim().split(/\s+/)[0] ?? "";
  if (!first) return "";
  return first.charAt(0).toLocaleUpperCase("es-CO") + first.slice(1).toLocaleLowerCase("es-CO");
}

export function followUpPreview(order: Pick<MoraOrder, "customer">, body = FOLLOW_UP_TEMPLATE.body) {
  const name = followUpName(order);
  return body.replace(/\{\{1\}\}/g, name).replace("¡Hola !", "¡Hola!");
}
