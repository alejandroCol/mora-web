import Link from "next/link";
import { BRAND } from "@/brand";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { PRESALE } from "@/lib/presale";

const COLUMNS = [
  {
    title: "Anillos",
    links: [
      { href: "/anillo/pro", label: "Mora Pro" },
      { href: "/anillo/ultra", label: "Mora Ultra" },
      { href: "/#coleccion", label: "Colección" },
      { href: "/#preventa", label: "Preventa" },
    ],
  },
  {
    title: "Pedido",
    links: [
      { href: "/pedido", label: "Mi pedido" },
      { href: "/talla", label: "Mi talla" },
      { href: "/#preguntas", label: "Preguntas" },
    ],
  },
  {
    title: "Casa",
    links: [
      { href: "/privacidad", label: "Privacidad" },
      { href: "/terminos", label: "Condiciones" },
      { href: "/app/eliminar-cuenta", label: "Borrar cuenta" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="mx-auto max-w-6xl px-6 py-14 sm:py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.6fr)] lg:gap-16">
          <div>
            <Link href="/" aria-label={BRAND.name} className="inline-flex">
              <BrandLogo
                variant="wordmark"
                className="h-8 w-auto max-w-[7.5rem] object-contain object-left"
              />
            </Link>
            <p className="mt-5 max-w-[16rem] text-[15px] leading-6 tracking-[-0.018em] text-ink">
              {BRAND.tagline}
            </p>
            <p className="mt-2 max-w-xs text-[13px] leading-6 text-soft">
              {PRESALE.promise} Envío cotizado al instante en Colombia.
            </p>
          </div>

          <nav
            aria-label="Pie de página"
            className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3"
          >
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="text-[11px] tracking-[0.14em] text-soft uppercase">
                  {column.title}
                </p>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-[14px] tracking-[-0.014em] text-ink/80 transition-colors hover:text-ink"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-line pt-6 text-[12px] leading-5 text-soft sm:mt-16 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {BRAND.name} · Colombia</p>
          <p>
            <a href="mailto:hola@mora.ring" className="hover:text-ink">
              hola@mora.ring
            </a>
            <span aria-hidden className="px-2 text-[#c8c4d4]">
              ·
            </span>
            Entrega el {PRESALE.deliveryLabel}
          </p>
        </div>
      </div>
    </footer>
  );
}
