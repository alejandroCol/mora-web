import type { Metadata, Viewport } from "next";
import { BRAND } from "@/brand";
import { AppChrome } from "@/components/AppChrome";
import { FirebaseAnalytics } from "@/components/FirebaseAnalytics";
import { GrowthStack } from "@/components/growth/GrowthStack";
import { SalesProvider } from "@/components/sales/SalesProvider";
import { JsonLd } from "@/components/seo/JsonLd";
import { siteOrigin } from "@/lib/site";
import { getSalesPresentation } from "@/server/salesPolicy";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const origin = siteOrigin();
  const google = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  const sales = await getSalesPresentation();
  return {
    metadataBase: new URL(origin),
    title: {
      default: `${BRAND.name} — ${BRAND.tagline}`,
      template: `%s — ${BRAND.name}`,
    },
    description: sales.brandDescription,
    applicationName: BRAND.name,
    keywords: sales.keywords,
    authors: [{ name: BRAND.name }],
    creator: BRAND.name,
    publisher: BRAND.name,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      locale: "es_CO",
      url: origin,
      siteName: BRAND.name,
      title: `${BRAND.name} — ${BRAND.tagline}`,
      description: sales.brandDescription,
    },
    twitter: {
      card: "summary_large_image",
      title: `${BRAND.name} — ${BRAND.tagline}`,
      description: sales.brandDescription,
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const sales = await getSalesPresentation();
  return (
    <html
      lang="es-CO"
      className="h-full scroll-smooth antialiased"
    >
      <body className="flex min-h-full flex-col bg-paper text-ink">
        <JsonLd sales={sales} />
        <FirebaseAnalytics />
        <GrowthStack />
        <SalesProvider initial={sales}>
          <AppChrome>{children}</AppChrome>
        </SalesProvider>
      </body>
    </html>
  );
}
