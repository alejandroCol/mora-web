"use client";

import { useCallback, useEffect, useState } from "react";
import type { GrowthSettings, MoraLead } from "@/growth/types";
import { useAdminAuth } from "./AdminAuth";

type AdminGrowth = GrowthSettings & {
  configured: { pixel: boolean; capi: boolean; whatsapp: boolean };
};

const FIELDS: {
  key: keyof GrowthSettings;
  label: string;
  hint: string;
  secret?: boolean;
  area?: boolean;
}[] = [
  { key: "metaPixelId", label: "Pixel ID", hint: "Administrador de eventos → Pixel" },
  { key: "metaCapiToken", label: "Token CAPI", hint: "Token de la API de conversiones", secret: true },
  { key: "metaCapiTestEventCode", label: "Código de prueba CAPI", hint: "Opcional, solo para Test Events" },
  { key: "googleSiteVerification", label: "Google Search Console", hint: "Código de verificación del sitio" },
  { key: "whatsappPhoneNumberId", label: "Phone number ID", hint: "WhatsApp → Configuración de la API" },
  { key: "whatsappAccessToken", label: "Token WhatsApp", hint: "Token permanente del sistema", secret: true },
  { key: "whatsappVerifyToken", label: "Verify token", hint: "Lo inventas tú para el webhook", secret: true },
  { key: "whatsappAppSecret", label: "App secret", hint: "Opcional, firma del webhook", secret: true },
  { key: "whatsappDisplayNumber", label: "Número público", hint: "57 + celular, para el botón wa.me" },
  { key: "whatsappPrefill", label: "Texto del botón", hint: "Mensaje que abre el visitante", area: true },
  { key: "whatsappWelcome", label: "Auto-respuesta", hint: "Primer mensaje automático", area: true },
];

const STEPS = [
  "Crea el Business Manager de Mora y verifica el dominio (mora.ring o el que uses).",
  "Crea el Pixel y pega el ID + el token de la API de conversiones aquí. Eso conecta la web al Administrador de anuncios.",
  "En Eventos del navegador y del servidor deben verse PageView, ViewContent, AddToCart, InitiateCheckout, Lead, Contact y Purchase.",
  "Crea la cuenta de WhatsApp Business y una app de Cloud API. Pega Phone number ID y el token.",
  "En la app, webhook = la URL de abajo. Verify token = el mismo de este panel. Suscribe messages.",
  "En Anuncios, usa destino Click to WhatsApp. Esos chats llegan a Superadmin → WhatsApp con etiqueta Anuncio.",
  "Crea conversiones personalizadas: Lead (WhatsApp o checkout) y Purchase. Optimiza las campañas a esos eventos.",
  "Sube audiencias desde los leads (correo y teléfono). El Pixel ya recolecta visitantes para remarketing.",
];

