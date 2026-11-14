"use client";

import { useEffect, useState } from "react";
import { formatCount } from "@/ads/format";
import type { AdsAccess, AdsAudience, AdsAudiencesState } from "@/ads/types";
import { BrandLoader } from "@/components/brand/BrandLoader";
import { BTN_DARK, CARD, dateTimeLabel, useAdsApi } from "./adsUi";

type Payload = { state: AdsAudiencesState; access: AdsAccess };

const KIND_LABEL = { list: "Lista de Mora", web: "Pixel", engagement: "Instagram", lookalike: "Parecidos" } as const;

function statusOf(audience: AdsAudience) {
  if (audience.error) return { text: audience.error, tone: "text-[#b45309]" };
  if (!audience.id) return { text: "Aún no existe en Meta", tone: "text-[var(--admin-muted)]" };
  if (!audience.ready) return { text: audience.status || "Meta la está armando", tone: "text-[var(--admin-muted)]" };
  return {
    text: audience.size > 1000 ? `${formatCount(audience.size)} personas en Meta` : "Lista. Menos de 1.000 personas en Meta",
    tone: "text-[var(--admin-ok)]",
  };
}

/** Un aviso que trae un enlace (aceptar condiciones en Meta) se puede tocar. */
function StatusText({ text }: { text: string }) {
  const match = /https:\/\/\S+/.exec(text);
  if (!match) return <>{text}</>;
  const before = text.slice(0, match.index).replace(/:\s*$/, ".");
  return (
    <>
      {before}{" "}
      <a href={match[0]} target="_blank" rel="noreferrer" className="underline underline-offset-2">
        Abrir en Meta
      </a>
    </>
  );
}

/** Las audiencias que Mora mantiene sola en Meta, y las que ya había en la cuenta. */
export function AdsAudiencesPanel() {
  const api = useAdsApi();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api.call<Payload>("/api/admin/ads/audiences").then((result) => {
      if (cancelled) return;
      if (result.ok) setData(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

  async function sync() {
    setBusy(true);
    setError("");
    const result = await api.call<Payload>("/api/admin/ads/audiences", "POST");
    setBusy(false);
    if (result.ok) setData(result.data);
    else setError(result.error);
  }

  if (!data) {
    return error ? (
      <p className={`${CARD} text-[13px] text-[var(--admin-danger)]`}>{error}</p>
    ) : (
      <div className="grid min-h-[30vh] place-items-center">
        <BrandLoader label="Leyendo audiencias" />
      </div>
    );
  }

  const { state, access } = data;

  return (
    <div className="grid gap-4">
      <section className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-xl">
            <h2 className="text-[15px] font-medium tracking-[-0.02em]">Audiencias de Mora</h2>
            <p className="mt-1 text-[13px] leading-6 text-[var(--admin-muted)]">
              Mora las crea en Meta y las mantiene al día: quien compra sale de las listas de «no compró». A Meta
              solo viajan huellas cifradas (SHA-256) del correo y el celular, nunca el dato legible.
            </p>
          </div>
          <button type="button" className={BTN_DARK} disabled={busy || !access.canManage} onClick={() => void sync()}>
            {busy ? "Sincronizando…" : "Sincronizar ahora"}
          </button>
        </div>
        {!access.canManage ? (
          <p className="mt-3 text-[12.5px] leading-5 text-[#b45309]">
            Para crearlas falta el permiso de administrar anuncios (míralo en Resultados).
          </p>
        ) : null}
        {error ? <p className="mt-3 text-[13px] text-[var(--admin-danger)]">{error}</p> : null}
        <ul className="mt-4 divide-y divide-black/[0.06]">
          {state.audiences.map((audience) => {
            const status = statusOf(audience);
            return (
              <li key={audience.key} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3.5">
                <div className="min-w-0 flex-1 basis-[15rem]">
                  <p className="text-[14px] text-[#1d1d1f]">
                    {audience.label}
                    <span className="ml-2 rounded-full bg-[var(--admin-field)] px-2 py-0.5 text-[11px] text-[var(--admin-muted)]">
                      {KIND_LABEL[audience.kind]}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[12.5px] leading-5 text-[var(--admin-muted)]">{audience.use}</p>
                </div>
                <div className="basis-[13rem] text-right max-sm:text-left">
                  {audience.kind === "list" ? (
                    <p className="text-[13px] text-[#1d1d1f]">
                      {formatCount(audience.local)} {audience.local === 1 ? "persona" : "personas"} en Mora
                    </p>
                  ) : null}
                  <p className={`text-[12.5px] leading-5 ${status.tone}`}>
                    <StatusText text={status.text} />
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[12px] leading-5 text-[var(--admin-muted)]">
          {state.syncedAt ? `Última sincronización: ${dateTimeLabel(state.syncedAt)}. ` : "Nunca se han sincronizado. "}
          Meta necesita unas 100 personas reconocidas para mostrarle anuncios a una lista y para armar «parecidos»;
          por debajo de eso sirven sobre todo para excluir. Con el piloto prendido se actualizan solas cada mañana.
        </p>
      </section>

      {state.others.length > 0 ? (
        <section className={CARD}>
          <h2 className="text-[15px] font-medium tracking-[-0.02em]">Otras audiencias de la cuenta</h2>
          <p className="mt-1 text-[13px] leading-6 text-[var(--admin-muted)]">
            Las creó alguien más (la agencia o Meta). Mora no las toca, pero puedes usarlas al segmentar.
          </p>
          <ul className="mt-3 divide-y divide-black/[0.06]">
            {state.others.map((audience) => (
              <li key={audience.id} className="flex items-center justify-between gap-3 py-3 text-[13.5px]">
                <span className="min-w-0 truncate text-[#1d1d1f]">{audience.name}</span>
                <span className="shrink-0 text-[12.5px] text-[var(--admin-muted)]">
                  {audience.kind} · {audience.size > 1000 ? formatCount(audience.size) : "menos de 1.000"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
