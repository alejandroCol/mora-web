"use client";

import { useEffect, useRef, useState } from "react";

const frames = [
  {
    kicker: "01",
    title: "3,3 g",
    body: "Casi no está. Eso es el lujo.",
  },
  {
    kicker: "02",
    title: "Invisible",
    body: "Sensores, pulso, sueño. Nada de eso pide pantalla.",
  },
  {
    kicker: "03",
    title: "Dos materias",
    body: "Cera o Titan. El mismo silencio. Otra piel.",
  },
];

export function Film() {
  const rail = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const node = rail.current;
    if (!node) return;

    const onScroll = () => {
      const total = node.offsetHeight - window.innerHeight;
      if (total <= 0) return;
      const progress = Math.min(1, Math.max(0, -node.getBoundingClientRect().top / total));
      setIndex(
        Math.min(
          frames.length - 1,
          Math.max(0, Math.floor(progress * frames.length)),
        ),
      );
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const frame = frames[index];

  return (
    <section ref={rail} className="relative h-[240vh] bg-[#f3f2f8]">
      <div className="sticky top-0 flex h-dvh items-center justify-center overflow-hidden px-6">
        <div
          key={frame.kicker}
          className="frame-in mx-auto max-w-3xl text-center"
        >
          <p className="kicker">{frame.kicker}</p>
          <h2 className="title-film mt-7 text-[clamp(3.6rem,11vw,8.4rem)] text-ink">
            {frame.title}
          </h2>
          <p className="mx-auto mt-8 max-w-sm text-[16px] leading-8 text-soft">
            {frame.body}
          </p>
        </div>
        <div className="pointer-events-none absolute bottom-10 left-1/2 flex -translate-x-1/2 gap-2">
          {frames.map((item, i) => (
            <span
              key={item.kicker}
              className={`h-1 w-6 rounded-full transition-colors ${
                i === index ? "bg-ink" : "bg-ink/15"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
