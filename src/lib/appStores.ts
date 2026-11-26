/**
 * Fichas de Mora Ring en las tiendas.
 * iPhone abre la ficha de Mora en el App Store.
 * Android abre la ficha de Mora en Play Store.
 * Los botones de /descargas leen este archivo.
 *
 * TestFlight sirve a /descarga-testers (link directo para quien no ve Mora en su
 * App Store, p. ej. Apple ID de otro país) y a /descargas/iphone, que ya no se enlaza.
 */
export const APP_STORES = {
  ios: "https://apps.apple.com/co/app/mora-ring/id6830425313?l=en-GB",
  android: "https://play.google.com/store/apps/details?id=mora.ring&pcampaignid=web_share",
  /** App TestFlight en el App Store. */
  testflight: "https://apps.apple.com/app/testflight/id899247664",
  /** Invitación a la prueba de Mora Ring. */
  testflightJoin: "https://testflight.apple.com/join/88xc7M3e",
} as const;

export type AppStoreId = keyof typeof APP_STORES;
