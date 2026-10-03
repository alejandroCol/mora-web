export const RINGS = [
  {
    id: "blanco",
    title: "Blanco",
    src: "/encuesta/blanco.jpg",
  },
  {
    id: "lila",
    title: "Lila",
    src: "/encuesta/lila.jpg",
  },
  {
    id: "plata",
    title: "Plata",
    src: "/encuesta/plata.jpg",
  },
  {
    id: "oro",
    title: "Oro",
    src: "/encuesta/oro.jpg",
  },
  {
    id: "brillo",
    title: "Negro brillo",
    src: "/encuesta/brillo.jpg",
  },
  {
    id: "mate",
    title: "Negro mate",
    src: "/encuesta/mate.jpg",
  },
] as const;

export type RingId = (typeof RINGS)[number]["id"];
export type Gender = "mujer" | "hombre";

export const RING_IDS = new Set<string>(RINGS.map((ring) => ring.id));

export function ringById(id: string) {
  return RINGS.find((ring) => ring.id === id);
}

export function isRingId(value: string): value is RingId {
  return RING_IDS.has(value);
}

export function isGender(value: string): value is Gender {
  return value === "mujer" || value === "hombre";
}
