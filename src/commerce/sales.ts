import { buildPresaleCopy, PRESALE_DEFAULT_SALE_ON } from "@/lib/presale";

export const SALES_MODES = ["immediate", "presale"] as const;
export type SalesMode = (typeof SALES_MODES)[number];

/** Calendar day in America/Bogota. Required when mode is preventa. */
export type SalesPolicy = {
  mode: SalesMode;
  saleOn: string | null;
  updatedAt: number;
};

export const DEFAULT_SALES_POLICY: SalesPolicy = {
  mode: "immediate",
  saleOn: null,
  updatedAt: 0,
};

export { PRESALE_DEFAULT_SALE_ON };
export const SALE_ON_RE = /^\d{4}-\d{2}-\d{2}$/;

export type SalesSizeStep = {
  title: string;
  body: string;
};

export type SalesPresentation = {
  mode: SalesMode;
  cta: string;
  needSize: string;
  kitHint: string;
  deliveryHint: string;
  emptyCart: string;
  payNote: string;
  payNoteAddi: string;
  orderNote: string;
  heroNote: string | null;
  showPresaleModule: boolean;
  label: string;
  kicker: string;
  whisper: string;
  promise: string;
  deliveryLabel: string;
  deliveryFull: string;
  saleOn: string | null;
  saleAt: number | null;
  closeLabel: string;
  closeValue: string;
  sizeSteps: SalesSizeStep[];
  faqWhen: string;
  brandDescription: string;
  ogLine: string;
  schemaAvailability: string;
  schemaAvailabilityEnds: string | null;
  schemaAction: "BuyAction" | "ReserveAction";
  termsTitle: string;
  termsLead: string;
  termsWho: string;
  keywords: string[];
};

const BASE_KEYWORDS = [
  "anillo inteligente",
  "smart ring Colombia",
  "Mora ring",
  "Mora Pro",
  "Mora Ultra",
  "anillo de titanio",
  "anillo de cerámica",
];

const BRAND_CORE =
  "Anillo inteligente de lujo en Colombia. Mora Pro en cerámica y Mora Ultra en titanio. Pulso, sueño y autonomía de días, sin pantalla que pida atención.";

export function isSalesMode(value: unknown): value is SalesMode {
  return SALES_MODES.includes(value as SalesMode);
}

