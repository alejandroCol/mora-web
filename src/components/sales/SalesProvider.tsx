"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyPricing,
  DEFAULT_PRICING,
  normalizePricing,
  type Pricing,
} from "@/commerce/pricing";
import {
  HORA_LOCA_LABEL,
  nextPromoBoundary,
  pickPromo,
  type ActivePromo,
  type PromoWindow,
} from "@/commerce/promos";
import {
  DEFAULT_SALES_POLICY,
  resolveSalesPresentation,
  type SalesPresentation,
} from "@/commerce/sales";
import { CASE_COLOR_LIST, type CaseColorId } from "@/lib/cases";

type PromoFeed = { now: number; windows: PromoWindow[] };

type PromoState = {
  promo: ActivePromo | null;
  /** Hora del servidor menos la de este equipo: el reloj no depende del celular del cliente. */
  offset: number;
  /** false hasta que llega la primera respuesta: mientras tanto vale lo que pintó el servidor. */
  loaded: boolean;
};

const Ctx = createContext<SalesPresentation>(resolveSalesPresentation(DEFAULT_SALES_POLICY));
const PricingCtx = createContext<Pricing>(DEFAULT_PRICING);
const CaseOutCtx = createContext<CaseColorId[]>([]);
const PromoCtx = createContext<PromoState>({ promo: null, offset: 0, loaded: false });

const PROMO_POLL_MS = 60_000;
/** setTimeout no aguanta esperas de semanas: se vuelve a mirar a lo sumo cada hora. */
const MAX_WAIT_MS = 3_600_000;
const PREVIEW_KEY = "mora-promo-preview";

/**
 * Vista previa, solo en `next dev`: `/?promo=black`, `black-teaser`, `hora`, `hora-teaser`, `off`.
 * Pinta la promoción sin tocar `settings/promos`. El servidor no descuenta ni cuenta eventos.
 */
let previewMemo: PromoWindow[] | null | undefined;

function previewWindows(): PromoWindow[] | null {
  if (previewMemo === undefined) previewMemo = buildPreview(Date.now());
  return previewMemo;
}

function buildPreview(now: number): PromoWindow[] | null {
  if (process.env.NODE_ENV === "production") return null;
  let mode = "";
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("promo");
    if (fromUrl) window.sessionStorage.setItem(PREVIEW_KEY, fromUrl);
    mode = window.sessionStorage.getItem(PREVIEW_KEY) ?? "";
  } catch {
    return null;
  }
  const hour = 3_600_000;
  const base = { percent: 10 as const };
  if (mode === "black") {
    // En vivo ahora, y el reloj llega al domingo 29 de noviembre de 2026, 23:59 en Colombia.
    const endsAt = Date.parse("2026-11-29T23:59:00-05:00");
    return [{ ...base, kind: "black", key: "preview-black", label: "Black Friday", teaserAt: now - 24 * hour, startsAt: now - 24 * hour, endsAt }];
  }
  if (mode === "black-week") {
    return [{ ...base, kind: "black", key: "preview-black", label: "Black Week", teaserAt: now - 24 * hour, startsAt: now - 24 * hour, endsAt: now + 134.21 * hour }];
  }
  if (mode === "black-teaser") {
    return [{ ...base, kind: "black", key: "preview-black", label: "Black Friday", teaserAt: now - hour, startsAt: now + 27.36 * hour, endsAt: now + 51.36 * hour }];
  }
  if (mode === "hora") {
    return [{ ...base, kind: "hora_loca", key: "preview-hora", label: HORA_LOCA_LABEL, teaserAt: now - 0.21 * hour, startsAt: now - 0.21 * hour, endsAt: now + 0.79 * hour }];
  }
  if (mode === "hora-teaser") {
    return [{ ...base, kind: "hora_loca", key: "preview-hora", label: HORA_LOCA_LABEL, teaserAt: now - hour, startsAt: now + 0.32 * hour, endsAt: now + 1.32 * hour }];
  }
  return null;
}

