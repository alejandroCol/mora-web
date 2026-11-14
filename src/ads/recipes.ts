import type { AdsAudienceKey, AdsRecipeId, AdsWebEvent } from "./types";

export type AdsRecipe = {
  id: AdsRecipeId;
  label: string;
  /** Qué hace, en una línea. */
  what: string;
  /** Cuándo conviene. */
  when: string;
  destination: "whatsapp" | "web";
  /** Va solo a gente que ya conoce a Mora: exige audiencias y segmentación exacta. */
  remarketing: boolean;
  /** Audiencias de Mora que entran marcadas si existen. */
  include: AdsAudienceKey[];
  exclude: AdsAudienceKey[];
};

export const RECIPES: AdsRecipe[] = [
  {
    id: "whatsapp",
    label: "Chats por WhatsApp",
    what: "Gente nueva que toca el anuncio y te escribe.",
    when: "Para vender conversando. Es donde hoy llegan los chats.",
    destination: "whatsapp",
    remarketing: false,
    include: [],
    exclude: ["customers"],
  },
  {
    id: "web",
    label: "Ventas en la web",
    what: "Gente nueva que llega a moraring.com a comprar.",
    when: "Cuando la web ya esté cerrando ventas sola. Con pocas compras, Meta no aprende.",
    destination: "web",
    remarketing: false,
    include: [],
    exclude: ["customers"],
  },
  {
    id: "remarketing_whatsapp",
    label: "Volver a escribirles",
    what: "A quien ya te vio, visitó la web o escribió y no compró: un empujón para que escriba.",
    when: "Barata y con poca gente. Sirve cuando las audiencias ya tienen personas.",
    destination: "whatsapp",
    remarketing: true,
    include: ["interested", "carts", "web_visitors", "ig_engagers"],
    exclude: ["customers"],
  },
  {
    id: "remarketing_web",
    label: "Volver a la web",
    what: "A quien visitó la web o dejó el carrito: que vuelva y pague.",
    when: "Cuando hay visitas y carritos sin compra.",
    destination: "web",
    remarketing: true,
    include: ["web_cart", "carts", "web_visitors"],
    exclude: ["customers"],
  },
];

export function recipeOf(id: string | undefined) {
  return RECIPES.find((recipe) => recipe.id === id);
}

export const WEB_EVENT_LABEL: Record<AdsWebEvent, string> = {
  PURCHASE: "Compras",
  INITIATED_CHECKOUT: "Pagos iniciados",
  ADD_TO_CART: "Agregar al carrito",
};

export const MAX_ADS_PER_CAMPAIGN = 4;
