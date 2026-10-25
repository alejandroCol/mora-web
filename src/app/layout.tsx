import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import { BRAND } from "@/brand";
import { FALLBACK_SALES } from "@/commerce/sales";
import { AppChrome } from "@/components/AppChrome";
import { FirebaseAnalytics } from "@/components/FirebaseAnalytics";
import { GrowthStack } from "@/components/growth/GrowthStack";
import { SalesProvider } from "@/components/sales/SalesProvider";
import { JsonLd } from "@/components/seo/JsonLd";
import { siteOrigin } from "@/lib/site";
import "./globals.css";

const roboto = Roboto({
  weight: ["100", "300", "400", "500", "700"],
  subsets: ["latin"],
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
    alternates: { canonical: "/" },
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
        <JsonLd sales={FALLBACK_SALES} />
        <FirebaseAnalytics />
        <GrowthStack />
        <SalesProvider initial={FALLBACK_SALES}>
          <AppChrome>{children}</AppChrome>
        </SalesProvider>
      </body>
    </html>
  );
}
