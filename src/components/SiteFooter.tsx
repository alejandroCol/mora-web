import Link from "next/link";
import { BRAND } from "@/brand";
import { BrandLogo } from "@/components/brand/BrandLogo";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-end sm:justify-between sm:gap-8 sm:py-14">
        <div>
          <BrandLogo variant="mark" className="h-8 w-8 object-contain" />
          <p className="mt-3 max-w-xs text-[15px] leading-6 text-soft">
            Mora Pro y Mora Ultra. Preventa con entrega el 20 de noviembre.
          </p>
        </div>
        <div className="flex gap-8 text-[13px] text-soft">
          <Link href="/#preventa" className="hover:text-ink">
            Preventa
          </Link>
          <Link href="/#coleccion" className="hover:text-ink">
            Colección
          </Link>
          <Link href="/anillo/pro" className="hover:text-ink">
            Pro
          </Link>
          <Link href="/anillo/ultra" className="hover:text-ink">
            Ultra
          </Link>
          <Link href="/talla" className="hover:text-ink">
            Mi talla
          </Link>
          <Link href="/pedido" className="hover:text-ink">
            Mi pedido
          </Link>
          <Link href="/privacidad" className="hover:text-ink">
            Privacidad
          </Link>
          <Link href="/app/eliminar-cuenta" className="hover:text-ink">
            Borrar cuenta
          </Link>
        </div>
      </div>
    </footer>
  );
}
