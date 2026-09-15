import { FAQ } from "@/components/seo/JsonLd";

export function Faq() {
  return (
    <section id="preguntas" className="border-t border-line bg-paper">
      <div className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
        <p className="kicker">Preguntas</p>
        <h2 className="mt-3 text-[clamp(2rem,7vw,3.2rem)] leading-[1.08] tracking-[-0.04em] text-ink">
          Lo que suelen preguntar.
        </h2>
        <dl className="mt-10 divide-y divide-line">
          {FAQ.map((item) => (
            <div key={item.q} className="py-5">
              <dt className="text-[15px] text-ink">{item.q}</dt>
              <dd className="mt-2 text-[14px] leading-7 text-soft">{item.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
