"use client";

import { useEffect } from "react";

const ATELIER = "coleccion";
const CASE = "case";
const CREATORS = "creadores-home";

function pageOf() {
  const mid = window.innerHeight * 0.42;
  const atelier = document.getElementById(ATELIER);
  const caseEl = document.getElementById(CASE);
  const creators = document.getElementById(CREATORS);
  if (!atelier || !caseEl) return null;

  const a = atelier.getBoundingClientRect();
  if (a.top <= mid && a.bottom > mid) return "atelier" as const;

  const c = caseEl.getBoundingClientRect();
  if (c.top <= mid && c.bottom > mid) return "case" as const;

  if (creators) {
    const cr = creators.getBoundingClientRect();
    if (cr.top <= mid && cr.top > -72) return "creators" as const;
  }
  return null;
}

function go(id: string) {
  const node = document.getElementById(id);
  if (!node) return;
  const top = window.scrollY + node.getBoundingClientRect().top;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
}

export function HomePager() {
  useEffect(() => {
    let locked = false;
    let lockTimer = 0;
    let startX = 0;
    let startY = 0;
    let axis: "x" | "y" | null = null;
    let origin: ReturnType<typeof pageOf> = null;

    const lock = (ms = 820) => {
      locked = true;
      window.clearTimeout(lockTimer);
      lockTimer = window.setTimeout(() => {
        locked = false;
      }, ms);
    };

    const snap = (id: string) => {
      lock();
      go(id);
    };

    const onWheel = (event: WheelEvent) => {
      if (locked || event.ctrlKey) return;
      const page = pageOf();
      if (!page) return;
      if (Math.abs(event.deltaY) < 10 || Math.abs(event.deltaY) < Math.abs(event.deltaX)) {
        return;
      }
      if (page === "atelier" && event.deltaY > 0) {
        event.preventDefault();
        snap(CASE);
        return;
      }
      if (page === "case" && event.deltaY < 0) {
        event.preventDefault();
        snap(ATELIER);
        return;
      }
      if (page === "case" && event.deltaY > 0) {
        event.preventDefault();
        snap(CREATORS);
        return;
      }
      if (page === "creators" && event.deltaY < 0) {
        event.preventDefault();
        snap(CASE);
      }
    };

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      axis = null;
      origin = pageOf();
    };

    const onTouchMove = (event: TouchEvent) => {
      if (locked || !origin) return;
      const touch = event.touches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (!axis && (Math.abs(dx) > 7 || Math.abs(dy) > 7)) {
        axis = Math.abs(dy) > Math.abs(dx) * 1.12 ? "y" : "x";
      }
      if (axis !== "y") return;
      if (origin === "atelier" || origin === "case" || (origin === "creators" && dy > 0)) {
        event.preventDefault();
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (locked || axis !== "y" || !origin) {
        axis = null;
        origin = null;
        return;
      }
      const touch = event.changedTouches[0];
      const dy = touch ? touch.clientY - startY : 0;
      axis = null;
      const from = origin;
      origin = null;
      if (Math.abs(dy) < 42) return;
      if (from === "atelier" && dy < 0) {
        snap(CASE);
        return;
      }
      if (from === "case" && dy > 0) {
        snap(ATELIER);
        return;
      }
      if (from === "case" && dy < 0) {
        snap(CREATORS);
        return;
      }
      if (from === "creators" && dy > 0) {
        snap(CASE);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.clearTimeout(lockTimer);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return null;
}
