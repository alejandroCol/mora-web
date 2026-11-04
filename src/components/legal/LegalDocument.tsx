"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BRAND } from "@/brand";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { LangFlags } from "./LangFlags";
import { LEGAL_LANG_COOKIE, type LegalLang } from "./lang";

export const legalLink = "text-ink underline decoration-bloom/80 underline-offset-2";

export type LegalSection = {
  id: string;
  kicker: string;
  title: string;
  body: ReactNode;
};

export type LegalCopy = {
  kicker: string;
  title: string;
  lead: string;
  updated: string;
  navLabel: string;
  intro: ReactNode;
  chips?: string[];
  sections: LegalSection[];
  footer: ReactNode;
};

export function LegalDocument({
  initial,
  copy,
}: {
  initial: LegalLang;
  copy: Record<LegalLang, LegalCopy>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [lang, setLang] = useState<LegalLang>(initial);
  const page = copy[lang];

  useEffect(() => {
    setLang(initial);
  }, [initial]);

  useEffect(() => {
    document.documentElement.lang = lang === "es" ? "es-CO" : "en";
    document.title = `${page.title} — ${BRAND.name}`;
  }, [lang, page.title]);

  function choose(next: LegalLang) {
    if (next === lang) return;
    setLang(next);
    document.cookie = `${LEGAL_LANG_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    router.replace(`${pathname}?lang=${next}`, { scroll: false });
  }

  return (
    <div className="relative overflow-hidden" lang={lang === "es" ? "es-CO" : "en"}>
      <div className="hero-wash border-b border-line">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-28 pt-16 text-center sm:pt-20">
          <div className="frame-in flex flex-col items-center">
            <BrandLogo variant="mark" className="h-14 w-14 object-contain drop-shadow-sm" priority />
            <BrandLogo
              variant="wordmark"
              className="mt-5 h-7 w-auto max-w-[min(100%,220px)] object-contain opacity-90"
              alt=""
            />
            <div className="mt-8">
              <LangFlags lang={lang} onChange={choose} />
            </div>
            <p className="kicker mt-8">{page.kicker}</p>
            <h1 className="display mt-3 text-[clamp(2.1rem,6vw,3.25rem)] leading-[1.06] text-ink">
              {page.title}
            </h1>
            <p className="title-whisper mt-4 max-w-lg text-[clamp(1.05rem,2.8vw,1.25rem)] text-soft">
              {page.lead}
            </p>
            <p className="mt-6 text-[13px] text-soft">{page.updated}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 pb-24 pt-0 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-14 lg:pb-32">
        <nav
          aria-label={page.navLabel}
          className="frame-in reserve-sheet sticky top-6 z-10 hidden h-fit p-5 lg:block"
          style={{ animationDelay: "80ms" }}
        >
          <p className="kicker mb-4">{page.navLabel}</p>
          <ul className="space-y-2 text-[13px]">
            {page.sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block rounded-xl px-2 py-1.5 text-soft transition hover:bg-lilac/40 hover:text-ink"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="-mt-16 space-y-5 sm:-mt-20 lg:mt-0 lg:space-y-6">
          <div
            className="frame-in reserve-sheet border border-line-strong/40 p-6 sm:p-8"
            style={{ animationDelay: "120ms" }}
          >
            <div className="text-[15px] leading-7 text-soft">{page.intro}</div>
            {page.chips && page.chips.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {page.chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-line bg-dawn/80 px-3 py-1 text-[11px] font-medium tracking-wide text-ink/80"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {page.sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              className="frame-in scroll-mt-28 reserve-sheet border border-line-strong/30 p-6 sm:p-8"
              style={{ animationDelay: `${160 + index * 40}ms` }}
            >
              <p className="kicker">{section.kicker}</p>
              <h2 className="mt-2 font-display text-[1.45rem] tracking-[-0.03em] text-ink sm:text-[1.65rem]">
                {section.title}
              </h2>
              <div className="prose-mora mt-5 space-y-4 text-[15px] leading-7 text-soft">{section.body}</div>
            </section>
          ))}

          <footer
            className="frame-in reserve-sheet border border-line-strong/30 p-6 text-center sm:p-8"
            style={{ animationDelay: `${160 + page.sections.length * 40}ms` }}
          >
            {page.footer}
          </footer>
        </article>
      </div>
    </div>
  );
}
