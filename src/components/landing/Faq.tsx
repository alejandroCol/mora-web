"use client";

import Link from "next/link";
import { BRAND } from "@/brand";
import { storeFaq } from "@/commerce/sales";
import { WhatsAppLink } from "@/components/growth/WhatsAppLink";
import { useSales } from "@/components/sales/SalesProvider";

export function Faq() {
  const sales = useSales();
  const items = storeFaq(sales);
  return (
    <section id="preguntas" className="faq-stage scroll-mt-24">
      <div className="mx-auto max-w-xl px-6 py-20 sm:py-28">
        <h2 className="text-[clamp(2.1rem,8vw,3.4rem)] leading-[1.06] tracking-[-0.045em] text-ink">
          Lo que suelen preguntar.
        </h2>
        <div className="faq-list">
          {items.map((item) => (
            <details key={item.q} className="faq-item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-8 flex flex-col items-start gap-3 text-[13px] tracking-[-0.012em] text-[#86868b]">
          <p className="text-[15px] tracking-normal text-ink">¿Más dudas?</p>
          <WhatsAppLink className="transition-colors hover:text-[#1d1d1f]" prefill="Hola Mora, tengo una duda.">
            Escríbenos por WhatsApp
          </WhatsAppLink>
          <Link href="/envios-y-garantia" className="transition-colors hover:text-[#1d1d1f]">
            Envíos, cambios y garantía
            <span aria-hidden> ›</span>
          </Link>
          <a
            href={BRAND.contact.instagram}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-[#1d1d1f]"
          >
            Instagram
          </a>
        </div>
      </div>
    </section>
  );
}
