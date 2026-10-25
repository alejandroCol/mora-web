import type { CrmQuickReply, CrmSettings } from "@/growth/types";
import { formatMoney, products } from "@/lib/catalog";

function reply(
  id: string,
  title: string,
  body: string,
  desk: CrmQuickReply["desk"],
): CrmQuickReply {
  return { id, title, body, desk };
}

export function defaultCrmReplies(): CrmQuickReply[] {
  const pro = formatMoney(products.aero.price);
  const ultra = formatMoney(products.titan.price);
  return [
    reply(
      "hola",
      "Hola",
      "Hola, soy de Mora. ¿Buscas Pro o Ultra?",
      "sales",
    ),
    reply(
      "pro",
      "Mora Pro",
      `Mora Pro es cerámica, ${pro}. Sueño, pulso y ciclo, sin verse gadget. ¿Rosa Perla, blanco o negro?`,
      "sales",
    ),
    reply(
      "ultra",
      "Mora Ultra",
      `Mora Ultra es titanio, ${ultra}. El más ligero de la casa. ¿Plata, negro u oro?`,
      "sales",
    ),
    reply(
      "talla",
      "Talla",
      "Te enviamos un medidor. Lo usas en casa y nos dices el número. Así no adivinas.",
      "both",
    ),
    reply(
      "envio",
      "Envío",
      "Enviamos en Colombia. Al pagar, el pedido queda listo para salir. ¿A qué ciudad va?",
      "both",
    ),
    reply(
      "pago",
      "Pago",
      "Puedes pagar por transferencia, datáfono o en línea. ¿Cuál te queda bien?",
      "sales",
    ),
    reply(
      "cierre",
      "Apartar",
      "Si te late, lo aparto ahora y te paso los datos de pago. ¿Pro o Ultra, color y talla?",
      "sales",
    ),
    reply(
      "soporte",
      "Recibido",
      "Recibí tu mensaje. Lo reviso y te escribo enseguida.",
      "support",
    ),
    reply(
      "pedido",
      "Pedido",
      "¿Me pasas el número del pedido? Está en el correo de confirmación.",
      "support",
    ),
    reply(
      "guia",
      "Guía",
      "En cuanto salga te paso la guía. Si ya salió, la busco ahora.",
      "support",
    ),
    reply(
      "foto",
      "Foto",
      "¿Me mandas una foto del anillo y de la caja? Así lo vemos claro.",
      "support",
    ),
    reply(
      "app",
      "App",
      "Dime qué ves en la app y si el anillo es Pro o Ultra. Con eso te oriento.",
      "support",
    ),
  ];
}

export function emptyCrmSettings(): CrmSettings {
  return {
    replies: defaultCrmReplies(),
    templates: [],
    autoClaimOnReply: true,
    updatedAt: 0,
  };
}
