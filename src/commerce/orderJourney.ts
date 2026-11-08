import type { MoraOrder, ShipmentLeg } from "./types";
import { orderHasSizer, orderNeedsSize } from "./sizing";
import { legFromShipping, sizerSent } from "./shipments";

/**
 * Ruta del pedido para el vendedor: dónde va y qué sigue.
 *
 * Con medidor:  Pago → Medidor enviado → Talla elegida → Anillos enviados → Entregado
 * Sin medidor:  Pago → Anillos enviados → Entregado
 */

export type JourneyState = "done" | "current" | "todo";

export type JourneyStep = {
  id: "paid" | "sizer" | "size" | "rings" | "delivered";
  title: string;
  state: JourneyState;
  /** Fecha del hito cuando ya pasó. */
  at?: number;
  /** Detalle corto: transportadora, guía, estado en Heka… */
  detail?: string;
};

export type JourneyActionKind =
  | "confirm_paid"
  | "heka_create"
  | "en_camino"
  | "deliver"
  | "none";

export type JourneyNext = {
  /** Qué está pasando ahora, en una línea. */
  title: string;
  /** Qué tiene que hacer el vendedor (o por qué no tiene que hacer nada). */
  body: string;
  action: JourneyActionKind;
  actionLabel?: string;
  /** Permite escribir la guía a mano antes de marcar en camino. */
  manualGuide?: boolean;
  /** El vendedor está esperando a otra persona (cliente, transportadora). */
  waiting?: boolean;
  tone: "neutral" | "waiting" | "done" | "cancelled";
};

export type OrderJourney = {
  steps: JourneyStep[];
  next: JourneyNext;
  hasSizer: boolean;
};

function legDetail(leg: ShipmentLeg | undefined) {
  if (!leg) return "";
  const parts: string[] = [];
  if (leg.carrierLabel) parts.push(leg.carrierLabel);
  if (leg.trackingNumber) parts.push(`guía ${leg.trackingNumber}`);
  if (leg.hekaStatusLabel) parts.push(leg.hekaStatusLabel);
  return parts.join(" · ");
}

function timelineAt(order: MoraOrder, status: MoraOrder["status"]) {
  const event = [...order.timeline].reverse().find((item) => item.status === status);
  return event?.at;
}

