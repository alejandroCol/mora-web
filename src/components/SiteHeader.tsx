import Link from "next/link";
import { BRAND } from "@/brand";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { CartButton } from "@/components/cart/CartDrawer";
import { IconOrder } from "@/components/icons/NavIcons";

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:h-[4.25rem] sm:px-6">
        <Link href="/" aria-label={BRAND.name} className="flex items-center">
          <BrandLogo
            variant="wordmark"
            priority
            className="h-[1.35rem] w-auto max-w-[6.25rem] object-contain object-left sm:h-8 md:h-9"
          />
        </Link>
        <div className="flex items-center gap-5 sm:gap-6">
          <Link
            href="/pedido"
            aria-label="Mi pedido"
            className="text-ink transition-opacity hover:opacity-55"
          >
            <IconOrder className="h-[19px] w-[19px] sm:h-5 sm:w-5" />
          </Link>
          <CartButton />
        </div>
      </div>
    </header>
  );
}
