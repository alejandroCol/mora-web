"use client";

import { catalog, formatMoney } from "@/lib/catalog";
import { useMoraStore } from "@/lib/store";

export function Atelier() {
  const setModel = useMoraStore((state) => state.setModel);

  return (
    <section id="coleccion" className="bg-paper">
      <div className="flex snap-x snap-mandatory overflow-x-auto hide-scroll">
        {catalog.map((item, index) => (
          <article
            key={item.id}
            className={`flex min-h-dvh min-w-full snap-center flex-col justify-end px-6 pb-16 pt-24 sm:px-16 sm:pb-20 sm:pt-28 ${
              index === 0 ? "bg-[#f7f5fb]" : "bg-[#eef1f7]"
            }`}
          >
            <p className="kicker">
              {String(index + 1).padStart(2, "0")} · {item.line}
            </p>
            <h2 className="title-name mt-5 text-[clamp(4.4rem,16vw,10rem)] text-ink">
              {item.name}
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-soft sm:mt-8 sm:text-[16px] sm:leading-8">
              {item.promise}
            </p>
            <ul className="mt-6 max-w-sm space-y-2 text-[14px] text-ink/75 sm:mt-10 sm:text-[15px]">
              {item.details.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="mt-8 flex items-center justify-between gap-6 sm:mt-12">
              <p className="text-[15px] text-ink">{formatMoney(item.price)}</p>
              <a
                href="#reservar"
                onClick={() => setModel(item.id)}
                className="text-[15px] text-ink underline decoration-ink/20 underline-offset-4 hover:decoration-ink"
              >
                Quedármelo
              </a>
            </div>
            <p className="mt-10 text-[13px] text-soft sm:mt-16">
              {index === 0 ? "Desliza hacia Titan →" : "← Aero"}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
