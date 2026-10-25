"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { useInsightHome } from "@/insights/client";

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdmin =
    pathname.startsWith("/superadmin") ||
    pathname.startsWith("/acceso") ||
    pathname.startsWith("/circulo") ||
    pathname.startsWith("/encuesta") ||
    pathname.startsWith("/creadores");
  const isGallery = pathname.startsWith("/galeria");
  const isProduct = pathname.startsWith("/anillo");
  const isCheckout = pathname.startsWith("/checkout");
  const isPago = pathname.startsWith("/pago");
  const isDownload = pathname.startsWith("/descargas");
  const isAnim = pathname.startsWith("/anim");

  if (isAdmin) {
    return <>{children}</>;
  }

  if (isGallery) {
    return (
      <>
        {children}
        <CartDrawer />
      </>
    );
  }

  if (isDownload || isAnim) {
    return <>{children}</>;
  }

  if (isPago) {
    return <main className="flex-1">{children}</main>;
  }

  if (isProduct || isCheckout) {
    return (
      <>
        <SiteHeader solid={isCheckout} />
        <main className="flex-1">{children}</main>
        <CartDrawer />
      </>
    );
  }

  return (
    <>
      {pathname === "/" ? <HomeInsight /> : null}
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <CartDrawer />
    </>
  );
}

function HomeInsight() {
  useInsightHome();
  return null;
}