export function orderJourney(order: MoraOrder): OrderJourney {
  const hasSizer = orderHasSizer(order.items);
  const needsSize = orderNeedsSize(order.items);
  const cancelled = order.status === "cancelled";
  const delivered = order.status === "delivered";
  const paid = order.status !== "awaiting_payment" && !cancelled;

  const sizerLeg = order.shipments?.sizer;
  const sizerGuide = Boolean(sizerLeg?.hekaGuideId);
  const sizerOut = sizerSent(order);
  const sizedAt = order.items.reduce((max, item) => Math.max(max, item.sizedAt ?? 0), 0) || undefined;
  const sizeDone = hasSizer && !needsSize;

  const ringsLeg = legFromShipping(order, "rings", order.shipments?.rings?.status ?? "pending");
  const ringsGuide = Boolean(ringsLeg.hekaGuideId);
  const ringsOut = order.status === "in_transit" || delivered;

  const steps: JourneyStep[] = [];

  steps.push({
    id: "paid",
    title: paid ? "Pago recibido" : cancelled ? "Pago" : "Esperando el pago",
    state: paid ? "done" : "current",
    at: paid ? order.paidAt ?? timelineAt(order, "paid") : undefined,
  });

  if (hasSizer) {
    steps.push({
      id: "sizer",
      title: sizerOut ? "Medidor enviado" : "Enviar el medidor",
      state: sizerOut ? "done" : paid ? "current" : "todo",
      at: sizerOut ? sizerLeg?.dispatchedAt ?? timelineAt(order, "sizer_transit") : undefined,
      detail: legDetail(sizerLeg) || (sizerGuide ? "Guía creada, falta entregarla" : undefined),
    });
    steps.push({
      id: "size",
      title: sizeDone ? "Talla elegida" : "Cliente elige la talla",
      state: sizeDone ? "done" : sizerOut ? "current" : "todo",
      at: sizeDone ? sizedAt : undefined,
      detail: sizeDone
        ? order.items
            .filter((item) => (item.sizing ?? "self") === "kit" && item.size)
            .map((item) => `Talla ${item.size}`)
            .join(" · ")
        : undefined,
    });
  }

  // Con medidor, los anillos solo «tocan» cuando el medidor ya salió y hay talla.
  const ringsCurrent = paid && !ringsOut && (!hasSizer || (sizerOut && sizeDone));
  steps.push({
    id: "rings",
    title: ringsOut ? (hasSizer ? "Anillos enviados" : "Pedido enviado") : hasSizer ? "Enviar los anillos" : "Enviar el pedido",
    state: ringsOut ? "done" : ringsCurrent ? "current" : "todo",
    at: ringsOut ? ringsLeg.dispatchedAt ?? order.dispatchedAt ?? timelineAt(order, "in_transit") : undefined,
    detail: legDetail(ringsLeg) || (ringsGuide ? "Guía creada, falta entregarla" : undefined),
  });

  steps.push({
    id: "delivered",
    title: delivered ? "Entregado" : "Entrega",
    state: delivered ? "done" : ringsOut ? "current" : "todo",
    at: delivered ? order.deliveredAt ?? timelineAt(order, "delivered") : undefined,
  });

  // Cancelado: nada está «en curso»; queda lo que alcanzó a pasar.
  if (cancelled) {
    for (const step of steps) if (step.state === "current") step.state = "todo";
  }

  // Qué sigue.
  let next: JourneyNext;
  if (cancelled) {
    next = {
      title: "Pedido cancelado",
      body: "No hay nada por hacer.",
      action: "none",
      tone: "cancelled",
    };
  } else if (delivered) {
    next = {
      title: "Pedido entregado",
      body: "Listo. El cliente ya tiene su Mora.",
      action: "none",
      tone: "done",
    };
  } else if (!paid) {
    next = {
      title: "Esperando el pago",
      body: "Cuando confirmes que el dinero entró, márcalo aquí y el pedido pasa a despacho.",
      action: "confirm_paid",
      actionLabel: "Confirmar pago recibido",
      waiting: true,
      tone: "waiting",
    };
  } else if (hasSizer && !sizerOut) {
    next = sizerGuide
      ? {
          title: "Entregar el medidor a la transportadora",
          body: "La guía ya está creada. Imprímela, entrega el paquete y marca el medidor en camino.",
          action: "en_camino",
          actionLabel: "Medidor en camino",
          manualGuide: true,
          tone: "neutral",
        }
      : {
          title: "Enviar el medidor",
          body: "Primero va el medidor de talla. Crea la guía con Heka o escribe la guía si ya la tienes.",
          action: "heka_create",
          actionLabel: "Crear guía del medidor",
          manualGuide: true,
          tone: "neutral",
        };
  } else if (hasSizer && needsSize) {
    next = {
      title: "El cliente está eligiendo la talla",
      body: "Cuando reciba el medidor, elige la talla desde su enlace. Al confirmarla, aquí aparece el envío de los anillos. Si pasan días, recuérdaselo por el chat.",
      action: "none",
      waiting: true,
      tone: "waiting",
    };
  } else if (!ringsOut) {
    const what = hasSizer ? "los anillos" : "el pedido";
    next = ringsGuide
      ? {
          title: `Entregar ${what} a la transportadora`,
          body: "La guía ya está creada. Imprímela, entrega el paquete y márcalo en camino.",
          action: "en_camino",
          actionLabel: hasSizer ? "Anillos en camino" : "En camino",
          manualGuide: true,
          tone: "neutral",
        }
      : {
          title: hasSizer ? "Enviar los anillos" : "Enviar el pedido",
          body: hasSizer
            ? "La talla ya está confirmada. Crea la guía con Heka o escribe la guía si ya la tienes."
            : "Crea la guía con Heka o escribe la guía si ya la tienes.",
          action: "heka_create",
          actionLabel: hasSizer ? "Crear guía de los anillos" : "Crear guía",
          manualGuide: true,
          tone: "neutral",
        };
  } else {
    next = {
      title: hasSizer ? "Anillos en camino" : "Pedido en camino",
      body: "Cuando la transportadora confirme la entrega, márcalo entregado.",
      action: "deliver",
      actionLabel: "Marcar entregado",
      waiting: true,
      tone: "waiting",
    };
  }

  return { steps, next, hasSizer };
}
