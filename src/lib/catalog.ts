export type FinishId = "lilac" | "white" | "black" | "gold" | "silver";
export type ModelId = "aero" | "titan";
export type ProductSlug = "pro" | "ultra";
export type ProductKind = "ring";

export type Finish = {
  id: FinishId;
  title: string;
  whisper: string;
  color: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
  envMapIntensity: number;
  emissive: string;
  emissiveIntensity: number;
  swatch: string;
};

export type RingProduct = {
  id: ModelId;
  slug: ProductSlug;
  kind: ProductKind;
  name: string;
  line: string;
  material: string;
  weight: string;
  price: number;
  water: string;
  battery: string;
  sizes: number[];
  finishes: FinishId[];
  promise: string;
  details: string[];
};

export const finishes: Record<FinishId, Finish> = {
  lilac: {
    id: "lilac",
    title: "Lila",
    whisper: "Cerámica en el color de Mora.",
    color: "#C9B6E4",
    metalness: 0.08,
    roughness: 0.28,
    clearcoat: 0.4,
    envMapIntensity: 1.05,
    emissive: "#D4C4EE",
    emissiveIntensity: 0.06,
    swatch: "linear-gradient(145deg, #f6f1ff 0%, #d4c4ee 48%, #a890d0 100%)",
  },
  white: {
    id: "white",
    title: "Blanco",
    whisper: "Blanco que no brilla.",
    color: "#FBF8F2",
    metalness: 0.1,
    roughness: 0.22,
    clearcoat: 0.48,
    envMapIntensity: 1.15,
    emissive: "#F4EFE4",
    emissiveIntensity: 0.04,
    swatch: "linear-gradient(145deg, #ffffff 0%, #f4efe6 55%, #e4d9cc 100%)",
  },
  black: {
    id: "black",
    title: "Negro mate",
    whisper: "Negro que no brilla.",
    color: "#111111",
    metalness: 0.04,
    roughness: 0.82,
    clearcoat: 0,
    envMapIntensity: 0.22,
    emissive: "#000000",
    emissiveIntensity: 0,
    swatch: "linear-gradient(145deg, #2a2a2a 0%, #111111 55%, #000000 100%)",
  },
  gold: {
    id: "gold",
    title: "Oro",
    whisper: "Oro que no grita.",
    // 18k espejo de la foto: el color es el F0 del metal; el brillo lo da la rugosidad baja.
    color: "#C9A227",
    metalness: 1,
    roughness: 0.08,
    clearcoat: 0.22,
    envMapIntensity: 1.4,
    emissive: "#000000",
    emissiveIntensity: 0,
    swatch: "linear-gradient(145deg, #fff3cd 0%, #e8c35a 40%, #c9a227 68%, #8a5a14 100%)",
  },
  silver: {
    id: "silver",
    title: "Plata",
    whisper: "Titanio mate.",
    // Anodizado: el cuerpo es gris claro (no conductor puro) y el reflejo queda mate.
    color: "#E4E7EA",
    metalness: 0.72,
    roughness: 0.58,
    clearcoat: 0,
    envMapIntensity: 0.55,
    emissive: "#000000",
    emissiveIntensity: 0,
    swatch: "linear-gradient(165deg, #e7e9eb 0%, #c9ced2 52%, #9aa0a6 100%)",
  },
};

export const products: Record<ModelId, RingProduct> = {
  aero: {
    id: "aero",
    slug: "pro",
    kind: "ring",
    name: "Pro",
    line: "Cerámica",
    material: "Cerámica de alta densidad",
    weight: "3.3 g",
    price: 679_000,
    water: "5 ATM",
    battery: "7 días",
    sizes: [6, 7, 8, 9, 10, 11, 12, 13],
    finishes: ["lilac", "white", "black"],
    promise: "Se siente. No se anuncia.",
    details: [
      "Sueño, pulso y ciclo en un gesto.",
      "Una superficie que no pide atención.",
      "Para llevar todo el día, y olvidarlo.",
    ],
  },
  titan: {
    id: "titan",
    slug: "ultra",
    kind: "ring",
    name: "Ultra",
    line: "Titanio",
    material: "Titanio grado médico",
    weight: "2.5 g",
    price: 679_000,
    water: "IP67",
    battery: "6 días",
    sizes: [6, 7, 8, 9, 10, 11, 12, 13],
    finishes: ["silver", "black", "gold"],
    promise: "Precisión que no pesa.",
    details: [
      "El más ligero de la casa.",
      "Reloj interior y recuperación.",
      "Datos, sin cara de gadget.",
    ],
  },
};

