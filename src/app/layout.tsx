import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { FirebaseAnalytics } from "@/components/FirebaseAnalytics";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const sans = Inter({
  variable: "--font-sans-loaded",
  subsets: ["latin"],
});

const display = Fraunces({
  variable: "--font-display-loaded",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT", "WONK"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Mora — Un anillo. Un estado.",
  description:
    "Smart ring de lujo silencioso. Aero en cerámica y Titan en titanio.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${sans.variable} ${display.variable} h-full scroll-smooth antialiased`}
    >
      <body className="flex min-h-full flex-col bg-paper text-ink">
        <FirebaseAnalytics />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
