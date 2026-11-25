import { finishLabel, products, sizeRangeLabel, type ModelId } from "@/lib/catalog";

export type SpecIconId =
  | "night"
  | "pulse"
  | "recovery"
  | "stress"
  | "sport"
  | "meditation"
  | "skin"
  | "movement"
  | "cycle"
  | "bond";

/** Una cifra grande de la ficha: «Hasta / 7 días / Batería». */
export type SpecStat = { pre: string; value: string; label: string };

export type SpecRow = { label: string; value: string; note?: string };

export type SpecReading = { icon: SpecIconId; label: string; value: string };

export const previewCopy: Record<ModelId, string> = {
  aero: "Anillo de cerámica. Sueño y pulso, con el estrés del día en curva. Hasta 7 días de batería.",
  titan: "Anillo de titanio, el más ligero. Sueño y pulso, con meditación guiada. Hasta 6 días de batería.",
};

/** Las lecturas que van sobre la foto del anillo. Una palabra cada una. */
export const specHighlights: { icon: SpecIconId; label: string }[] = [
  { icon: "night", label: "Sueño" },
  { icon: "pulse", label: "Pulso" },
  { icon: "stress", label: "Estrés" },
  { icon: "movement", label: "Movimiento" },
  { icon: "cycle", label: "Ciclo" },
];

/** «Rosa Perla, Blanco y Negro»: los mismos nombres del selector de color. */
function colorList(modelId: ModelId) {
  const names = products[modelId].finishes.map((id) => finishLabel(modelId, id));
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

const BOND: SpecReading = {
  icon: "bond",
  label: "Vínculo",
  value: "Comparte tu día con los tuyos y mira cómo están los de tu círculo.",
};

export const specSheet: Record<
  ModelId,
  {
    lead: string;
    stats: SpecStat[];
    specs: SpecRow[];
    readings: SpecReading[];
  }
> = {
  aero: {
    lead: "Cerámica de alta densidad, 3,3 g. Se lleva todo el día. La app Mora Ring, en iPhone y Android, muestra el día. El anillo no tiene pantalla.",
    stats: [
      { pre: "Solo", value: "3,3 g", label: "Peso" },
      { pre: "Hasta", value: "7 días", label: "Batería" },
      { pre: "Resiste", value: "5 ATM", label: "Agua" },
    ],
    specs: [
      { label: "Material", value: "Cerámica de alta densidad" },
      { label: "Batería", value: "Hasta 7 días", note: "Según el uso" },
      {
        label: "Agua",
        value: "5 ATM",
        note: "Ducha y nado en superficie. No sirve para buceo, sauna ni jacuzzi",
      },
      { label: "Colores", value: colorList("aero") },
      { label: "Tallas", value: sizeRangeLabel("aero") },
      { label: "Conexión", value: "Bluetooth" },
    ],
    readings: [
      { icon: "night", label: "Noche", value: "Cómo dormiste" },
      { icon: "pulse", label: "Pulso", value: "Latidos por minuto" },
      { icon: "recovery", label: "Recuperación", value: "Cómo responde tu cuerpo" },
      { icon: "stress", label: "Estrés", value: "Lectura del día" },
      { icon: "sport", label: "Deporte en vivo", value: "Pasos, distancia y energía" },
      { icon: "skin", label: "Piel", value: "Temperatura" },
      { icon: "movement", label: "Movimiento", value: "Pasos y deporte" },
      { icon: "cycle", label: "Ciclo", value: "Tu ritmo, con tu temperatura" },
      { icon: "meditation", label: "Meditación", value: "Camino de calma, guiado en la app" },
      BOND,
    ],
  },
  titan: {
    lead: "Titanio, 2,5 g. Es el más ligero de la línea. La app Mora Ring, en iPhone y Android, muestra el día. El anillo no tiene pantalla.",
    stats: [
      { pre: "Solo", value: "2,5 g", label: "Peso" },
      { pre: "Hasta", value: "6 días", label: "Batería" },
      { pre: "Resiste", value: "IP67", label: "Agua y polvo" },
    ],
    specs: [
      { label: "Material", value: "Titanio" },
      { label: "Batería", value: "Hasta 6 días", note: "Según el uso" },
      {
        label: "Agua",
        value: "IP67",
        note: "Polvo y un chapuzón breve. No sirve para nadar ni para duchas largas",
      },
      { label: "Colores", value: colorList("titan") },
      { label: "Tallas", value: sizeRangeLabel("titan") },
      { label: "Conexión", value: "Bluetooth" },
    ],
    readings: [
      { icon: "night", label: "Noche", value: "Tu noche y tus siestas" },
      { icon: "pulse", label: "Pulso", value: "Latidos durante el día" },
      { icon: "recovery", label: "Recuperación", value: "Cómo responde tu cuerpo" },
      { icon: "stress", label: "Estrés", value: "Cuando lo mides" },
      { icon: "meditation", label: "Meditación", value: "Guiada en la app" },
      { icon: "skin", label: "Piel", value: "Temperatura" },
      { icon: "movement", label: "Movimiento", value: "Pasos y deporte" },
      { icon: "cycle", label: "Ciclo", value: "Tu ritmo, con tu temperatura" },
      BOND,
    ],
  },
};

export const specCompare: { label: string; aero: string; titan: string }[] = [
  { label: "Material", aero: "Cerámica", titan: "Titanio" },
  { label: "Peso", aero: "3,3 g", titan: "2,5 g" },
  { label: "Batería", aero: "Hasta 7 días", titan: "Hasta 6 días" },
  { label: "Agua", aero: "5 ATM", titan: "IP67" },
  { label: "Estrés", aero: "Lectura del día", titan: "Cuando lo mides" },
  { label: "Meditación", aero: "Camino de calma", titan: "Camino de calma y meditación con el anillo" },
  { label: "Gestos", aero: "Foto, pulso y juego", titan: "Foto" },
  { label: "Colores", aero: colorList("aero"), titan: colorList("titan") },
];

export const specDisclaimer =
  "Es seguimiento de bienestar. No diagnostica, no trata y no reemplaza una consulta. Confirma la talla: un anillo holgado o apretado lee peor.";
