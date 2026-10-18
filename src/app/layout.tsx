import type { Metadata, Viewport } from "next";
import { BRAND } from "@/brand";
import { AppChrome } from "@/components/AppChrome";
import { FirebaseAnalytics } from "@/components/FirebaseAnalytics";
import { GrowthStack } from "@/components/growth/GrowthStack";
import { WhatsAppDock } from "@/components/growth/WhatsAppDock";
import { JsonLd } from "@/components/seo/JsonLd";
import { siteOrigin } from "@/lib/site";
import "./globals.css";

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
    description: BRAND.description,
    applicationName: BRAND.name,
    keywords: [
      "anillo inteligente",
      "smart ring Colombia",
      "Mora ring",
      "Mora Pro",
      "Mora Ultra",
      "preventa",
      "anillo de titanio",
      "anillo de cerámica",
    ],
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
      description: BRAND.description,
    },
    twitter: {
      card: "summary_large_image",
      title: `${BRAND.name} — ${BRAND.tagline}`,
      description: BRAND.description,
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
      className="h-full scroll-smooth antialiased"
    >
      <body className="flex min-h-full flex-col bg-paper text-ink">
        <JsonLd />
        <FirebaseAnalytics />
        <GrowthStack />
        <AppChrome>{children}</AppChrome>
        <WhatsAppDock />
      </body>
    </html>
  );
}