export function SalesProvider({
  initial,
  children,
}: {
  initial: SalesPresentation;
  children: ReactNode;
}) {
  const [sales, setSales] = useState(initial);
  const [pricing, setPricing] = useState<Pricing>(DEFAULT_PRICING);
  const [caseOut, setCaseOut] = useState<CaseColorId[]>([]);
  const [feed, setFeed] = useState<{
    windows: PromoWindow[];
    offset: number;
    preview: boolean;
    promo: ActivePromo | null;
  } | null>(null);

  useEffect(() => {
    let alive = true;

    const takePromos = (promos: PromoFeed | undefined) => {
      if (!alive || !promos || !Array.isArray(promos.windows)) return;
      const preview = previewWindows();
      const windows = preview ?? promos.windows;
      const offset = preview ? 0 : promos.now - Date.now();
      setFeed({
        windows,
        offset,
        preview: Boolean(preview),
        promo: pickPromo(windows, Date.now() + offset),
      });
    };

    void fetch("/api/sales", { cache: "no-store" })
      .then((res) => res.json())
      .then(
        (data: {
          ok?: boolean;
          sales?: SalesPresentation;
          pricing?: Record<string, unknown>;
          promos?: PromoFeed;
          caseOut?: CaseColorId[];
        }) => {
          if (!alive || !data.ok) return;
          if (data.sales) setSales(data.sales);
          if (Array.isArray(data.caseOut)) setCaseOut(data.caseOut);
          if (data.pricing) {
            const next = normalizePricing(data.pricing);
            // Primero el catálogo compartido, luego el render: quien lea products[x].price
            // durante el re-render ya ve el precio vivo.
            applyPricing(next);
            setPricing(next);
          }
          takePromos(data.promos);
        },
      )
      .catch(() => {
        // Sin servidor (dev sin Firebase) la vista previa igual se puede ver.
        if (previewWindows()) takePromos({ now: Date.now(), windows: [] });
      });

    // Una hora loca que se enciende sobre la marcha le llega a quien ya tiene la tienda abierta.
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void fetch("/api/promos", { cache: "no-store" })
        .then((res) => res.json())
        .then((data: { ok?: boolean; promos?: PromoFeed }) => {
          if (data.ok) takePromos(data.promos);
        })
        .catch(() => undefined);
    };
    const poll = window.setInterval(refresh, PROMO_POLL_MS);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      alive = false;
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  // Al cruzar un inicio o un final se vuelve a decidir qué promoción manda.
  useEffect(() => {
    if (!feed) return;
    const now = Date.now() + feed.offset;
    const next = nextPromoBoundary(feed.windows, now);
    if (next == null) return;
    const timer = window.setTimeout(
      () =>
        setFeed((current) =>
          current
            ? { ...current, promo: pickPromo(current.windows, Date.now() + current.offset) }
            : current,
        ),
      Math.min(MAX_WAIT_MS, next - now + 50),
    );
    return () => window.clearTimeout(timer);
  }, [feed]);

  const promoState = useMemo<PromoState>(() => {
    if (!feed) return { promo: null, offset: 0, loaded: false };
    return {
      promo: feed.promo ? { ...feed.promo, ...(feed.preview ? { preview: true } : {}) } : null,
      offset: feed.offset,
      loaded: true,
    };
  }, [feed]);

  return (
    <Ctx.Provider value={sales}>
      <PricingCtx.Provider value={pricing}>
        <CaseOutCtx.Provider value={caseOut}>
          <PromoCtx.Provider value={promoState}>{children}</PromoCtx.Provider>
        </CaseOutCtx.Provider>
      </PricingCtx.Provider>
    </Ctx.Provider>
  );
}

export function useSales() {
  return useContext(Ctx);
}

/**
 * Precios vivos (Pro, Ultra, Case). Suscribirse aquí hace que el componente se vuelva a
 * pintar cuando el super admin cambia un precio; `products[x].price` ya trae el valor.
 */
export function usePricing() {
  return useContext(PricingCtx);
}

/** Colores del case que se pueden vender ahora: sin los agotados. */
export function useCaseColors() {
  const out = useContext(CaseOutCtx);
  return useMemo(() => {
    const open = CASE_COLOR_LIST.filter((item) => !out.includes(item.id));
    return open.length > 0 ? open : CASE_COLOR_LIST;
  }, [out]);
}

/** Black Friday / Hora Loca que manda ahora (anunciada o en vivo), o null. */
export function usePromo() {
  return useContext(PromoCtx).promo;
}

/** Con `loaded`: el escenario del inicio lo usa para pasar de lo que pintó el servidor a lo vivo. */
export function usePromoState() {
  return useContext(PromoCtx);
}

/** Solo si ya está en vivo: es la que cambia precios. */
export function useLivePromo() {
  const promo = useContext(PromoCtx).promo;
  return promo?.phase === "live" ? promo : null;
}

/** Diferencia con la hora del servidor, para los relojes. */
export function usePromoClockOffset() {
  return useContext(PromoCtx).offset;
}
