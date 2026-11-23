/** Un tutorial nuevo es otra ficha. El teléfono de la página lo reproduce. */
export type Tutorial = {
  id: string;
  title: string;
  lead: string;
  time: string;
  src: string;
};

export const TUTORIALS: Tutorial[] = [
  {
    id: "uso",
    title: "La app",
    lead: "Un recorrido por Mora.",
    time: "5 min",
    src: "/tutoriales/uso.mp4",
  },
  {
    id: "vinculo",
    title: "Mi vínculo",
    lead: "Cómo se usa Vínculo.",
    time: "3 min",
    src: "/tutoriales/vinculo.mp4",
  },
];

export const INSTALL_FILM = {
  src: "/tutoriales/descargar-iphone.mp4",
  title: "Cómo descargar Mora",
};
