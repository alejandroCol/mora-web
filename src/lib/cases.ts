export type AccessoryId = "case";
export type CaseColorId = "ice" | "mint" | "chocolate" | "sage" | "sky";

export type CaseColor = {
  id: CaseColorId;
  title: string;
  whisper: string;
  slug: string;
  swatch: string;
  src: string;
};

export type CaseProduct = {
  id: AccessoryId;
  slug: "case";
  kind: "case";
  name: string;
  line: string;
  material: string;
  price: number;
  colors: CaseColorId[];
  promise: string;
  details: string[];
};

export const CASE_PRODUCT: CaseProduct = {
  id: "case",
  slug: "case",
  kind: "case",
  name: "Case",
  line: "Silicona",
  material: "Silicona suave",
  price: 19_900,
  colors: ["ice", "mint", "chocolate", "sage", "sky"],
  promise: "Lo cuida. No se ve.",
  details: [
    "Cubre el anillo sin añadir peso.",
    "Cinco colores, un mismo gesto.",
    "Para Pro y Ultra.",
  ],
};

export const caseColors: Record<CaseColorId, CaseColor> = {
  ice: {
    id: "ice",
    title: "Hielo",
    whisper: "Blanco que no brilla.",
    slug: "hielo",
    swatch: "linear-gradient(145deg, #ffffff 0%, #e8eef2 55%, #cfd8de 100%)",
    src: "/cases/ice.jpg",
  },
  mint: {
    id: "mint",
    title: "Menta",
    whisper: "Verde claro, casi aire.",
    slug: "menta",
    swatch: "linear-gradient(145deg, #eef6ef 0%, #c9d9c8 52%, #a8bba8 100%)",
    src: "/cases/mint.jpg",
  },
  chocolate: {
    id: "chocolate",
    title: "Chocolate",
    whisper: "Marrón que no grita.",
    slug: "chocolate",
    swatch: "linear-gradient(145deg, #6b5348 0%, #4a342c 55%, #2c1d18 100%)",
    src: "/cases/chocolate.jpg",
  },
  sage: {
    id: "sage",
    title: "Salvia",
    whisper: "Verde que se queda.",
    slug: "salvia",
    swatch: "linear-gradient(145deg, #9aa38d 0%, #7a8b73 52%, #5c6b56 100%)",
    src: "/cases/sage.jpg",
  },
  sky: {
    id: "sky",
    title: "Azul",
    whisper: "Azul sin pantalla.",
    slug: "azul",
    swatch: "linear-gradient(145deg, #8a97d4 0%, #5b6fbf 52%, #3d4e9a 100%)",
    src: "/cases/sky.jpg",
  },
};

export const CASE_COLOR_LIST = CASE_PRODUCT.colors.map((id) => caseColors[id]);

export function isAccessoryId(value: unknown): value is AccessoryId {
  return value === "case";
}

export function isCaseColorId(value: unknown): value is CaseColorId {
  return (
    value === "ice" ||
    value === "mint" ||
    value === "chocolate" ||
    value === "sage" ||
    value === "sky"
  );
}

export function caseColor(id: unknown): CaseColor {
  return isCaseColorId(id) ? caseColors[id] : caseColors[CASE_PRODUCT.colors[0]];
}

export function casePath() {
  return "/case";
}

export function caseColorPath(id: CaseColorId) {
  return `${casePath()}?color=${caseColors[id].slug}`;
}

export function caseFromCheckoutPath(id: CaseColorId) {
  return `${caseColorPath(id)}&desde=pedido`;
}

export function caseColorFromSlug(value: string | null | undefined): CaseColorId | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  const match = CASE_COLOR_LIST.find((item) => item.slug === key || item.id === key);
  return match?.id ?? null;
}

export function landingCaseColor(color?: string | null): CaseColorId {
  return caseColorFromSlug(color) ?? CASE_PRODUCT.colors[0];
}

export function writeCaseColor(id: CaseColorId) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  params.set("color", caseColors[id].slug);
  const path = `${casePath()}?${params}`;
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === path) return;
  window.history.replaceState(null, "", path);
}

export function caseLineKey(colorId: CaseColorId) {
  return `case:${colorId}`;
}
