import type { ModelId } from "@/lib/catalog";

export type SpecRow = {
  label: string;
  value: string;
};

export const previewCopy: Record<ModelId, string> = {
  aero: "Anillo de cerámica. Sueño, pulso y actividad, con hasta 7 días de batería.",
  titan: "Anillo de titanio, el más ligero. Sueño, pulso y recuperación, con hasta 6 días de batería.",
};

const readingsShared: SpecRow[] = [
  { label: "Noche", value: "Cómo dormiste" },
  { label: "Pulso", value: "Latidos por minuto" },
  { label: "Oxígeno", value: "Oxígeno en sangre" },
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
      { label: "Colores", value: "Lila, blanco y negro" },
      { label: "Tallas", value: "6 a 13" },
      { label: "Conexión", value: "Bluetooth" },
    ],
    readings: [
      ...readingsShared.slice(0, 3),
      { label: "Recuperación", value: "Cómo responde el cuerpo" },
      { label: "Presión", value: "Estimación, con la curva del día. No es un tensiómetro" },
      { label: "Estrés", value: "Con la curva del día" },
      ...readingsShared.slice(3),
    ],
    extra: "Gestos del anillo, por ejemplo para una foto, y un modo de juego en la app. También meta de pasos, alarmas y un aviso si el pulso en reposo sube.",
    choose: "Elige Pro para cerámica, un poco más de batería y poder mojarlo en la ducha o al nadar en superficie.",
  },
  titan: {
    lead: "Titanio, 2,5 g. Es el más ligero de la línea. La app Mora Ring, en iPhone y Android, muestra el día. El anillo no tiene pantalla.",
    specs: [
      { label: "Material", value: "Titanio" },
      { label: "Peso", value: "2,5 g" },
      { label: "Batería", value: "Hasta 6 días, según el uso" },
      { label: "Agua", value: "IP67. Polvo y un chapuzón breve. Sin nadar ni ducha larga" },
      { label: "Colores", value: "Plata, negro mate y oro" },
      { label: "Tallas", value: "6 a 13" },
      { label: "Conexión", value: "Bluetooth" },
    ],
    readings: [
      ...readingsShared.slice(0, 3),
      { label: "Recuperación", value: "Recuperación y reloj interior" },
      { label: "Presión", value: "Estimación al medir. No es un tensiómetro" },
      { label: "Estrés", value: "Al medir" },
      { label: "Meditación", value: "Una sesión desde el anillo" },
      ...readingsShared.slice(3),
    ],
    extra: "Gestos del anillo, por ejemplo para una foto. También meta de pasos, alarmas y un aviso si el pulso en reposo sube.",
    choose: "Elige Ultra para el menor peso y el acabado en titanio, con el anillo fuera del agua.",
  },
};

export const specCompare: { label: string; aero: string; titan: string }[] = [
  { label: "Material", aero: "Cerámica", titan: "Titanio" },
  { label: "Peso", aero: "3,3 g", titan: "2,5 g" },
  { label: "Batería", aero: "Hasta 7 días", titan: "Hasta 6 días" },
  { label: "Agua", aero: "5 ATM", titan: "IP67" },
  { label: "Colores", aero: "Lila, blanco, negro", titan: "Plata, negro mate, oro" },
];

export const specDisclaimer =
  "Es seguimiento de bienestar. No diagnostica, no trata y no reemplaza una consulta. Confirma la talla: un anillo holgado o apretado lee peor.";
