export type FinishId = "white" | "black" | "gold" | "silver";
export type ModelId = "cera" | "titan";

export type Finish = {
  id: FinishId;
  title: string;
  whisper: string;
  color: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
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
    color: "#F3F0EA",
    metalness: 0.06,
    roughness: 0.2,
    clearcoat: 0.42,
    swatch: "linear-gradient(145deg, #ffffff 0%, #f0ece4 55%, #ddd6cc 100%)",
  },
  black: {
    id: "black",
    title: "Obsidiana",
    whisper: "Negro que absorbe.",
    color: "#2C2A32",
    metalness: 0.28,
    roughness: 0.26,
    clearcoat: 0.18,
    swatch: "linear-gradient(145deg, #4a4752 0%, #2a2830 48%, #1a181e 100%)",
  },
  gold: {
    id: "gold",
    title: "Champán",
    whisper: "Oro que no grita.",
    color: "#D4B896",
    metalness: 1,
    roughness: 0.2,
    clearcoat: 0.12,
    swatch: "linear-gradient(145deg, #f0e0c4 0%, #d4b896 46%, #b8956c 100%)",
  },
  silver: {
    id: "silver",
    title: "Niebla",
    whisper: "Plata fría.",
    color: "#C8CDD4",
    metalness: 1,
    roughness: 0.16,
    clearcoat: 0.1,
    swatch: "linear-gradient(145deg, #f4f6f8 0%, #c8cdd4 50%, #9aa3ae 100%)",
  },
};

export const products: Record<ModelId, RingProduct> = {
  cera: {
    id: "cera",
    name: "Cera",
    line: "Cerámica",
    material: "Cerámica de alta densidad",
    weight: "3.3 g",
    price: 349,
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
    price: 289,
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

export const catalog = [products.cera, products.titan];

export function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
