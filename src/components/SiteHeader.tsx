import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="mark text-[17px] text-ink">
          Mora
        </Link>
        <nav className="hidden items-center gap-8 text-[13px] text-soft sm:flex">
          <a href="#coleccion" className="transition-colors hover:text-ink">
            Colección
          </a>
          <a href="#reservar" className="transition-colors hover:text-ink">
            Elegir
          </a>
        </nav>
        <Link
          href="/#reservar"
          className="text-[13px] text-ink transition-opacity hover:opacity-55"
        >
          Reservar
        </Link>
      </div>
    </header>
  );
}