export const catalog = [products.aero, products.titan];

export function resolveFinish(modelId: ModelId, finishId: FinishId): Finish {
  const base = finishes[finishId];
  if (modelId === "aero" && finishId === "black") {
    return {
      ...base,
      title: "Negro",
      whisper: "Cerámica negra.",
      color: "#141416",
      metalness: 0.16,
      roughness: 0.18,
      clearcoat: 0.62,
      envMapIntensity: 1.12,
      swatch: "linear-gradient(145deg, #4a4a4e 0%, #1a1a1c 48%, #0a0a0c 100%)",
    };
  }
  if (modelId === "titan" && finishId === "black") {
    return {
      ...base,
      color: "#09090b",
      metalness: 0.2,
      roughness: 0.07,
      clearcoat: 0.94,
      envMapIntensity: 1.22,
      swatch: "linear-gradient(145deg, #3a3a3e 0%, #141416 42%, #050506 100%)",
    };
  }
  return base;
}

export const SLUG_TO_MODEL: Record<ProductSlug, ModelId> = {
  pro: "aero",
  ultra: "titan",
};

export function productTitle(modelId: ModelId) {
  return `Mora ${products[modelId].name}`;
}

export function productPath(modelId: ModelId) {
  return `/anillo/${products[modelId].slug}`;
}

export function resolveProductSlug(slug: string): ModelId | null {
  const key = slug.trim().toLowerCase();
  if (key === "pro" || key === "aero") return "aero";
  if (key === "ultra" || key === "titan") return "titan";
  return null;
}

export const DEFAULT_GALLERY_SRC = "/gallery/rings.png";

export const PRODUCT_LOOKS: Record<ModelId, readonly { id: string; src: string }[]> = {
  aero: [
    { id: "pro-look-1", src: "/lifestyle/pro-01.jpg" },
    { id: "pro-look-2", src: "/lifestyle/pro-02.jpg" },
    { id: "pro-look-3", src: "/lifestyle/pro-03.jpg" },
  ],
  titan: [
    { id: "ultra-look-1", src: "/lifestyle/ultra-01.jpg" },
    { id: "ultra-look-2", src: "/lifestyle/ultra-02.jpg" },
    { id: "ultra-look-3", src: "/lifestyle/ultra-03.jpg" },
  ],
};

export function isFinishId(value: unknown): value is FinishId {
  return (
    value === "lilac" ||
    value === "white" ||
    value === "black" ||
    value === "gold" ||
    value === "silver"
  );
}

export function isProductFinish(modelId: ModelId, value: unknown): value is FinishId {
  return isFinishId(value) && products[modelId].finishes.includes(value);
}

const removedHousePhotos = new Set(["default-titan-silver"]);

export function defaultGalleryImages(modelId: ModelId, finishId?: FinishId) {
  if (modelId === "aero") return [];
  const colors = finishId
    ? products[modelId].finishes.filter((id) => id === finishId)
    : products[modelId].finishes;
  return colors
    .filter((id) => !removedHousePhotos.has(`default-${modelId}-${id}`))
    .map((id, index) => ({
      id: `default-${modelId}-${id}`,
      modelId,
      finishId: id,
      src: finishPhoto(id),
      sort: index,
      createdAt: 0,
      system: true as const,
      hidden: false,
    }));
}

export function defaultGalleryImage(modelId: ModelId) {
  return defaultGalleryImages(modelId)[0];
}

export function finishLabel(modelId: ModelId, finishId: FinishId) {
  if (finishId === "black") return modelId === "titan" ? "Negro mate" : "Negro";
  return finishes[finishId].title;
}

export function finishPhoto(finishId: FinishId) {
  switch (finishId) {
    case "lilac":
      return "/encuesta/lila.jpg";
    case "white":
      return "/encuesta/blanco.jpg";
    case "black":
      return "/encuesta/mate.jpg";
    case "gold":
      return "/encuesta/oro.jpg";
    case "silver":
      return "/encuesta/plata.jpg";
  }
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}
