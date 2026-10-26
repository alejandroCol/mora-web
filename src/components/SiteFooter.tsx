import Link from "next/link";
import { BRAND } from "@/brand";
import { BrandLogo } from "@/components/brand/BrandLogo";

const LINKS = [
  { href: "/anillo/pro", label: "Pro" },
  { href: "/anillo/ultra", label: "Ultra" },
  { href: "/case", label: "Case" },
  { href: "/descargas", label: "App" },
  { href: "/pedido", label: "Pedido" },
  { href: "/talla", label: "Talla" },
  { href: "/creadores", label: "Creadores" },
  { href: "/envios-y-garantia", label: "Envíos y garantía" },
  { href: "/privacidad", label: "Privacidad" },
  { href: "/terminos", label: "Condiciones" },
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-foot">
        <div className="site-foot-brand">
          <Link href="/" aria-label={BRAND.name} className="inline-flex">
            <BrandLogo
              variant="wordmark"
              className="h-6 w-auto max-w-[5.5rem] object-contain object-left sm:h-7 sm:max-w-[6.25rem]"
            />
          </Link>
          <p>{BRAND.tagline}</p>
        </div>
        <nav aria-label="Pie de página" className="site-foot-links">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Contacto" className="site-foot-social">
          <a href={BRAND.contact.instagram} target="_blank" rel="noreferrer">
            Instagram
          </a>
          <a href={BRAND.contact.whatsapp} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          <a href={`mailto:${BRAND.contact.email}`}>Correo</a>
        </nav>
        <p className="site-foot-copy">© {new Date().getFullYear()} {BRAND.name}</p>
      </div>
    </footer>
  );
}
