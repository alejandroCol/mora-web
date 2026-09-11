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
            className={`flex min-h-dvh min-w-full snap-center flex-col justify-end px-8 pb-20 pt-28 sm:px-16 ${
              index === 0 ? "bg-[#f7f5fb]" : "bg-[#eef1f7]"
            }`}
          >
            <p className="kicker">
              {String(index + 1).padStart(2, "0")} · {item.line}
            </p>
            <h2 className="title-name mt-5 text-[clamp(4.4rem,16vw,10rem)] text-ink">
              {item.name}
            </h2>
            <p className="mt-8 max-w-md text-[16px] leading-8 text-soft">
              {item.promise}
            </p>
            <ul className="mt-10 max-w-sm space-y-2 text-[15px] text-ink/75">
              {item.details.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="mt-12 flex items-center justify-between gap-6">
              <p className="text-[15px] text-ink">{formatMoney(item.price)}</p>
              <a
                href="#reservar"
                onClick={() => setModel(item.id)}
                className="text-[15px] text-ink underline decoration-ink/20 underline-offset-4 hover:decoration-ink"
              >
                Quedármelo
              </a>
            </div>
            <p className="mt-16 text-[13px] text-soft">
              {index === 0 ? "Desliza hacia Titan →" : "← Cera"}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
