"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { formatAdsMoney, formatCount, formatPercent } from "@/ads/format";
import type {
  AdAccountOption,
  AdRow,
  AdsConnection,
  AdsNote,
  AdsRange,
  AdsReport,
  CampaignRow,
} from "@/ads/types";
import { BrandLoader } from "@/components/brand/BrandLoader";
import { useAdminAuth } from "../AdminAuth";

const RANGES: { id: AdsRange; label: string; phrase: string }[] = [
  { id: "today", label: "Hoy", phrase: "hoy" },
  { id: "7d", label: "7 días", phrase: "en los últimos 7 días" },
  { id: "30d", label: "30 días", phrase: "en los últimos 30 días" },
  { id: "month", label: "Este mes", phrase: "en lo que va del mes" },
];

const CARD = "rounded-[1.1rem] bg-white p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]";

type Payload = { connection?: AdsConnection; report?: AdsReport | null; error?: string };

export function AnunciosView() {
  const { authorizedFetch } = useAdminAuth();
  const [range, setRange] = useState<AdsRange>("7d");
  const [connection, setConnection] = useState<AdsConnection | null>(null);
  const [report, setReport] = useState<AdsReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const fresh = useRef(false);

  const fetchReport = useCallback(
    async (fresh: boolean): Promise<Payload> => {
      try {
        const res = await authorizedFetch(`/api/admin/ads?range=${range}${fresh ? "&fresh=1" : ""}`);
        return (await res.json()) as Payload;
      } catch {
        return { error: "No se pudo abrir el reporte." };
      }
    },
    [authorizedFetch, range],
  );

  useEffect(() => {
    let cancelled = false;
    const skipCache = fresh.current;
    fresh.current = false;
    void fetchReport(skipCache).then((data) => {
      if (cancelled) return;
      if (data.connection) setConnection(data.connection);
      setReport(data.report ?? null);
      setError(data.error ?? "");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchReport, refresh]);

  function pickRange(next: AdsRange) {
    if (next === range) return;
    setLoading(true);
    setRange(next);
  }

  function reload() {
    fresh.current = true;
    setLoading(true);
    setRefresh((count) => count + 1);
  }

  const phrase = RANGES.find((item) => item.id === range)?.phrase ?? "";

  if (!connection && loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <BrandLoader label="Leyendo los anuncios" />
      </div>
    );
  }

  if (connection && !connection.connected) {
    return (
      <div className="ventas-app">
        <Header />
        <ConnectCard onConnected={(next) => setConnection(next)} />
      </div>
    );
  }

  return (
    <div className="ventas-app">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <HeaderCopy />
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => pickRange(item.id)}
              className={`crm-filter ${range === item.id ? "is-on" : ""}`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="crm-filter disabled:opacity-50"
          >
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </header>

      {error ? (
        <p className={`${CARD} text-[13px] text-[var(--admin-danger)]`}>{error}</p>
      ) : null}

      {!report ? (
        loading ? (
          <div className="grid min-h-[30vh] place-items-center">
            <BrandLoader label="Leyendo los anuncios" />
          </div>
        ) : null
      ) : (
        <Report report={report} phrase={phrase} />
      )}

      {connection?.connected ? (
        <AccountFoot
          connection={connection}
          onDisconnected={(next) => {
            setConnection(next);
            setReport(null);
          }}
        />
      ) : null}
    </div>
  );
}

function Header() {
  return (
    <header>
      <HeaderCopy />
    </header>
  );
}

function HeaderCopy() {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--admin-muted)]">Alcance</p>
      <h1 className="mt-2 font-display text-4xl tracking-[-0.05em] text-[#1d1d1f]">Anuncios.</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--admin-muted)]">
        Cuánto pusiste en Meta, qué trajo y qué anuncio conviene dejar prendido.
      </p>
    </div>
  );
}