export function isValidSaleOn(value: string) {
  if (!SALE_ON_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

export function storeFaq(sales: SalesPresentation) {
  return [
    {
      q: "¿Pro o Ultra?",
      a: "Pro es cerámica. Ultra es titanio, el más ligero. Los dos cuestan igual y miden lo mismo.",
    },
    {
      q: "¿Cuánto dura la batería?",
      a: "Cinco a siete días. Pro llega a siete. Ultra, a seis.",
    },
    {
      q: "¿Cómo elijo la talla?",
      a: "Pides el medidor —llega primero— o te mides en casa con la guía. El precio no cambia. No hay cambio de talla después.",
    },
    {
      q: "¿Cuándo llega?",
      a: sales.faqWhen,
    },
    {
      q: "¿Tiene garantía?",
      a: "Un mes desde la entrega, por fallas de fabricación.",
    },
    {
      q: "¿Puedo cambiar la talla?",
      a: "No. Por eso puedes pedir el medidor: llega primero, confirmas el número y después fabricamos el anillo.",
    },
  ];
}

export const FALLBACK_SALES = resolveSalesPresentation(DEFAULT_SALES_POLICY);

export function resolveSalesPresentation(
  policy: SalesPolicy = DEFAULT_SALES_POLICY,
): SalesPresentation {
  if (policy.mode === "presale" && policy.saleOn && isValidSaleOn(policy.saleOn)) {
    return presalePresentation(policy.saleOn);
  }
  return immediatePresentation();
}

function immediatePresentation(): SalesPresentation {
  return {
    mode: "immediate",
    cta: "Comprar",
    needSize: "Elige tu talla para comprar.",
    kitHint: "Comprar con medidor. Confirmas la talla después.",
    deliveryHint: "",
    emptyCart: "Elige Pro o Ultra para comprar.",
    payNote: "Tarjeta, Nequi, PSE o Bancolombia.",
    payNoteAddi: "Te llevamos a Addi para aprobar las cuotas.",
    orderNote: "",
    heroNote: null,
    showPresaleModule: false,
    label: "Venta",
    kicker: "Venta",
    whisper: "Elige Pro o Ultra. El anillo sale a tu nombre.",
    promise: "Tu Mora se fabrica y se envía después del pago.",
    deliveryLabel: "",
    deliveryFull: "",
    saleOn: null,
    saleAt: null,
    closeLabel: "Envío",
    closeValue: "Todo Colombia, cotizado al pagar",
    sizeSteps: [
      { title: "Compras ahora", body: "El precio no cambia." },
      { title: "Te llega el medidor", body: "Un kit pequeño, antes que el anillo." },
      { title: "Confirmas tu número", body: "Entras con tu pedido y eliges la talla." },
      {
        title: "El anillo se fabrica y se envía",
        body: "Cuando ya tenemos tu talla, se fabrica y se envía.",
      },
    ],
    faqWhen: "Se fabrica y se envía después del pago. El medidor, si lo pediste, sale primero.",
    brandDescription: BRAND_CORE,
    ogLine: "Pro · Ultra · Colombia",
    schemaAvailability: "https://schema.org/InStock",
    schemaAvailabilityEnds: null,
    schemaAction: "BuyAction",
    termsTitle: "Compra y entrega",
    termsLead: "Compra, pagos, envíos y contacto comercial en Colombia.",
    termsWho: "la tienda de anillos inteligentes",
    keywords: [...BASE_KEYWORDS, "comprar anillo inteligente"],
  };
}

function presalePresentation(saleOn: string): SalesPresentation {
  const copy = buildPresaleCopy(saleOn);
  return {
    mode: "presale",
    cta: "Reservar",
    needSize: "Elige tu talla para reservar.",
    kitHint: "Reservar con medidor. Confirmas la talla después.",
    deliveryHint: `Se entrega el ${copy.deliveryLabel}.`,
    emptyCart: "Elige Pro o Ultra para reservar.",
    payNote: `Tarjeta, Nequi, PSE o Bancolombia. Entrega el ${copy.deliveryLabel}.`,
    payNoteAddi: `Te llevamos a Addi para aprobar las cuotas. Entrega el ${copy.deliveryLabel}.`,
    orderNote: `Entrega el ${copy.deliveryLabel}`,
    heroNote: "Preventa",
    showPresaleModule: true,
    label: copy.label,
    kicker: copy.kicker,
    whisper: copy.whisper,
    promise: copy.promise,
    deliveryLabel: copy.deliveryLabel,
    deliveryFull: copy.deliveryFull,
    saleOn,
    saleAt: copy.delivery.getTime(),
    closeLabel: "Preventa",
    closeValue: `Entrega el ${copy.deliveryLabel}`,
    sizeSteps: [
      { title: "Reservas ahora", body: "Apartas tu Mora. El precio no cambia." },
      { title: "Te llega el medidor", body: "Un kit pequeño, antes que el anillo." },
      { title: "Confirmas tu número", body: "Entras con tu pedido y eliges la talla." },
      {
        title: `El anillo sale el ${copy.deliveryLabel}`,
        body: "Cuando ya tenemos tu talla, se fabrica y se envía.",
      },
    ],
    faqWhen: `Preventa. El anillo se entrega el ${copy.deliveryLabel}.`,
    brandDescription: `${BRAND_CORE} Preventa con entrega el ${copy.deliveryFull}.`,
    ogLine: `Preventa · ${copy.deliveryLabel}`,
    schemaAvailability: "https://schema.org/PreOrder",
    schemaAvailabilityEnds: saleOn,
    schemaAction: "ReserveAction",
    termsTitle: "Preventa y entrega",
    termsLead: "Preventa, pagos, entrega, bienestar (no médico) y contacto comercial.",
    termsWho: "la preventa de anillos inteligentes",
    keywords: [...BASE_KEYWORDS, "preventa"],
  };
}
