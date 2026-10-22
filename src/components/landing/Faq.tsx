"use client";

import { BRAND } from "@/brand";
import { storeFaq } from "@/commerce/sales";
import { useSales } from "@/components/sales/SalesProvider";

export function Faq() {
  const sales = useSales();
  const items = storeFaq(sales);
  return (
    <section id="preguntas" className="faq-stage">
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
        <a
          href={BRAND.contact.instagram}
          target="_blank"
          rel="noreferrer"
          className="faq-ig"
        >
          Instagram
        </a>
      </div>
    </section>
  );
}