function Report({ report, phrase }: { report: AdsReport; phrase: string }) {
  const money = (value: number) => formatAdsMoney(value, report.currency);
  const t = report.totals;
  const sales = t.sales + t.webSales;
  const revenue = t.revenue + t.webRevenue;
  const back = t.spend > 0 ? revenue / t.spend : 0;
  const chats = t.crmChats || t.chats;
  const dayCount = report.days.length || 1;

  return (
    <>
      <p className={`${CARD} text-[15px] leading-7 text-[#1d1d1f]`}>
        {t.spend === 0 ? (
          <>No hubo gasto en anuncios {phrase}.</>
        ) : (
          <>
            {capitalize(phrase)} pusiste <strong className="font-medium">{money(t.spend)}</strong> en Meta.
            Te vieron <strong className="font-medium">{formatCount(t.reach)} personas</strong>, llegaron{" "}
            <strong className="font-medium">{formatCount(chats)} chats</strong> y salieron{" "}
            <strong className="font-medium">
              {formatCount(sales)} {sales === 1 ? "venta" : "ventas"}
            </strong>
            {sales > 0 ? <> por {money(revenue)}</> : null}.
          </>
        )}
      </p>

      <div className="ventas-kpis">
        <Kpi
          label="Gastado"
          value={money(t.spend)}
          hint={dayCount > 1 ? `${money(t.spend / dayCount)} por día` : "Hoy"}
        />
        <Kpi
          label="Chats"
          value={formatCount(chats)}
          hint={t.spend > 0 && chats > 0 ? `${money(t.spend / chats)} cada uno` : "Desde anuncios"}
        />
        <Kpi
          label="Ventas"
          value={formatCount(sales)}
          hint={sales > 0 ? money(revenue) : "Aún ninguna"}
        />
        <Kpi
          label="Costo por venta"
          value={sales > 0 ? money(t.spend / sales) : "—"}
          hint={
            sales > 0
              ? `Por $1 volvieron $${back.toLocaleString("es-CO", { maximumFractionDigits: 1 })}`
              : "Cuando haya ventas"
          }
        />
      </div>

      {report.notes.length > 0 ? <Notes notes={report.notes} /> : null}

      <Funnel report={report} />

      {report.days.length > 1 ? <Daily report={report} /> : null}

      <section className="grid gap-3">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h2 className="text-[15px] font-medium tracking-[-0.02em]">Campañas</h2>
          <p className="text-[12px] text-[var(--admin-muted)]">
            {activeLabel(report.campaigns.filter((campaign) => campaign.active).length)}
          </p>
        </div>
        {report.campaigns.length === 0 ? (
          <p className={`${CARD} text-sm text-[var(--admin-muted)]`}>
            No hay campañas activas ni con gasto en este periodo.
          </p>
        ) : (
          report.campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} currency={report.currency} />
          ))
        )}
      </section>

      <p className="px-1 text-[12px] leading-5 text-[var(--admin-muted)]">
        El gasto, el alcance y los clics vienen de Meta. Los chats son los que entraron al CRM con el id de un
        anuncio, y las ventas son pedidos pagados de esos chats, más compras en la web de gente que llegó desde
        Meta{t.webSales > 0 ? ` (${formatCount(t.webSales)} en este periodo)` : ""}. Meta puede tardar unas
        horas en cerrar las cifras del día.
      </p>
    </>
  );
}

