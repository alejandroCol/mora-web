"use client";

import { useEffect } from "react";

const ANCHOR = "#coleccion";

export function ScreenFit() {
  useEffect(() => {
    const root = document.documentElement;

    const fit = () => {
      const h = window.visualViewport?.height || window.innerHeight;
      if (h > 0) root.style.setProperty("--screen", `${Math.round(h)}px`);
    };

    const jump = (y: number) => {
      const prev = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollTo(0, y);
      root.style.scrollBehavior = prev;
    };

    const align = () => {
      if (window.location.hash !== ANCHOR) return;
      const stage = document.getElementById(ANCHOR.slice(1));
      if (!stage) return;
      const delta = stage.getBoundingClientRect().top;
      if (Math.abs(delta) > 1) jump(window.scrollY + delta);
    };

    const onClick = (event: MouseEvent) => {
      const node = event.target instanceof Element ? event.target : null;
      if (!node?.closest(`a[href="${ANCHOR}"]`)) return;
      const stage = document.getElementById(ANCHOR.slice(1));
      if (!stage) return;
      event.preventDefault();
      fit();
      jump(window.scrollY + stage.getBoundingClientRect().top);
      history.pushState(null, "", ANCHOR);
    };

    fit();
    align();
    const viewport = window.visualViewport;
    window.addEventListener("resize", fit);
    window.addEventListener("hashchange", align);
    viewport?.addEventListener("resize", fit);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("hashchange", align);
      viewport?.removeEventListener("resize", fit);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}
