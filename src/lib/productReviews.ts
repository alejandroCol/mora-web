/**
 * Reseñas de la ficha. Todo lo que el comprador lee como «dicho por un cliente» sale de aquí:
 * cambia el texto por las palabras reales de cada persona y la página se actualiza sola.
 */

export type ProductReview = {
  id: string;
  name: string;
  /** De 1 a 5. */
  stars: number;
  title: string;
  text: string;
};

export const productReviews: ProductReview[] = [
  {
    id: "val",
    name: "Val",
    stars: 5,
    title: "Ni lo siento al dormir",
    text: "Lo uso para dormir y ni lo siento. Me levanto, abro la app y ahí está mi noche. Todo en español y fácil de entender.",
  },
  {
    id: "juan",
    name: "Juan",
    stars: 5,
    title: "Discreto, sin pantalla",
    text: "Quería algo más discreto que un reloj. Me lleva el pulso y los pasos sin pantalla ni notificaciones, y la batería dura varios días.",
  },
  {
    id: "lina",
    name: "Lina",
    stars: 5,
    title: "La talla, perfecta",
    text: "Pedí el medidor porque no sabía mi talla y quedó perfecto. Lo que más uso es Vínculo, para saber cómo va el día de mi mamá.",
  },
];
