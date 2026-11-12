import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { BRAND } from "@/brand";
import { FALLBACK_SALES } from "@/commerce/sales";
import { AppChrome } from "@/components/AppChrome";
import { FirebaseAnalytics } from "@/components/FirebaseAnalytics";
import { GrowthStack } from "@/components/growth/GrowthStack";
import { SalesProvider } from "@/components/sales/SalesProvider";
import { OrgJsonLd } from "@/components/seo/JsonLd";
import { AnchorGlide } from "@/components/site/AnchorGlide";
import { ScreenFit } from "@/components/site/ScreenFit";
import { siteOrigin } from "@/lib/site";
import "./globals.css";

// Roboto va en el repo (`./fonts`), no se pide a Google al compilar. `next/font/google` baja el CSS en
// cada build, y si Google responde con URLs de fuente que traen query (`…/l/font?kit=…&skey=…`),
// Turbopack 16.3.4 falla con «next/font/google queries have exactly one entry» (despliegue caído el
// 2026-11-10). El archivo es el latín variable de Roboto v51; se declaran los mismos cinco pesos que
// antes para que nada cambie a la vista.
// (El cargador de fuentes solo acepta literales: por eso la lista va escrita entera.)
const roboto = localFont({
  src: [
    { path: "./fonts/roboto-latin.woff2", weight: "100", style: "normal" },
    { path: "./fonts/roboto-latin.woff2", weight: "300", style: "normal" },
    { path: "./fonts/roboto-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/roboto-latin.woff2", weight: "500", style: "normal" },
    { path: "./fonts/roboto-latin.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-roboto",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export function generateMetadata(): Metadata {
  const origin = siteOrigin();
  const google = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  return {
    metadataBase: new URL(origin),
    title: {
      default: `${BRAND.name} — ${BRAND.tagline}`,
      template: `%s — ${BRAND.name}`,
    },
    description: FALLBACK_SALES.brandDescription,
    applicationName: BRAND.name,
    keywords: FALLBACK_SALES.keywords,
    authors: [{ name: BRAND.name }],
    creator: BRAND.name,
    publisher: BRAND.name,
    openGraph: {
      type: "website",
      locale: "es_CO",
      url: origin,
      siteName: BRAND.name,
      title: `${BRAND.name} — ${BRAND.tagline}`,
      description: FALLBACK_SALES.brandDescription,
    },
    twitter: {
      card: "summary_large_image",
      title: `${BRAND.name} — ${BRAND.tagline}`,
      description: FALLBACK_SALES.brandDescription,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
    verification: google ? { google } : undefined,
    icons: {
      icon: [{ url: BRAND.assets.favicon, type: "image/png", sizes: "32x32" }],
      apple: [{ url: BRAND.assets.apple, sizes: "180x180" }],
    },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-CO"
      className={`${roboto.variable} h-full scroll-smooth antialiased`}
    >
      <body className="flex min-h-full flex-col bg-paper text-ink">
        <OrgJsonLd sales={FALLBACK_SALES} />
        <FirebaseAnalytics />
        <GrowthStack />
        <SalesProvider initial={FALLBACK_SALES}>
          <AppChrome>{children}</AppChrome>
        </SalesProvider>
        <ScreenFit />
        <AnchorGlide />
      </body>
    </html>
  );
}
