"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdmin =
    pathname.startsWith("/superadmin") || pathname.startsWith("/acceso");
  const isGallery = pathname.startsWith("/galeria");

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

  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <CartDrawer />
    </>
  );
}
