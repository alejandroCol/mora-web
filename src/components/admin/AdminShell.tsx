"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { BRAND } from "@/brand";
import { BrandLoader } from "@/components/brand/BrandLoader";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ROLE_LABEL, type StaffPermission } from "@/commerce/roles";
import { getFirebaseAuth } from "@/lib/firebase";
import { AdminAuthProvider, useAdminAuth } from "./AdminAuth";

const NAV: { href: string; label: string; permission: StaffPermission; icon: ReactNode }[] = [
  { href: "/superadmin/ventas", label: "Ventas", permission: "sales", icon: <BagIcon /> },
  { href: "/superadmin/presupuesto", label: "Presupuesto", permission: "budget", icon: <BookIcon /> },
  { href: "/superadmin/whatsapp", label: "WhatsApp", permission: "whatsapp", icon: <ChatIcon /> },
  { href: "/superadmin/campanas", label: "Campañas", permission: "growth", icon: <MegaphoneIcon /> },
  { href: "/superadmin/estadisticas", label: "Estadísticas", permission: "stats", icon: <ChartIcon /> },
  { href: "/superadmin/inventario", label: "Inventario", permission: "inventory", icon: <BoxIcon /> },
  { href: "/superadmin/galeria", label: "Galería", permission: "gallery", icon: <ImageIcon /> },
  { href: "/superadmin/envios", label: "Origen y envíos", permission: "shipping", icon: <TruckIcon /> },
  { href: "/superadmin/equipo", label: "Equipo", permission: "team", icon: <PeopleIcon /> },
];

function Shell({ children }: { children: ReactNode }) {
  const { user, loading, me, can } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();
  const links = NAV.filter((item) => can(item.permission));
  const current = links.find((item) => pathname.startsWith(item.href));
  const collapsed = useSyncExternalStore(
    subscribeNav,
    () => window.localStorage.getItem("mora-admin-nav") === "collapsed",
    () => false,
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/acceso");
  }, [loading, user, router]);

  useEffect(() => {
    if (loading || !me) return;
    const page = NAV.find((item) => pathname.startsWith(item.href));
    if (page && !can(page.permission)) router.replace("/superadmin/ventas");
  }, [loading, me, pathname, can, router]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  function toggleCollapsed() {
    window.localStorage.setItem("mora-admin-nav", collapsed ? "open" : "collapsed");
    window.dispatchEvent(new Event("mora-admin-nav"));
  }

  if (loading || !user) {
    return (
      <div className="admin-app grid min-h-dvh place-items-center">
        <BrandLoader label="Entrando" />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="admin-app grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="text-lg">Esta cuenta no está en el equipo.</p>
          <button type="button" onClick={() => void signOut(getFirebaseAuth())} className="admin-ghost mt-6">
            Salir
          </button>
        </div>
      </div>
    );
  }

  const sidebar = (
    <aside
      className={`admin-sidebar ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-open" : ""}`}
      aria-label="Panel"
    >
      <div className="admin-brand">
        <Link href="/superadmin/ventas" aria-label={BRAND.name} className="min-w-0">
          <BrandLogo
            variant={collapsed ? "mark" : "wordmark"}
            className={`h-7 w-auto object-contain object-left ${collapsed ? "max-w-8" : "admin-wordmark max-w-[7.2rem]"}`}
          />
        </Link>
        <button
          type="button"
          className="admin-icon-btn ml-auto hidden lg:grid"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Abrir menú" : "Cerrar menú"}
        >
          <ChevronIcon flipped={collapsed} />
        </button>
        <button
          type="button"
          className="admin-icon-btn ml-auto lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
        >
          <CloseIcon />
        </button>
      </div>
      <p className="admin-role mt-2 px-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--admin-sidebar-muted)]">
        {ROLE_LABEL[me.role]}
      </p>
      <nav className="admin-nav">
        {links.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`admin-nav-link ${active ? "is-active" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              <span className="admin-nav-ico">{item.icon}</span>
              <span className="admin-nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="admin-side-foot">
        <p>{me.name || me.email}</p>
        <button type="button" onClick={() => void signOut(getFirebaseAuth())} className="admin-ghost mt-2">
          <span className="admin-nav-label">Salir</span>
        </button>
      </div>
    </aside>
  );

  return (
    <div className="admin-app">
      <div className="admin-shell">
        {mobileOpen ? (
          <button type="button" className="admin-backdrop lg:hidden" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} />
        ) : null}
        {sidebar}
        <div className="min-w-0 flex-1">
          <header className="admin-topbar lg:hidden">
            <div className="admin-topbar-inner">
              <button type="button" className="admin-icon-btn" onClick={() => setMobileOpen(true)} aria-label="Abrir menú">
                <MenuIcon />
              </button>
              <h1>{current?.label ?? "Mora"}</h1>
              <Link href="/superadmin/ventas" aria-label={BRAND.name} className="shrink-0">
                <BrandLogo variant="mark" className="h-7 w-7 object-contain" />
              </Link>
            </div>
          </header>
          <div className="admin-main">{children}</div>
        </div>
      </div>
    </div>
  );
}

function subscribeNav(onChange: () => void) {
  window.addEventListener("mora-admin-nav", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("mora-admin-nav", onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <Shell>{children}</Shell>
    </AdminAuthProvider>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ flipped }: { flipped: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
      style={{ transform: flipped ? "rotate(180deg)" : undefined }}
    >
      <path d="M14 6 8 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M6 7h12l-1 13H7L6 7Z" strokeLinejoin="round" />
      <path d="M9 7V5a3 3 0 0 1 6 0v2" strokeLinecap="round" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H20v16H7.5A2.5 2.5 0 0 0 5 21.5V5.5Z" />
      <path d="M5 18.5A2.5 2.5 0 0 1 7.5 16H20" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M5 18.5 3.5 21 8 18.8A9 9 0 1 0 5 18.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function MegaphoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M4 10v4h3l8 4V6L7 10H4Z" strokeLinejoin="round" />
      <path d="M16.5 9.5a3 3 0 0 1 0 5" strokeLinecap="round" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M4 19h16" strokeLinecap="round" />
      <path d="M7 16v-5M12 16V7M17 16v-8" strokeLinecap="round" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z" strokeLinejoin="round" />
      <path d="M12 12 3.5 7.5M12 12v9M12 12l8.5-4.5" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="m3.5 15.5 4.5-4 4 3.5 3-2.5 5 5" strokeLinejoin="round" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M3 7h11v10H3z" />
      <path d="M14 10h4l3 3v4h-7" />
      <circle cx="7" cy="18.5" r="1.4" />
      <circle cx="17" cy="18.5" r="1.4" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <circle cx="9" cy="8" r="2.4" />
      <path d="M4.5 18a4.5 4.5 0 0 1 9 0" />
      <circle cx="16.5" cy="8.5" r="2" />
      <path d="M15 18a3.8 3.8 0 0 1 5.5 0" />
    </svg>
  );
}
