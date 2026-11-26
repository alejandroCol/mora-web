import type { CrmQuickReply, CrmSettings } from "@/growth/types";
import { formatMoney, products } from "@/lib/catalog";

/** Texto de «Pago» de fábrica. Si en Ajustes aún está uno de los anteriores, se actualiza solo. */
export const PAYMENT_REPLY_BODY =
  "Puedes pagar como prefieras:\n" +
  "• Transferencia bancaria\n" +
  "• Link de pago (tarjeta, Nequi o PSE)\n" +
  "• A cuotas con Addi, solo con tu cédula y sin tarjeta de crédito\n" +
  "• Directo en nuestra web: https://moraring.com/checkout\n\n" +
  "¿Cuál te queda mejor?";

export const LEGACY_PAYMENT_REPLY_BODIES = [
  "Puedes pagar por transferencia, datáfono o en línea. ¿Cuál te queda bien?",
];

/** Chip corto del compositor; cabe en una línea del chat. */
export const PAYMENT_CHIP_TEXT =
  "Puedes pagar por transferencia, link de pago, a cuotas con Addi o directo en nuestra web: https://moraring.com/checkout";

function reply(
  id: string,
  title: string,
  body: string,
  desk: CrmQuickReply["desk"],
): CrmQuickReply {
  return { id, title, body, desk };
}

/** Datos de envío para retomar el chat con una creadora. El texto es el que pidió Alejo, tal cual. */
export const CREATOR_SHIPPING_REPLY_ID = "creadores-envio";

export const CREATOR_SHIPPING_REPLY_BODY = `¡Holaa! 💜

Estamos muy felices de que hagas parte de Mora Ring ✨

Primero te enviaremos un medidor de tallas para asegurarnos de que tu anillo te quede perfecto.

¿Nos compartes estos daticos para coordinar el envío el dia de mañana? 🥰

Nombre completo
Número de celular
Ciudad
Dirección completa
Barrio

¡Estamos emocionados de que tengas tu Mora Ring!`;

export function creatorShippingReply(): CrmQuickReply {
  return reply("creadores-envio", "Datos de envío", CREATOR_SHIPPING_REPLY_BODY, "creators");
}

/** Retoma el chat tras la llamada con Julio. `[nombre]` y `[creador]` quedan seleccionados al elegir la respuesta. */
export const CREATOR_RESUME_REPLY_ID = "creadores-retomar";

export const CREATOR_RESUME_REPLY_BODY = `¡Hola, [nombre]! 💜

Mi nombre es Lina y hago parte del equipo de Mora Ring.

Retomando la conversación que tuviste con nuestro líder de Marketing, Julio Noguera, nos encantaría comenzar a trabajar contigo, siguiendo lo que conversaron previamente.

¡Nos hace mucha ilusión que hagas parte de Mora Ring! ✨

¿Te parece si avanzamos? 💜`;

export function creatorResumeReply(): CrmQuickReply {
  return reply(CREATOR_RESUME_REPLY_ID, "Retomar con Julio", CREATOR_RESUME_REPLY_BODY, "creators");
}

export const CREATOR_CHECKIN_REPLY_ID = "creadores-experiencia";

export const CREATOR_CHECKIN_REPLY_BODY = `¡Hola, [creador]! 💜

Nos encantaría saber cómo vas con tu Mora Ring y cómo ha sido tu experiencia utilizándolo. ✨

¿Qué tal te has sentido con él? ¿Has podido explorar sus funcionalidades y descubrir todo lo que tiene para ofrecerte?`;

export function creatorCheckinReply(): CrmQuickReply {
  return reply(CREATOR_CHECKIN_REPLY_ID, "Cómo vas", CREATOR_CHECKIN_REPLY_BODY, "creators");
}

/** Plantillas de creadoras que siempre deben estar, aunque Ajustes ya tenga respuestas guardadas. */
export function creatorReplies(): CrmQuickReply[] {
  return [creatorShippingReply(), creatorResumeReply(), creatorCheckinReply()];
}

export function defaultCrmReplies(): CrmQuickReply[] {
  const pro = formatMoney(products.aero.price);
  const ultra = formatMoney(products.titan.price);
  return [
    reply(
      "hola",
      "Hola",
      "Hola, soy del equipo de Mora. Cuéntame qué buscas y te oriento.",
      "sales",
    ),
    reply(
      "info",
      "Más info",
      "Claro. Mi nombre es Lina, de Mora Ring.\n\nMora es un anillo inteligente: lo llevas puesto y la app te cuenta cómo estás.\n\n🟣 Lo que mide:\n• Tu sueño, para saber qué tan bien descansas.\n• Tu pulso, día y noche.\n• Tu estrés, como una marea que sube y baja.\n• Qué tan recuperado amaneces.\n• La temperatura de tu piel.\n• Tus pasos y entrenos.\n• Tu ciclo, guardado solo en tu teléfono.\n\nY en la app: meditación guiada, Círculo para compartir tu día con alguien, meta de pasos y un aviso si tu pulso en reposo sube.\n\nPro es cerámica y Ultra es titanio, ambos resistentes al agua.\n\n¿Cuál es el color que más te gusta?",
      "sales",
    ),
    reply(
      "diferencia",
      "Pro vs Ultra",
      `${pro === ultra ? "Mismo precio, distinta piel." : "Distinta piel."} Pro: cerámica, se moja en ducha y piscina, estrés en curva todo el día. Ultra: titanio, 2,5 g, meditación guiada, mejor fuera del agua. ¿Cuál va más contigo?`,
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
      `Mora Ultra es titanio, ${ultra}. El más ligero de la casa. ¿Silver, negro o Gold?`,
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
    reply("pago", "Pago", PAYMENT_REPLY_BODY, "sales"),
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
    ...creatorReplies(),
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