function Notes({ notes }: { notes: AdsNote[] }) {
  const dot = { good: "bg-[var(--admin-ok)]", warn: "bg-[#b45309]", info: "bg-[#6e6e73]" } as const;
  return (
    <section className={CARD}>
      <h2 className="text-[15px] font-medium tracking-[-0.02em]">Qué haría yo</h2>
      <ul className="mt-4 space-y-3">
        {notes.map((note) => (
          <li key={note.text} className="flex gap-3 text-[13px] leading-6 text-[#1d1d1f]">
            <span className={`mt-[0.6rem] h-1.5 w-1.5 shrink-0 rounded-full ${dot[note.tone]}`} aria-hidden />
            <span>{note.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Funnel({ report }: { report: AdsReport }) {
  const t = report.totals;
  const chats = t.crmChats || t.chats;
  const sales = t.sales + t.webSales;
  const steps = [
    { label: "Lo vieron", value: t.reach, hint: `${formatCount(t.impressions)} veces en total` },
    { label: "Hicieron clic", value: t.linkClicks, hint: "Al enlace o al botón de WhatsApp" },
    { label: "Escribieron", value: chats, hint: "Chats que llegaron" },
    { label: "Compraron", value: sales, hint: "Pedidos pagados" },
  ];
  const top = Math.max(1, steps[0].value);
  const clickRate = t.reach > 0 ? (t.linkClicks / t.reach) * 100 : 0;
  const closeRate = chats > 0 ? (sales / chats) * 100 : 0;

  return (
    <section className={CARD}>
      <h2 className="text-[15px] font-medium tracking-[-0.02em]">Del anuncio a la venta</h2>
      <p className="mt-1 text-[13px] leading-6 text-[var(--admin-muted)]">
        {t.reach > 0
          ? `De cada 100 personas que vieron un anuncio, ${clickRate.toLocaleString("es-CO", { maximumFractionDigits: 1 })} hicieron clic.`
          : "Cuando los anuncios empiecen a mostrarse, aquí ves dónde se queda la gente."}
        {chats > 0 ? ` Y de cada 100 chats, ${closeRate.toLocaleString("es-CO", { maximumFractionDigits: 1 })} terminaron en venta.` : ""}
      </p>
      <ol className="mt-5 space-y-3">
        {steps.map((step) => (
          <li key={step.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>{step.label}</span>
              <span className="shrink-0 text-[var(--admin-muted)]">{formatCount(step.value)}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--admin-field)]">
              <div
                className="h-full rounded-full bg-[#1d1d1f]"
                style={{ width: `${Math.max(step.value > 0 ? 1.5 : 0, (step.value / top) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{step.hint}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Daily({ report }: { report: AdsReport }) {
  const money = (value: number) => formatAdsMoney(value, report.currency);
  const maxSpend = Math.max(1, ...report.days.map((day) => day.spend));
  const maxChats = Math.max(1, ...report.days.map((day) => day.chats));
  const best = [...report.days].sort((a, b) => b.chats - a.chats)[0];

  return (
    <section className={CARD}>
      <h2 className="text-[15px] font-medium tracking-[-0.02em]">Día a día</h2>
      <p className="mt-1 text-[13px] text-[var(--admin-muted)]">
        Barra oscura: lo gastado. Barra clara: los chats que trajo.
        {best && best.chats > 0 ? ` El mejor día fue el ${shortDate(best.date)}, con ${formatCount(best.chats)} chats.` : ""}
      </p>
      <div className="mt-6 flex h-40 items-end gap-[3px]">
        {report.days.map((day) => (
          <div
            key={day.date}
            className="flex h-full min-w-0 flex-1 items-end gap-[2px]"
            title={`${shortDate(day.date)} · ${money(day.spend)} · ${day.chats} chats${day.sales ? ` · ${day.sales} ventas` : ""}`}
          >
            <div
              className="flex-1 rounded-t-[4px] bg-[#1d1d1f]"
              style={{ height: `${Math.max(day.spend > 0 ? 2 : 0, (day.spend / maxSpend) * 100)}%` }}
            />
            <div
              className="flex-1 rounded-t-[4px] bg-[#c7c7cc]"
              style={{ height: `${Math.max(day.chats > 0 ? 2 : 0, (day.chats / maxChats) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-[var(--admin-muted)]">
        <span>{shortDate(report.days[0].date)}</span>
        <span>{shortDate(report.days[report.days.length - 1].date)}</span>
      </div>
    </section>
  );
}

function CampaignCard({ campaign, currency }: { campaign: CampaignRow; currency: string }) {
  const money = (value: number) => formatAdsMoney(value, currency);
  const chats = campaign.crmChats || campaign.chats;
  const back = campaign.spend > 0 ? campaign.revenue / campaign.spend : 0;
  const clickRate = campaign.reach > 0 ? (campaign.linkClicks / campaign.reach) * 100 : 0;
  const budget = campaign.dailyBudget
    ? `${money(campaign.dailyBudget)} al día`
    : campaign.lifetimeBudget
      ? `${money(campaign.lifetimeBudget)} en total`
      : "";
  const result = campaign.result;
  const cheapest = cheapestAd(campaign.ads);

  return (
    <article className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill active={campaign.active} label={campaign.statusLabel} />
            <span className="text-[12px] text-[var(--admin-muted)]">{campaign.objectiveLabel}</span>
          </div>
          <h3 className="mt-2 text-[17px] font-medium tracking-[-0.02em] text-[#1d1d1f]">{campaign.name}</h3>
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
            {[budget, campaign.startTime ? `desde el ${shortDate(campaign.startTime.slice(0, 10))}` : ""]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-[var(--admin-muted)]">{result.label}</p>
          <p className="mt-1 text-[1.6rem] font-medium leading-none tracking-[-0.04em]">{formatCount(result.value)}</p>
          <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
            {result.cost > 0 ? `${money(result.cost)} ${result.per === 1000 ? "por cada mil" : "cada uno"}` : "—"}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniKpi label="Gastado" value={money(campaign.spend)} />
        <MiniKpi label="Lo vieron" value={formatCount(campaign.reach)} />
        <MiniKpi label="Chats" value={formatCount(chats)} />
        <MiniKpi
          label="Ventas"
          value={formatCount(campaign.sales)}
          hint={campaign.sales > 0 ? `Volvieron $${back.toLocaleString("es-CO", { maximumFractionDigits: 1 })} por $1` : undefined}
        />
      </div>

      <p className="mt-4 text-[13px] leading-6 text-[var(--admin-muted)]">
        {campaign.spend === 0
          ? "No gastó en este periodo."
          : `Lo vieron ${formatCount(campaign.reach)} personas y ${formatPercent(clickRate)} hizo clic. ${
              chats > 0 ? `Escribieron ${formatCount(chats)}` : "Nadie escribió todavía"
            }${campaign.sales > 0 ? ` y ${formatCount(campaign.sales)} compraron por ${money(campaign.revenue)}.` : "."}`}
      </p>

      {campaign.ads.length > 0 ? (
        <details className="group mt-4">
          <summary className="cursor-pointer list-none text-[13px] text-[#1d1d1f]">
            <span className="group-open:hidden">Ver anuncios ({campaign.ads.length}) ›</span>
            <span className="hidden group-open:inline">Ocultar anuncios</span>
          </summary>
          <ul className="mt-3 grid gap-2">
            {campaign.ads.map((ad) => (
              <AdItem key={ad.id} ad={ad} currency={currency} best={cheapest === ad.id} />
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  );
}

function AdItem({ ad, currency, best }: { ad: AdRow; currency: string; best: boolean }) {
  const money = (value: number) => formatAdsMoney(value, currency);
  const chats = ad.crmChats || ad.chats;
  const idle = ad.spend > 0 && chats === 0 && ad.sales === 0 && ad.linkClicks === 0;
  return (
    <li className="flex gap-3 rounded-[1rem] bg-[var(--admin-field)] p-2.5">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[0.8rem] bg-white">
        {ad.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full w-full place-items-center text-[11px] text-[var(--admin-muted)]">Meta</div>
        )}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[13px] font-medium text-[#1d1d1f]">{ad.name}</p>
          {best ? <Tag tone="good">El más barato</Tag> : null}
          {idle ? <Tag tone="warn">Sin resultados</Tag> : null}
        </div>
        {ad.text ? <p className="mt-0.5 line-clamp-1 text-[12px] text-[var(--admin-muted)]">{ad.text}</p> : null}
        <p className="mt-1.5 text-[12px] text-[#1d1d1f]">
          {money(ad.spend)} · {formatCount(chats)} chats
          {chats > 0 && ad.spend > 0 ? ` (${money(ad.spend / chats)} c/u)` : ""}
          {ad.sales > 0 ? ` · ${formatCount(ad.sales)} ventas` : ""}
          <span className="text-[var(--admin-muted)]"> · {ad.statusLabel.toLowerCase()}</span>
        </p>
      </div>
    </li>
  );
}

function cheapestAd(ads: AdRow[]) {
  const ranked = ads
    .map((ad) => ({ id: ad.id, chats: ad.crmChats || ad.chats, spend: ad.spend }))
    .filter((ad) => ad.chats >= 2 && ad.spend > 0)
    .sort((a, b) => a.spend / a.chats - b.spend / b.chats);
  return ranked.length >= 2 ? ranked[0].id : "";
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${
        active ? "bg-[#e8f5ec] text-[var(--admin-ok)]" : "bg-[var(--admin-field)] text-[var(--admin-muted)]"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[var(--admin-ok)]" : "bg-[#aeaeb2]"}`} aria-hidden />
      {label}
    </span>
  );
}

function Tag({ tone, children }: { tone: "good" | "warn"; children: ReactNode }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10.5px] ${
        tone === "good" ? "bg-[#e8f5ec] text-[var(--admin-ok)]" : "bg-[#fdf1e4] text-[#b45309]"
      }`}
    >
      {children}
    </span>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="ventas-kpi">
      <p className="text-[11px] text-[var(--admin-muted)]">{label}</p>
      <p className="mt-2 text-[1.45rem] font-medium tracking-[-0.04em]">{value}</p>
      <p className="mt-1 text-[12px] text-[var(--admin-muted)]">{hint}</p>
    </div>
  );
}

function MiniKpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[0.95rem] bg-[var(--admin-field)] px-3 py-3">
      <p className="text-[11px] text-[var(--admin-muted)]">{label}</p>
      <p className="mt-1.5 text-[1.1rem] font-medium tracking-[-0.03em]">{value}</p>
      {hint ? <p className="mt-1 text-[11px] leading-4 text-[var(--admin-muted)]">{hint}</p> : null}
    </div>
  );
}

const STEPS = [
  "En business.facebook.com entra a Configuración del negocio › Usuarios del sistema y abre el usuario de Mora (el mismo de WhatsApp).",
  "Asignar activos › Cuentas publicitarias › la cuenta de Mora, con permiso para ver el rendimiento.",
  "Generar token › la app de Mora › marca ads_read › caducidad «Nunca».",
  "Pega el token aquí y dale Conectar.",
];

function ConnectCard({ onConnected }: { onConnected: (connection: AdsConnection) => void }) {
  const { authorizedFetch } = useAdminAuth();
  const [token, setToken] = useState("");
  const [accounts, setAccounts] = useState<AdAccountOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function connect(accountId = "") {
    setBusy(true);
    setError("");
    try {
      const res = await authorizedFetch("/api/admin/ads/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, accountId }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        connected?: boolean;
        accounts?: AdAccountOption[];
        connection?: AdsConnection;
      };
      if (!data.ok) {
        setError(data.error || "No se pudo conectar.");
        return;
      }
      if (data.connected && data.connection) {
        onConnected(data.connection);
        return;
      }
      setAccounts(data.accounts ?? []);
    } catch {
      setError("No se pudo conectar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={CARD}>
      <h2 className="text-[17px] font-medium tracking-[-0.02em]">Conecta la cuenta publicitaria</h2>
      <p className="mt-1 text-[13px] leading-6 text-[var(--admin-muted)]">
        Solo lectura: Mora ve gasto y resultados, no puede crear ni cambiar anuncios. El token de WhatsApp no
        sirve porque le falta el permiso ads_read.
      </p>
      <ol className="mt-4 space-y-2">
        {STEPS.map((step, index) => (
          <li key={step} className="flex gap-3 text-[13px] leading-6 text-[#1d1d1f]">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--admin-field)] text-[11px]">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      {accounts.length > 0 ? (
        <div className="mt-5">
          <p className="text-[13px] text-[#1d1d1f]">Ese token ve varias cuentas. ¿Cuál es la de Mora?</p>
          <ul className="mt-3 grid gap-2">
            {accounts.map((account) => (
              <li key={account.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void connect(account.id)}
                  className="flex w-full items-center justify-between rounded-[0.95rem] bg-[var(--admin-field)] px-4 py-3 text-left text-[13px] disabled:opacity-50"
                >
                  <span>
                    {account.name}
                    <span className="ml-2 text-[var(--admin-muted)]">{account.currency}</span>
                  </span>
                  <span className="text-[var(--admin-muted)]">{account.active ? "Activa" : "Inactiva"} ›</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <form
          className="mt-5 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void connect();
          }}
        >
          <div className="admin-sheet">
            <label className="admin-field">
              <span>Token con ads_read</span>
              <input
                className="admin-input"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="EAAG…"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          </div>
          <button type="submit" className="admin-cta" disabled={busy || token.trim().length < 40}>
            {busy ? "Conectando…" : "Conectar"}
          </button>
        </form>
      )}
      {error ? <p className="mt-3 text-[13px] text-[var(--admin-danger)]">{error}</p> : null}
    </section>
  );
}

function AccountFoot({
  connection,
  onDisconnected,
}: {
  connection: AdsConnection;
  onDisconnected: (connection: AdsConnection) => void;
}) {
  const { authorizedFetch } = useAdminAuth();
  const [busy, setBusy] = useState(false);

  async function disconnect() {
    if (!window.confirm("¿Desconectar la cuenta publicitaria? Los anuncios siguen igual en Meta.")) return;
    setBusy(true);
    try {
      const res = await authorizedFetch("/api/admin/ads/connection", { method: "DELETE" });
      const data = (await res.json()) as { connection?: AdsConnection };
      if (data.connection) onDisconnected(data.connection);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-[12px] text-[var(--admin-muted)]">
      <span>
        Cuenta: {connection.accountName || connection.accountId} · {connection.currency}
      </span>
      <button type="button" className="admin-ghost" onClick={() => void disconnect()} disabled={busy}>
        Desconectar
      </button>
    </div>
  );
}

function shortDate(day: string) {
  const date = new Date(`${day}T12:00:00-05:00`);
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "America/Bogota" })
    .format(date)
    .replace(".", "");
}

function activeLabel(count: number) {
  if (count === 0) return "Ninguna activa";
  return count === 1 ? "1 activa" : `${count} activas`;
}

function capitalize(text: string) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}
