import { sizeRangeLabel, type ModelId } from "@/lib/catalog";

export type SpecRow = {
  label: string;
  value: string;
};

export const previewCopy: Record<ModelId, string> = {
  aero: "Anillo de cerámica. Sueño y pulso, con el estrés del día en curva. Hasta 7 días de batería.",
  titan: "Anillo de titanio, el más ligero. Sueño y pulso, con meditación guiada. Hasta 6 días de batería.",
};

const vitals: SpecRow[] = [
  { label: "Noche", value: "Cómo dormiste, estimado con movimiento y pulso" },
  { label: "Pulso", value: "Latidos por minuto" },
  { label: "Recuperación", value: "Cómo responde el cuerpo" },
];

const daily: SpecRow[] = [
  { label: "Piel", value: "Temperatura del dedo. No es fiebre" },
  { label: "Movimiento", value: "Pasos y deporte" },
  { label: "Ciclo", value: "Queda guardado en el teléfono" },
];

export const specSheet: Record<
  ModelId,
  {
    lead: string;
    specs: SpecRow[];
    readings: SpecRow[];
    extra: string;
    choose: string;
  }
> = {
  aero: {
    lead: "Cerámica de alta densidad, 3,3 g. Se lleva todo el día. La app Mora Ring, en iPhone y Android, muestra el día. El anillo no tiene pantalla.",
    specs: [
      { label: "Material", value: "Cerámica de alta densidad" },
      { label: "Peso", value: "3,3 g" },
      { label: "Batería", value: "Hasta 7 días, según el uso" },
      { label: "Agua", value: "5 ATM. Ducha y nado en superficie. Sin buceo, sauna ni jacuzzi" },
      { label: "Colores", value: "Rosa Perla, blanco y negro" },
      { label: "Tallas", value: sizeRangeLabel("aero") },
      { label: "Conexión", value: "Bluetooth" },
    ],
    readings: [
      ...vitals,
      { label: "Estrés", value: "Solo, con la curva del día" },
      { label: "Deporte en vivo", value: "Pasos, distancia y energía mientras entrenas" },
      ...daily,
    ],
    extra: "Gestos del anillo: una foto, medir el pulso y un juego con el dedo. Juegos en la app, Círculo para compartir el día, meta de pasos, alarmas, buscar el anillo y un aviso si el pulso en reposo sube.",
    choose: "Elige Pro para que el estrés se lea solo todo el día, más gestos y poder mojarlo en la ducha o al nadar en superficie.",
  },
  titan: {
    lead: "Titanio, 2,5 g. Es el más ligero de la línea. La app Mora Ring, en iPhone y Android, muestra el día. El anillo no tiene pantalla.",
    specs: [
      { label: "Material", value: "Titanio" },
      { label: "Peso", value: "2,5 g" },
      { label: "Batería", value: "Hasta 6 días, según el uso" },
      { label: "Agua", value: "IP67. Polvo y un chapuzón breve. Sin nadar ni ducha larga" },
      { label: "Colores", value: "Plata, negro mate y oro" },
      { label: "Tallas", value: sizeRangeLabel("titan") },
      { label: "Conexión", value: "Bluetooth" },
    ],
    readings: [
      ...vitals,
      { label: "Estrés", value: "Al medir" },
      { label: "Meditación", value: "Guiada en la app, con tu pulso del anillo al cerrar" },
      ...daily,
    ],
    extra: "Gestos del anillo, por ejemplo para una foto. Juegos en la app, Círculo para compartir el día, meta de pasos, alarmas, buscar el anillo y un aviso si el pulso en reposo sube.",
    choose: "Elige Ultra para el menor peso, el titanio y la meditación guiada, con el anillo fuera del agua.",
  },
};

export const specCompare: { label: string; aero: string; titan: string }[] = [
  { label: "Material", aero: "Cerámica", titan: "Titanio" },
  { label: "Peso", aero: "3,3 g", titan: "2,5 g" },
  { label: "Batería", aero: "Hasta 7 días", titan: "Hasta 6 días" },
  { label: "Agua", aero: "5 ATM", titan: "IP67" },
  { label: "Estrés", aero: "Curva del día, sola", titan: "Al medir" },
  { label: "Meditación guiada", aero: "—", titan: "Sí" },
  { label: "Gestos", aero: "Foto, pulso y juego", titan: "Foto" },
  { label: "Colores", aero: "Rosa Perla, blanco, negro", titan: "Plata, negro mate, oro" },
];

export const specDisclaimer =
  "Es seguimiento de bienestar. No diagnostica, no trata y no reemplaza una consulta. Confirma la talla: un anillo holgado o apretado lee peor.";
