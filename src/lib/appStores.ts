/**
 * Fichas de Mora Ring en las tiendas.
 * iPhone va por TestFlight: primero la app de Apple, luego Mora Ring.
 * Android abre la ficha de Mora en Play Store.
 * Los botones de /descargas leen este archivo.
 */
export const APP_STORES = {
  /** App TestFlight en el App Store. */
  testflight: "https://apps.apple.com/app/testflight/id899247664",
  /** Invitación a la prueba de Mora Ring. */
  ios: "https://testflight.apple.com/join/88xc7M3e",
  android: "https://play.google.com/store/apps/details?id=mora.ring&pcampaignid=web_share",
} as const;

export type AppStoreId = keyof typeof APP_STORES;