export function CampanasView() {
  const { authorizedFetch } = useAdminAuth();
  const [settings, setSettings] = useState<AdminGrowth | null>(null);
  const [webhook, setWebhook] = useState("");
  const [leads, setLeads] = useState<MoraLead[]>([]);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [growthRes, leadsRes] = await Promise.all([
      authorizedFetch("/api/admin/growth"),
      authorizedFetch("/api/admin/leads"),
    ]);
    const growth = (await growthRes.json()) as {
      ok?: boolean;
      settings?: AdminGrowth;
      webhook?: string;
    };
    const leadData = (await leadsRes.json()) as { ok?: boolean; leads?: MoraLead[] };
    if (growth.settings) setSettings(growth.settings);
    if (growth.webhook) setWebhook(growth.webhook);
    if (leadData.leads) setLeads(leadData.leads);
  }, [authorizedFetch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function persist() {
    if (!settings) return;
    setBusy(true);
    setSaved("");
    try {
      const payload = Object.fromEntries(
        FIELDS.map((field) => [field.key, settings[field.key]]),
      );
      const res = await authorizedFetch("/api/admin/growth", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; settings?: AdminGrowth; webhook?: string };
      if (data.settings) setSettings(data.settings);
      if (data.webhook) setWebhook(data.webhook);
      setSaved(data.ok ? "Guardado" : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  if (!settings) return <p className="text-white/40">Cargando campañas…</p>;

  return (
    <div className="max-w-4xl">
      <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Crecimiento</p>
      <h1 className="mt-2 font-display text-4xl tracking-[-0.05em]">Google, Meta y WhatsApp.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
        La web ya manda eventos al Pixel y a la API de conversiones. Aquí pegas las llaves de Meta
        y el número de WhatsApp Business. El Administrador de anuncios lee esos mismos eventos.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 text-[12px]">
        <Pill ok={settings.configured.pixel} label="Pixel" />
        <Pill ok={settings.configured.capi} label="CAPI" />
        <Pill ok={settings.configured.whatsapp} label="WhatsApp" />
      </div>

      <ol className="mt-8 space-y-3 text-[13px] leading-6 text-white/60">
        {STEPS.map((step, index) => (
          <li key={step} className="flex gap-3">
            <span className="text-white/30">{String(index + 1).padStart(2, "0")}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      {webhook ? (
        <div className="mt-8 rounded-3xl bg-white/6 px-5 py-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">Webhook WhatsApp</p>
          <p className="mt-2 break-all text-[13px] text-white/80">{webhook}</p>
        </div>
      ) : null}

      <div className="mt-8 grid gap-3">
        {FIELDS.map((field) => (
          <label key={field.key} className="block">
            <span className="text-[11px] uppercase tracking-[0.12em] text-white/35">
              {field.label}
            </span>
            {field.area ? (
              <textarea
                value={String(settings[field.key] ?? "")}
                onChange={(event) =>
                  setSettings({ ...settings, [field.key]: event.target.value })
                }
                rows={2}
                className="mt-1 w-full rounded-2xl bg-white/8 p-3 text-sm"
              />
            ) : (
              <input
                type={field.secret ? "password" : "text"}
                value={String(settings[field.key] ?? "")}
                onChange={(event) =>
                  setSettings({ ...settings, [field.key]: event.target.value })
                }
                className="mt-1 h-11 w-full rounded-2xl bg-white/8 px-3 text-sm"
              />
            )}
            <span className="mt-1 block text-[12px] text-white/30">{field.hint}</span>
          </label>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => void persist()}
          className="h-11 rounded-full bg-white px-6 text-[13px] text-[#16141f] disabled:opacity-40"
        >
          {busy ? "Guardando…" : "Guardar llaves"}
        </button>
        {saved ? <p className="text-[13px] text-white/45">{saved}</p> : null}
      </div>

      <div className="mt-14">
        <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Leads</p>
        <h2 className="mt-2 font-display text-3xl tracking-[-0.04em]">Personas interesadas.</h2>
        <p className="mt-2 text-sm text-white/45">
          WhatsApp, checkout y anuncios. Sirven para audiencias personalizadas y para dar
          seguimiento.
        </p>
        <div className="mt-6 overflow-x-auto rounded-3xl border border-white/8">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-[0.12em] text-white/35">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">Origen</th>
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-white/35">
                    Todavía no hay leads. El primero llega con un clic a WhatsApp o al checkout.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="border-t border-white/6">
                    <td className="px-4 py-3">{lead.name || "—"}</td>
                    <td className="px-4 py-3 text-white/60">
                      {lead.phone || lead.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-white/60">
                      {lead.source}
                      {lead.attribution?.utmCampaign
                        ? ` · ${lead.attribution.utmCampaign}`
                        : ""}
                    </td>
                    <td className="px-4 py-3 text-white/60">{lead.lastEvent}</td>
                    <td className="px-4 py-3">{lead.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 ${
        ok ? "bg-white text-[#16141f]" : "bg-white/8 text-white/45"
      }`}
    >
      {ok ? "Listo · " : "Falta · "}
      {label}
    </span>
  );
}
