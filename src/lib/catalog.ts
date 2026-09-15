export type FinishId = "white" | "black" | "gold" | "silver";
export type ModelId = "aero" | "titan";

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
  white: {
    id: "white",
    title: "Porcelana",
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
    title: "Mate",
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
    title: "Champán",
    whisper: "Oro que no grita.",
    color: "#F4D7A4",
    metalness: 1,
    roughness: 0.12,
    clearcoat: 0.38,
    envMapIntensity: 2.15,
    emissive: "#C9A05A",
    emissiveIntensity: 0.22,
    swatch: "linear-gradient(145deg, #fff0c8 0%, #e8c57a 46%, #c4924a 100%)",
  },
  silver: {
    id: "silver",
    title: "Niebla",
    whisper: "Plata fría.",
    color: "#F7FBFF",
    metalness: 1,
    roughness: 0.045,
    clearcoat: 0.52,
    envMapIntensity: 2.45,
    emissive: "#B7C6D8",
    emissiveIntensity: 0.14,
    swatch: "linear-gradient(145deg, #ffffff 0%, #dce6f0 42%, #9aafc4 100%)",
  },
};

export const products: Record<ModelId, RingProduct> = {
  aero: {
    id: "aero",
    name: "Aero",
    line: "Cerámica",
    material: "Cerámica de alta densidad",
    weight: "3.3 g",
    price: 549_000,
    water: "5 ATM",
    battery: "7 días",
    sizes: [6, 7, 8, 9, 10, 11, 12, 13],
    finishes: ["white", "black", "gold"],
    promise: "Se siente. No se anuncia.",
    details: [
      "Sueño, pulso y ciclo en un gesto.",
      "Una superficie que no pide atención.",
      "Para llevar todo el día, y olvidarlo.",
    ],
  },
  titan: {
    id: "titan",
    name: "Titan",
    line: "Titanio",
    material: "Titanio grado médico",
    weight: "2.5 g",
    price: 549_000,
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

export const DEFAULT_GALLERY_SRC = "/gallery/rings.png";

export function defaultGalleryImage(modelId: ModelId) {
  return {
    id: `default-${modelId}`,
    modelId,
    src: DEFAULT_GALLERY_SRC,
    sort: 0,
    createdAt: 0,
    system: true as const,
  };
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}
