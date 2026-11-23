"use client";

import { useState } from "react";
import { FilmSheet } from "@/components/uso/FilmSheet";
import { TUTORIALS } from "@/components/uso/tutorials";
import "./uso.css";

export function UsoExperience({ initialId }: { initialId?: string }) {
  const known = TUTORIALS.find((item) => item.id === initialId)?.id ?? null;
  const [openId, setOpenId] = useState<string | null>(known);
  const open = TUTORIALS.find((item) => item.id === openId) ?? null;

  function choose(id: string) {
    setOpenId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("t", id);
    window.history.replaceState(null, "", url);
  }

  function close() {
    setOpenId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("t");
    window.history.replaceState(null, "", url);
  }

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col px-5 pb-12 pt-2 sm:pt-6">
      <p className="kicker mt-6">Tutoriales</p>
      <h1 className="display mt-2 text-[clamp(2.4rem,6vw,3.6rem)] text-[#2c2648]">Uso de mi Mora</h1>
      <p className="title-whisper mt-3 max-w-md text-[1.05rem] leading-7 text-[#5e5878]">Elige uno y míralo.</p>

      <ul className="mt-8 overflow-hidden rounded-[1.35rem] bg-white/90 shadow-[0_18px_50px_rgba(70,50,130,0.1)] ring-1 ring-white">
        {TUTORIALS.map((item, index) => (
          <li key={item.id} className={index > 0 ? "border-t border-[rgba(22,20,31,0.08)]" : undefined}>
            <button
              type="button"
              onClick={() => choose(item.id)}
              className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6f61b8]"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-medium tracking-[-0.03em] text-[#2c2648]">{item.title}</span>
                <span className="mt-0.5 block text-[14px] leading-5 text-[#6a6488]">{item.lead}</span>
              </span>
              <span className="shrink-0 text-[13px] tracking-[-0.01em] text-[#8a84a0]">{item.time}</span>
              <span aria-hidden className="shrink-0 text-[1.35rem] font-light leading-none text-[#b7b0cc]">
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>

      {open ? <FilmSheet key={open.src} src={open.src} label={open.title} title={open.title} onClose={close} /> : null}
    </main>
  );
}
