export const FUNNEL_STEPS = [
  "home",
  "product",
  "cart",
  "checkout",
  "info",
  "shipping",
  "pay",
  "purchase",
] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export const FUNNEL_COPY: Record<
  FunnelStep,
  { title: string; hint: string }
> = {
  home: { title: "Entró a Mora", hint: "Abrió la tienda" },
  product: { title: "Vio un anillo", hint: "Pro o Ultra" },
  cart: { title: "Puso en la bolsa", hint: "Eligió talla y acabado" },
  checkout: { title: "Empezó el pedido", hint: "Llegó a tus datos" },
  info: { title: "Dejó sus datos", hint: "Nombre, correo, celular" },
  shipping: { title: "Puso a dónde llega", hint: "Ciudad y dirección" },
  pay: { title: "Llegó a pagar", hint: "Abrió Bold o Addi" },
  purchase: { title: "Pagó", hint: "Pedido confirmado" },
};

export type InsightImageKind = "photo" | "ring";

export type InsightEvent =
  | { name: "funnel"; step: FunnelStep }
  | { name: "product_view"; productId: string; productName?: string }
  | { name: "product_cart"; productId: string; productName?: string }
  | { name: "product_checkout"; productId: string; productName?: string }
  | { name: "product_buy"; productId: string; productName?: string }
  | {
      name: "image_view";
      productId: string;
      productName?: string;
      imageId: string;
      imageSrc?: string;
      finishId?: string;
      kind?: InsightImageKind;
      label?: string;
    };

export type InsightTrackBody = {
  visitorId?: string;
  events?: InsightEvent[];
};

export type InsightProductRow = {
  id: string;
  name: string;
  views: number;
  viewers: number;
  carts: number;
  checkouts: number;
  purchases: number;
};

export type InsightImageRow = {
  id: string;
  productId: string;
  productName: string;
  label: string;
  src: string;
  finishId?: string;
  kind: InsightImageKind;
  views: number;
  viewers: number;
};

export type InsightFunnelRow = {
  step: FunnelStep;
  title: string;
  hint: string;
  visitors: number;
  events: number;
  fromPrevious: number | null;
  drop: number | null;
  dropShare: number | null;
};

export type InsightAdvice = {
  tone: "drop" | "photo" | "product" | "empty";
  text: string;
};

export type InsightsReport = {
  days: number;
  visitors: number;
  conversion: number;
  products: InsightProductRow[];
  images: InsightImageRow[];
  funnel: InsightFunnelRow[];
  leak: InsightFunnelRow | null;
  topProduct: InsightProductRow | null;
  topImage: InsightImageRow | null;
  advice: InsightAdvice[];
};
