/**
 * Fichas de Mora Ring en las tiendas.
 * Cuando estén los enlaces definitivos, cambia solo estas dos cadenas.
 * Los botones de /descargas leen este archivo.
 */
export const APP_STORES = {
  ios: "https://apps.apple.com",
  android: "https://play.google.com/store/apps",
} as const;

export type AppStoreId = keyof typeof APP_STORES;
