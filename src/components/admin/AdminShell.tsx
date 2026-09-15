"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { useEffect, type ReactNode } from "react";
import { BRAND } from "@/brand";
import { BrandLoader } from "@/components/brand/BrandLoader";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  ROLE_LABEL,
  type StaffPermission,
} from "@/commerce/roles";
import { getFirebaseAuth } from "@/lib/firebase";
import { AdminAuthProvider, useAdminAuth } from "./AdminAuth";

const NAV: { href: string; label: string; permission: StaffPermission }[] = [
  { href: "/superadmin/ventas", label: "Ventas", permission: "sales" },
  { href: "/superadmin/whatsapp", label: "WhatsApp", permission: "whatsapp" },
  { href: "/superadmin/campanas", label: "Campañas", permission: "growth" },
  { href: "/superadmin/estadisticas", label: "Estadísticas", permission: "stats" },
  { href: "/superadmin/inventario", label: "Inventario", permission: "inventory" },
  { href: "/superadmin/galeria", label: "Galería", permission: "gallery" },
  { href: "/superadmin/envios", label: "Origen y envíos", permission: "shipping" },
  { href: "/superadmin/equipo", label: "Equipo", permission: "team" },
];

function Shell({ children }: { children: ReactNode }) {
  const { user, loading, me, can } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();
  const links = NAV.filter((item) => can(item.permission));

  useEffect(() => {
    if (!loading && !user) router.replace("/acceso");
  }, [loading, user, router]);

  useEffect(() => {
    if (loading || !me) return;
    const current = NAV.find((item) => pathname.startsWith(item.href));
    if (current && !can(current.permission)) {
      router.replace("/superadmin/ventas");
    }
  }, [loading, me, pathname, can, router]);

  if (loading || !user) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#0e0d14]">
        <BrandLoader label="Abriendo el atelier" />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#0e0d14] px-6 text-center text-[#f4f1ea]">
        <div>
          <p className="text-lg">Esta cuenta no está en el equipo.</p>
          <button
            type="button"
            onClick={() => void signOut(getFirebaseAuth())}
            className="mt-6 text-sm text-white/50"
          >
            Salir
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#0e0d14] text-[#f4f1ea]">
      <div className="mx-auto flex max-w-[1400px]">
        <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-white/8 px-5 py-8 lg:flex">
          <Link href="/superadmin/ventas" aria-label={BRAND.name} className="flex items-center">
            <BrandLogo
              variant="wordmark"
              className="h-7 w-auto max-w-[7rem] object-contain object-left"
            />
          </Link>
          <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-white/35">
            {ROLE_LABEL[me.role]}
          </p>
          <nav className="mt-10 flex flex-col gap-1">
            {links.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3 py-2 text-[13px] ${
                    active ? "bg-white text-[#0e0d14]" : "text-white/55 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto">
            <p className="truncate text-[12px] text-white/45">{me.name || me.email}</p>
            <button
              type="button"
              onClick={() => void signOut(getFirebaseAuth())}
              className="mt-3 text-left text-[12px] text-white/40 hover:text-white"
            >
              Salir
            </button>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="flex items-center gap-3 overflow-x-auto border-b border-white/8 px-4 py-3 lg:hidden">
            <Link href="/superadmin/ventas" aria-label={BRAND.name} className="mr-2 shrink-0">
              <BrandLogo
                variant="wordmark"
                className="h-6 w-auto max-w-[5.5rem] object-contain object-left"
              />
            </Link>
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] ${
                  pathname.startsWith(item.href) ? "bg-white text-[#0e0d14]" : "text-white/60"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </header>
          <div className="px-4 py-6 sm:px-8 sm:py-10">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <Shell>{children}</Shell>
    </AdminAuthProvider>
  );
}
