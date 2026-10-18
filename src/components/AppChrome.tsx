"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdmin =
    pathname.startsWith("/superadmin") ||
    pathname.startsWith("/acceso") ||
    pathname.startsWith("/circulo") ||
    pathname.startsWith("/encuesta");
  const isGallery = pathname.startsWith("/galeria");
  const isProduct = pathname.startsWith("/anillo");

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

  if (isProduct) {
    return (
      <>
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <CartDrawer />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <CartDrawer />
    </>
  );
}
