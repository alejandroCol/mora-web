import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-end sm:justify-between sm:gap-8 sm:py-14">
        <div>
          <p className="mark text-lg text-ink">Mora</p>
          <p className="mt-3 max-w-xs text-[15px] leading-6 text-soft">
            Un anillo. Un estado. Hecho para estar, no para exhibirse.
          </p>
        </div>
        <div className="flex gap-8 text-[13px] text-soft">
          <Link href="/#coleccion" className="hover:text-ink">
            Colección
          </Link>
          <Link href="/#reservar" className="hover:text-ink">
            Reservar
          </Link>
        </div>
      </div>
    </footer>
  );
}
