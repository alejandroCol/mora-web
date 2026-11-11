"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  FLAG_STAGES,
  FLAG_STAGE_LABEL,
  GIFT_SPIRITS,
  KNOWN_FLAGS,
  SPIRIT_CODE_STATUS_LABEL,
  cleanTesters,
  giftSpiritName,
  isFlagKey,
  isSpiritCodeFormat,
  normalizeFlagKey,
  normalizeSpiritCode,
  spiritCodeStatus,
  type FeatureFlagRecord,
  type FlagStage,
  type SpiritCodeRecord,
  type SpiritCodeStatus,
} from "@/commerce/developer";
import { BrandLoader } from "@/components/brand/BrandLoader";
import { useAdminAuth } from "./AdminAuth";

type ApiResponse = {
  ok?: boolean;
  error?: string;
  flags?: FeatureFlagRecord[];
  codes?: SpiritCodeRecord[];
};

const STAGE_HINT: Record<FlagStage, string> = {
  off: "Nadie la ve.",
  testers: "Solo las cuentas de la lista.",
  on: "Todas las personas, con o sin sesión.",
};

function ago(at: number) {
  if (!at) return "";
  const mins = Math.round(Math.max(0, Date.now() - at) / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

function dayLabel(at: number) {
  return new Date(at).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

/** `2026-12-31` → fin de ese día en la hora de quien lo escribe. */
function endOfDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

export function DeveloperView() {
  const { authorizedFetch } = useAdminAuth();
  const [flags, setFlags] = useState<FeatureFlagRecord[] | null>(null);
  const [codes, setCodes] = useState<SpiritCodeRecord[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);

  const flash = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  useEffect(() => {
    let alive = true;
    const read = async (path: string) => {
      const res = await authorizedFetch(path);
      const data = (await res.json()) as ApiResponse;
      if (!res.ok || data.ok === false) throw new Error(data.error || "No se pudo leer.");
      return data;
    };
    Promise.all([read("/api/admin/developer/flags"), read("/api/admin/developer/spirit-codes")])
      .then(([flagData, codeData]) => {
        if (!alive) return;
        setFlags(flagData.flags ?? []);
        setCodes(codeData.codes ?? []);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "No se pudo leer.");
        setFlags((current) => current ?? []);
        setCodes((current) => current ?? []);
      });
    return () => {
      alive = false;
    };
  }, [authorizedFetch]);

  async function mutate(key: string, input: string, init: RequestInit, done?: string) {
    setBusy(key);
    setError("");
    try {
      const res = await authorizedFetch(input, init);
      const data = (await res.json()) as ApiResponse;
      if (!res.ok || data.ok === false) throw new Error(data.error || "No se pudo guardar.");
      if (data.flags) setFlags(data.flags);
      if (data.codes) setCodes(data.codes);
      if (done) flash(done);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  const patchFlag = (flag: FeatureFlagRecord, patch: { stage?: FlagStage; testers?: string[] }, done: string) =>
    mutate(
      `flag:${flag.key}`,
      `/api/admin/developer/flags/${encodeURIComponent(flag.key)}`,
      { method: "PATCH", body: JSON.stringify(patch) },
      done,
    );

  function removeFlag(flag: FeatureFlagRecord) {
    if (!window.confirm(`¿Borrar la flag ${flag.key}? Las apps la tratarán como apagada.`)) return;
    void mutate(
      `flag:${flag.key}`,
      `/api/admin/developer/flags/${encodeURIComponent(flag.key)}`,
      { method: "DELETE" },
      `${flag.key} borrada.`,
    );
  }

  const createCode = (body: {
    code: string;
    lineage: string;
    maxUses: number | null;
    expiresAt: number | null;
    note: string;
  }) =>
    mutate(
      "code:create",
      "/api/admin/developer/spirit-codes",
      { method: "POST", body: JSON.stringify(body) },
      `${body.code} creado.`,
    );

  function toggleCode(code: SpiritCodeRecord) {
    void mutate(
      `code:${code.code}`,
      `/api/admin/developer/spirit-codes/${encodeURIComponent(code.code)}`,
      { method: "PATCH", body: JSON.stringify({ active: !code.active }) },
      code.active ? `${code.code} en pausa.` : `${code.code} activo.`,
    );
  }

  function removeCode(code: SpiritCodeRecord) {
    const kept =
      code.uses > 0
        ? ` ${code.uses} ${code.uses === 1 ? "persona ya lo canjeó y conserva" : "personas ya lo canjearon y conservan"} su espíritu.`
        : "";
    if (!window.confirm(`¿Borrar ${code.code}?${kept} Nadie más podrá canjearlo.`)) return;
    void mutate(
      `code:${code.code}`,
      `/api/admin/developer/spirit-codes/${encodeURIComponent(code.code)}`,
      { method: "DELETE" },
      `${code.code} borrado.`,
    );
  }

  const stats = useMemo(() => {
    const flagList = flags ?? [];
    const codeList = codes ?? [];
    return {
      on: flagList.filter((flag) => flag.stage === "on").length,
      testing: flagList.filter((flag) => flag.stage === "testers").length,
      flags: flagList.length,
      activeCodes: codeList.filter((code) => spiritCodeStatus(code) === "active").length,
      codes: codeList.length,
      redeemed: codeList.reduce((sum, code) => sum + code.uses, 0),
    };
  }, [flags, codes]);

  const loading = flags === null || codes === null;
  const hasCocker = (codes ?? []).some((code) => code.code === "COCKER");

  return (
    <div className="ventas-app">
      <header>
        <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Apps · Founder</p>
        <h1 className="mt-2 font-display text-4xl tracking-[-0.05em]">Developer.</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
          Enciende funciones de las apps sin publicarlas. Cada teléfono pregunta al abrirse y al entrar
          a la cuenta; entre tanto usa lo último que supo. Sin red, una función nueva sigue apagada.
        </p>
      </header>

      <div className="ventas-kpis">
        <Kpi label="Para todos" value={String(stats.on)} hint={`${stats.flags} flags`} />
        <Kpi label="En prueba" value={String(stats.testing)} hint="Solo probadores" />
        <Kpi label="Códigos activos" value={String(stats.activeCodes)} hint={`${stats.codes} en total`} />
        <Kpi label="Canjes" value={String(stats.redeemed)} hint="Personas distintas" />
      </div>

      {error ? <p className="text-[13px] text-[var(--admin-danger)]">{error}</p> : null}

      {loading ? (
        <div className="grid min-h-[20vh] place-items-center">
          <BrandLoader label="Cargando Developer" />
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <SectionTitle
              title="Feature flags"
              blurb="Apagada, solo probadores o todos. El cambio llega cuando la persona vuelve a abrir la app."
            />
            <ul className="space-y-2">
              {flags.map((flag) => (
                <FlagRow
                  key={flag.key}
                  flag={flag}
                  busy={busy === `flag:${flag.key}`}
                  onStage={(stage) =>
                    void patchFlag(flag, { stage }, `${flagLabel(flag.key)}: ${FLAG_STAGE_LABEL[stage].toLowerCase()}.`)
                  }
                  onTesters={(testers) => patchFlag(flag, { testers }, "Probadores guardados.")}
                  onRemove={() => removeFlag(flag)}
                />
              ))}
            </ul>
            <NewFlagCard
              busy={busy === "flag:create"}
              taken={flags.map((flag) => flag.key)}
              onCreate={(key, note) =>
                mutate(
                  "flag:create",
                  "/api/admin/developer/flags",
                  { method: "POST", body: JSON.stringify({ key, note }) },
                  `${key} creada, apagada.`,
                )
              }
            />
          </section>

          <section className="space-y-2">
            <SectionTitle
              title="Códigos de espíritu"
              blurb="La persona lo escribe en Vínculo › Cambiar mi espíritu y recibe ese espíritu. Conserva nivel, nombre y progreso, y puede volver al suyo cuando quiera."
            />
            <NewSpiritCodeCard busy={busy === "code:create"} suggestCocker={!hasCocker} onCreate={createCode} />
            {codes.length === 0 ? (
              <p className="rounded-[1.25rem] bg-white px-5 py-8 text-[14px] text-[var(--admin-muted)] shadow-[var(--admin-shadow)]">
                Aún no hay códigos. Crea el primero arriba.
              </p>
            ) : (
              <ul className="space-y-2">
                {codes.map((code) => (
                  <SpiritCodeRow
                    key={code.code}
                    code={code}
                    busy={busy === `code:${code.code}`}
                    onToggle={() => toggleCode(code)}
                    onRemove={() => removeCode(code)}
                    onCopy={async () => {
                      try {
                        await navigator.clipboard.writeText(code.code);
                        flash("Código copiado.");
                      } catch {
                        flash(code.code);
                      }
                    }}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {toast ? (
        <p className="pointer-events-none fixed bottom-[calc(var(--admin-dock)+1rem)] left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#1d1d1f] px-4 py-2 text-[12px] text-white shadow-lg lg:bottom-6">
          {toast}
        </p>
      ) : null}
    </div>
  );
}

function flagLabel(key: string) {
  return KNOWN_FLAGS.find((flag) => flag.key === key)?.label ?? key;
}

function SectionTitle({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="pt-4">
      <h2 className="font-display text-2xl tracking-[-0.04em]">{title}</h2>
      <p className="mt-1 max-w-xl text-[13px] leading-5 text-white/45">{blurb}</p>
    </div>
  );
}

function FlagRow({
  flag,
  busy,
  onStage,
  onTesters,
  onRemove,
}: {
  flag: FeatureFlagRecord;
  busy: boolean;
  onStage: (stage: FlagStage) => void;
  onTesters: (testers: string[]) => Promise<boolean>;
  onRemove: () => void;
}) {
  const known = KNOWN_FLAGS.find((item) => item.key === flag.key);
  const saved = flag.testers.join("\n");
  const [draft, setDraft] = useState(saved);
  const [syncedFrom, setSyncedFrom] = useState(saved);
  // Lo guardado cambió (otra pestaña, otro founder): el borrador sigue a lo guardado.
  if (syncedFrom !== saved) {
    setSyncedFrom(saved);
    setDraft(saved);
  }
  const parsed = cleanTesters(draft);
  const dirty = parsed.join("\n") !== saved;
  const emptyTesters = flag.stage === "testers" && flag.testers.length === 0;

  return (
    <li className="ventas-row">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-xl">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-medium">{known?.label ?? flag.key}</p>
            <StageChip stage={flag.stage} />
            {!flag.known ? (
              <span className="rounded-full bg-[var(--admin-field)] px-2 py-0.5 text-[11px] text-[var(--admin-muted)]">
                Sin código en las apps
              </span>
            ) : null}
          </div>
          <p className="mt-1 font-mono text-[12px] tracking-[0.02em] text-[var(--admin-muted)]">{flag.key}</p>
          {known?.blurb || flag.note ? (
            <p className="mt-2 text-[13px] leading-5 text-[var(--admin-muted)]">{known?.blurb ?? flag.note}</p>
          ) : null}
        </div>
        <div
          role="radiogroup"
          aria-label={`Etapa de ${known?.label ?? flag.key}`}
          className="flex rounded-full bg-[var(--admin-field)] p-0.5 text-[12px]"
        >
          {FLAG_STAGES.map((stage) => (
            <button
              key={stage}
              type="button"
              role="radio"
              aria-checked={flag.stage === stage}
              disabled={busy}
              onClick={() => (flag.stage === stage ? undefined : onStage(stage))}
              className={`h-8 rounded-full px-3 transition-colors disabled:opacity-50 ${
                flag.stage === stage ? "bg-[#1d1d1f] text-white" : "text-[var(--admin-muted)]"
              }`}
            >
              {FLAG_STAGE_LABEL[stage]}
            </button>
          ))}
        </div>
      </div>

      {flag.stage === "testers" ? (
        <div className="mt-3 rounded-[1rem] bg-[var(--admin-field)] p-3">
          <label className="block text-[11px] uppercase tracking-[0.08em] text-[var(--admin-muted)]">
            Probadores · correo de su cuenta Mora, uno por línea
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={Math.min(6, Math.max(2, draft.split("\n").length))}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder={"ana@correo.com\nbeto@correo.com"}
              className="mt-2 w-full resize-y rounded-[0.75rem] bg-white px-3 py-2 font-mono text-[13px] normal-case tracking-normal text-[#1d1d1f] outline-none"
            />
          </label>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className={`text-[12px] ${emptyTesters && !dirty ? "text-[var(--admin-danger)]" : "text-[var(--admin-muted)]"}`}>
              {emptyTesters && !dirty
                ? "Lista vacía: hoy no la ve nadie."
                : `${parsed.length} ${parsed.length === 1 ? "cuenta" : "cuentas"}${dirty ? " · sin guardar" : ""}`}
            </p>
            <button
              type="button"
              disabled={busy || !dirty}
              onClick={() => void onTesters(parsed)}
              className="h-9 rounded-full bg-[#1d1d1f] px-4 text-[12px] text-white disabled:opacity-30"
            >
              Guardar probadores
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-[var(--admin-muted)]">
        <span>{STAGE_HINT[flag.stage]}</span>
        {flag.updatedAt ? <span>· cambió {ago(flag.updatedAt)}</span> : <span>· de fábrica</span>}
        {!flag.known ? (
          <button
            type="button"
            disabled={busy}
            onClick={onRemove}
            className="ml-auto h-8 rounded-full px-3 text-[12px] normal-case tracking-normal text-[var(--admin-danger)] hover:bg-red-50 disabled:opacity-40"
          >
            Borrar
          </button>
        ) : null}
      </div>
    </li>
  );
}

function NewFlagCard({
  busy,
  taken,
  onCreate,
}: {
  busy: boolean;
  taken: string[];
  onCreate: (key: string, note: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [note, setNote] = useState("");
  const [local, setLocal] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 rounded-full bg-white/8 px-4 text-[12px] text-white/55"
      >
        Nueva flag
      </button>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLocal("");
    if (!isFlagKey(key)) {
      setLocal("Minúsculas, números y guion bajo (2 a 40), empezando por letra.");
      return;
    }
    if (taken.includes(key)) {
      setLocal("Esa flag ya existe.");
      return;
    }
    if (await onCreate(key, note.trim())) {
      setKey("");
      setNote("");
      setOpen(false);
    }
  }

  return (
    <form onSubmit={submit} className="admin-sheet">
      <div className="grid sm:grid-cols-2">
        <label className="admin-field">
          <span>Clave</span>
          <input
            value={key}
            onChange={(event) => setKey(normalizeFlagKey(event.target.value))}
            placeholder="nueva_funcion"
            maxLength={40}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            className="admin-input font-mono"
          />
        </label>
        <label className="admin-field sm:border-l sm:border-t-0">
          <span>Para qué es</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={160}
            placeholder="Qué enciende en las apps"
            className="admin-input"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-line)] px-4 py-3 sm:px-5">
        <p className="text-[12px] text-[var(--admin-muted)]">
          {local || "Nace apagada. No hace nada hasta que una versión de las apps la lea."}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-10 rounded-full px-4 text-[13px] text-[var(--admin-muted)]"
          >
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="admin-cta h-10 w-auto px-5 text-[14px] disabled:opacity-40">
            {busy ? "Creando…" : "Crear flag"}
          </button>
        </div>
      </div>
    </form>
  );
}

function NewSpiritCodeCard({
  busy,
  suggestCocker,
  onCreate,
}: {
  busy: boolean;
  suggestCocker: boolean;
  onCreate: (body: {
    code: string;
    lineage: string;
    maxUses: number | null;
    expiresAt: number | null;
    note: string;
  }) => Promise<boolean>;
}) {
  const [code, setCode] = useState("");
  const [lineage, setLineage] = useState(GIFT_SPIRITS[0]?.lineage ?? "");
  const [maxUses, setMaxUses] = useState("");
  const [expires, setExpires] = useState("");
  const [note, setNote] = useState("");
  const [local, setLocal] = useState("");
  const spirit = GIFT_SPIRITS.find((item) => item.lineage === lineage);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLocal("");
    const clean = normalizeSpiritCode(code);
    if (!isSpiritCodeFormat(clean)) {
      setLocal("El código lleva de 3 a 24 letras o números.");
      return;
    }
    const expiresAt = expires ? endOfDay(expires) : null;
    if (expiresAt != null && expiresAt <= Date.now()) {
      setLocal("Esa fecha ya pasó.");
      return;
    }
    const ok = await onCreate({
      code: clean,
      lineage,
      maxUses: maxUses.trim() ? Number(maxUses) || null : null,
      expiresAt,
      note: note.trim(),
    });
    if (ok) {
      setCode("");
      setMaxUses("");
      setExpires("");
      setNote("");
    }
  }

  return (
    <form onSubmit={submit} className="admin-sheet">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5">
        <div>
          <p className="text-[13px] font-medium">Nuevo código</p>
          <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
            {spirit ? `Regala a ${spirit.name}. ${spirit.blurb}` : "Elige el espíritu."}
          </p>
        </div>
        {suggestCocker ? (
          <button
            type="button"
            onClick={() => {
              setCode("COCKER");
              setLineage("cocker");
            }}
            className="h-8 rounded-full bg-[var(--admin-field)] px-3 text-[12px] text-[var(--admin-muted)]"
          >
            Usar COCKER
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid sm:grid-cols-2">
        <label className="admin-field">
          <span>Código</span>
          <input
            value={code}
            onChange={(event) => setCode(normalizeSpiritCode(event.target.value))}
            placeholder="COCKER"
            maxLength={24}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="admin-input font-mono uppercase tracking-[0.06em]"
          />
        </label>
        <label className="admin-field sm:border-l sm:border-t-0">
          <span>Espíritu</span>
          <select value={lineage} onChange={(event) => setLineage(event.target.value)} className="admin-input">
            {GIFT_SPIRITS.map((item) => (
              <option key={item.lineage} value={item.lineage}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>Personas que pueden canjearlo</span>
          <input
            value={maxUses}
            onChange={(event) => setMaxUses(event.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            placeholder="Sin límite"
            className="admin-input"
          />
        </label>
        <label className="admin-field sm:border-l">
          <span>Vence (opcional)</span>
          <input
            type="date"
            value={expires}
            onChange={(event) => setExpires(event.target.value)}
            className="admin-input"
          />
        </label>
        <label className="admin-field sm:col-span-2">
          <span>Nota (solo para el equipo)</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={160}
            placeholder="Regalo de lanzamiento"
            className="admin-input"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-line)] px-4 py-3 sm:px-5">
        <p className={`text-[12px] ${local ? "text-[var(--admin-danger)]" : "text-[var(--admin-muted)]"}`}>
          {local || "Cada persona cuenta una vez, aunque lo canjee en varios teléfonos."}
        </p>
        <button type="submit" disabled={busy} className="admin-cta h-10 w-auto px-5 text-[14px] disabled:opacity-40">
          {busy ? "Creando…" : "Crear código"}
        </button>
      </div>
    </form>
  );
}

function SpiritCodeRow({
  code,
  busy,
  onToggle,
  onRemove,
  onCopy,
}: {
  code: SpiritCodeRecord;
  busy: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onCopy: () => void;
}) {
  const status = spiritCodeStatus(code);
  const left = code.maxUses == null ? null : Math.max(0, code.maxUses - code.uses);
  return (
    <li className="ventas-row">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[15px] font-medium tracking-[0.04em]">{code.code}</p>
            <CodeChip status={status} />
          </div>
          <p className="mt-1 text-[13px] text-[var(--admin-muted)]">
            Regala a {giftSpiritName(code.lineage)}
            {code.note ? ` · ${code.note}` : ""}
          </p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.08em] text-[var(--admin-muted)]">
            {code.maxUses == null
              ? `${code.uses} ${code.uses === 1 ? "canje" : "canjes"} · sin límite`
              : `${code.uses} de ${code.maxUses} canjes · quedan ${left}`}
            {code.expiresAt != null ? ` · vence ${dayLabel(code.expiresAt)}` : " · no vence"}
            {code.createdAt ? ` · creado ${ago(code.createdAt)}` : ""}
          </p>
        </div>
        <p className="text-[22px] font-semibold tracking-[-0.03em]">{code.uses}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onToggle}
          className="h-9 rounded-full bg-[var(--admin-field)] px-4 text-[12px] disabled:opacity-40"
        >
          {code.active ? "Pausar" : "Activar"}
        </button>
        <button type="button" onClick={onCopy} className="h-9 rounded-full bg-[var(--admin-field)] px-4 text-[12px]">
          Copiar código
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onRemove}
          className="ml-auto h-9 rounded-full px-4 text-[12px] text-[var(--admin-danger)] hover:bg-red-50 disabled:opacity-40"
        >
          Borrar
        </button>
      </div>
    </li>
  );
}

function StageChip({ stage }: { stage: FlagStage }) {
  const tone =
    stage === "on"
      ? "bg-[rgba(31,122,56,0.1)] text-[var(--admin-ok)]"
      : stage === "testers"
        ? "bg-[rgba(176,112,20,0.12)] text-[#8a5a12]"
        : "bg-[var(--admin-field)] text-[var(--admin-muted)]";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] ${tone}`}>{FLAG_STAGE_LABEL[stage]}</span>;
}

function CodeChip({ status }: { status: SpiritCodeStatus }) {
  const tone =
    status === "active"
      ? "bg-[rgba(31,122,56,0.1)] text-[var(--admin-ok)]"
      : status === "paused"
        ? "bg-[var(--admin-field)] text-[var(--admin-muted)]"
        : "bg-[rgba(180,35,24,0.08)] text-[var(--admin-danger)]";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] ${tone}`}>{SPIRIT_CODE_STATUS_LABEL[status]}</span>;
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="ventas-kpi">
      <p className="text-[11px] text-[var(--admin-muted)]">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">{value}</p>
      <p className="mt-1 text-[11px] text-[var(--admin-muted)]">{hint}</p>
    </div>
  );
}
