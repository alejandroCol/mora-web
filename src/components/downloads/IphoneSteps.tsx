"use client";

import Link from "next/link";
import { useRef, useState, type MouseEvent } from "react";
import { APP_STORES } from "@/lib/appStores";

function isAppleMobile() {
  const ua = navigator.userAgent || "";
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(ua) || iPadOs;
}

export function IphoneSteps() {
  const [notice, setNotice] = useState(false);
  const tried = useRef(false);

  function openMora(event: MouseEvent<HTMLAnchorElement>) {
    if (!isAppleMobile() || tried.current) return;
    event.preventDefault();
    let opened = false;
    const onHide = () => {
      if (document.visibilityState === "hidden") opened = true;
    };
    const onPageHide = () => {
      opened = true;
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    // Si TestFlight ya está, iOS abre la invitación. Si no, la página se queda.
    window.location.href = APP_STORES.ios.replace(/^https:\/\//, "itms-beta://");
    window.setTimeout(() => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      if (opened || document.visibilityState === "hidden") return;
      // El enlace de la invitación abre TestFlight cuando la app ya está.
      tried.current = true;
      setNotice(true);
      window.location.assign(APP_STORES.ios);
    }, 900);
  }

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col px-5 pb-10 pt-2 sm:pt-6">
      <Link
        href="/descargas"
        className="inline-flex w-fit items-center gap-1 text-[14px] tracking-[-0.01em] text-[#6a6488] transition-opacity hover:opacity-60"
      >
        <span aria-hidden>‹</span> Descargas
      </Link>

      <img
        src="/descargas/icon.png"
        alt=""
        width={64}
        height={64}
        className="mt-8 h-14 w-14 select-none [filter:drop-shadow(0_14px_22px_rgba(70,50,130,0.28))]"
        draggable={false}
      />
      <p className="kicker mt-6">Mora Ring</p>
      <h1 className="display mt-2 text-[clamp(2.5rem,6vw,3.8rem)] text-[#2c2648]">En tu iPhone</h1>
      <p className="title-whisper mt-3 max-w-md text-[1.05rem] leading-7 text-[#5e5878]">
        Primero TestFlight. Después, Mora.
      </p>

      <ol className="mt-8 grid gap-4">
        <li className="rounded-[1.75rem] bg-white/90 px-6 py-7 shadow-[0_18px_50px_rgba(70,50,130,0.1)] ring-1 ring-white sm:px-8">
          <div className="flex items-start gap-4">
            <span className="text-[2.75rem] font-semibold leading-none tracking-[-0.05em] text-[#6f61b8]">01</span>
            <div className="pt-1">
              <h2 className="text-[1.45rem] font-semibold tracking-[-0.03em] text-[#2c2648]">TestFlight</h2>
              <p className="mt-1 text-[15px] leading-6 text-[#6a6488]">
                La app de Apple. Mora se instala desde ahí.
              </p>
            </div>
          </div>
          <a
            href={APP_STORES.testflight}
            className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-[#0c0c0e] px-4 text-[16px] tracking-[-0.02em] text-white transition-opacity hover:opacity-85"
          >
            Descargar TestFlight
          </a>
        </li>

        <li className="rounded-[1.75rem] bg-white/90 px-6 py-7 shadow-[0_18px_50px_rgba(70,50,130,0.1)] ring-1 ring-white sm:px-8">
          <div className="flex items-start gap-4">
            <span className="text-[2.75rem] font-semibold leading-none tracking-[-0.05em] text-[#6f61b8]">02</span>
            <div className="pt-1">
              <h2 className="text-[1.45rem] font-semibold tracking-[-0.03em] text-[#2c2648]">Mora Ring</h2>
              <p className="mt-1 text-[15px] leading-6 text-[#6a6488]">
                Si TestFlight ya está en tu iPhone, ábrelo aquí.
              </p>
            </div>
          </div>
          <a
            href={APP_STORES.ios}
            onClick={openMora}
            className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-[#6f61b8] px-4 text-[16px] tracking-[-0.02em] text-white transition-opacity hover:opacity-90"
          >
            Descargar Mora Ring
          </a>
          {notice ? (
            <p role="status" className="mt-3 text-center text-[14px] leading-5 text-[#2c2648]">
              Primero debes descargar TestFlight en el paso uno.
            </p>
          ) : null}
        </li>
      </ol>
    </main>
  );
}
