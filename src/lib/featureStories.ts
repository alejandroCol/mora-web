import type { ModelId } from "@/lib/catalog";

export type FeatureId = "night" | "pulse" | "stress" | "movement" | "cycle";

export type FeatureStory = {
  title: string;
  lead: string;
  body: string;
  points: string[];
  foot?: string;
};

/** Lo que cuenta la hoja al tocar una de las cápsulas de la foto. */
export function featureStory(modelId: ModelId, id: FeatureId): FeatureStory {
  const pro = modelId === "aero";
  switch (id) {
    case "night":
      return {
        title: "Sueño",
        lead: "Tu noche, por fases.",
        body: "Al despertar, la app te muestra cuánto dormiste y cómo se repartió la noche, estimado con tu movimiento y tu pulso.",
        points: [
          "Hora en que te dormiste y despertaste",
          "Profundo, ligero, REM y despierto",
          pro ? "Para dormir con él puesto" : "También tus siestas",
        ],
      };
    case "pulse":
      return {
        title: "Pulso",
        lead: "Tus latidos, día y noche.",
        body: "El anillo toma tu pulso a lo largo del día. Ves tu pulso en reposo y cómo cambia de una hora a otra.",
        points: ["Pulso en reposo", "Curva del día", "Un aviso si el pulso en reposo sube"],
      };
    case "stress":
      return pro
        ? {
            title: "Estrés",
            lead: "Tu día, en una curva.",
            body: "Pro lee tu estrés solo, sin que toques nada, y lo dibuja a lo largo del día: ves qué momentos te cargan y cuáles te calman.",
            points: ["Se lee solo, todo el día", "Momentos de calma y de carga", "Camino de calma en la app"],
          }
        : {
            title: "Estrés",
            lead: "Una lectura cuando la pidas.",
            body: "Con Ultra mides tu estrés desde la app cuando quieras. En segundos ves en qué punto estás y puedes seguir con una meditación guiada.",
            points: ["Lectura en segundos", "Meditación guiada con tu pulso", "Camino de calma en la app"],
          };
    case "movement":
      return {
        title: "Movimiento",
        lead: "Pasos, distancia y energía.",
        body: pro
          ? "Cuenta tus pasos y la energía del día, con una meta que tú eliges, y sigue tu deporte en vivo mientras entrenas."
          : "Cuenta tus pasos, la distancia y la energía del día, con una meta que tú eliges.",
        points: pro
          ? ["Meta de pasos", "Deporte en vivo", "Distancia y energía"]
          : ["Meta de pasos", "Registro de deporte", "Distancia y energía"],
      };
    case "cycle":
      return {
        title: "Ciclo",
        lead: "Tu ritmo, leído en tu piel.",
        body: "Marcas tu periodo con un toque. Mientras duermes, el anillo lee tu temperatura, tu pulso en reposo y tu recuperación. Con eso Mora aprende tu ritmo, reconoce la subida de temperatura que deja la ovulación y afina cuándo llega tu próximo periodo.",
        points: [
          "Próximo periodo y días fértiles",
          "Ovulación estimada con tu temperatura",
          "Un aviso suave antes de que llegue",
          "Se queda en tu teléfono, no sube a la nube",
        ],
        foot: "Es una estimación de bienestar. No es un método anticonceptivo ni un diagnóstico.",
      };
  }
}