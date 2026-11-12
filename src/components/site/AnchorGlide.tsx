"use client";

import { useEffect } from "react";
import { glideTo } from "@/lib/glide";

/** Todo enlace `#id` de la misma página baja con `glideTo` en vez del salto nativo. */
export function AnchorGlide() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
      if (!link) return;
      const id = decodeURIComponent(link.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      event.preventDefault();
      // pushState no dispara hashchange, así nadie salta encima de la animación.
      history.pushState(null, "", `#${id}`);
      glideTo(target);
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
