export const SUPPORT_TOPICS = [
  { id: "pedido", label: "Un pedido" },
  { id: "app", label: "La app" },
  { id: "anillo", label: "El anillo" },
  { id: "cuenta", label: "Mi cuenta" },
  { id: "otro", label: "Otra cosa" },
] as const;

export type SupportTopicId = (typeof SUPPORT_TOPICS)[number]["id"];
