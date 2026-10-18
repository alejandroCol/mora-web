"use client";

import { useEffect, useState } from "react";
import type { CrmQuickReply, CrmSettings, CrmTemplate } from "@/growth/types";
import { defaultCrmReplies } from "@/crm/replies";

type Connection = {
  ready: boolean;
  displayNumber: string;
  webhook: string;
  welcome: boolean;
};

export function CrmSettingsPanel({
  settings,
  connection,
  onClose,
  onSave,
}: {
  settings: CrmSettings | null;
  connection: Connection | null;
  onClose: () => void;
  onSave: (next: CrmSettings) => Promise<void>;
}) {
  const [replies, setReplies] = useState<CrmQuickReply[]>(settings?.replies ?? defaultCrmReplies());
  const [templates, setTemplates] = useState<CrmTemplate[]>(settings?.templates ?? []);
  const [autoClaim, setAutoClaim] = useState(settings?.autoClaimOnReply !== false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    if (!settings) return;
    setReplies(settings.replies);
    setTemplates(settings.templates);
    setAutoClaim(settings.autoClaimOnReply);
  }, [settings]);

  async function persist() {
    setBusy(true);
    setSaved("");
    try {
      await onSave({
        replies,
        templates,
        autoClaimOnReply: autoClaim,
        updatedAt: Date.now(),
      });
      setSaved("Guardado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="crm-sheet">
      <div className="crm-sheet-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] text-white/35">Ajustes del CRM</p>
            <h2 className="mt-1 font-display text-3xl tracking-[-0.04em]">Cómo se vende aquí.</h2>
          </div>
          <button type="button" onClick={onClose} className="text-[13px] text-white/45">
            Cerrar
          </button>
        </div>

        <section className="mt-8">
          <h3 className="text-[14px]">WhatsApp Cloud API</h3>
          <p className="mt-1 text-[13px] leading-6 text-white/45">
            El número vive en Campañas. Aquí solo ves si ya puede entrar chat.
          </p>
          <p className="mt-3 text-[13px]">
            {connection?.ready
              ? `Conectado · +${connection.displayNumber}`
              : "Falta conectar. Ve a Superadmin → Campañas y pega Phone number ID + token."}
          </p>
          {connection?.webhook ? (
            <p className="mt-2 break-all text-[12px] text-white/40">{connection.webhook}</p>
          ) : null}
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-[13px] leading-6 text-white/55">
            <li>Meta Business Suite → WhatsApp → cuenta de Mora. El número no debe usarse en la app del teléfono.</li>
            <li>App de Cloud API: webhook = la URL de arriba. Verify token = el de Campañas. Suscribe <em>messages</em>.</li>
            <li>En Anuncios, destino Click to WhatsApp. Esos chats llegan con etiqueta Anuncio.</li>
            <li>
              Plantillas: Administrador de WhatsApp → Plantillas de mensaje. Idioma español. Cuando Meta las
              apruebe, pégalas abajo. Sin plantilla no se escribe fuera de 24 h.
            </li>
            <li>Equipo → crea vendedores. Cada chat se toma. Nadie responde desde el celular.</li>
          </ol>
        </section>

        <label className="mt-8 flex items-center gap-3 text-[13px]">
          <input
            type="checkbox"
            checked={autoClaim}
            onChange={(event) => setAutoClaim(event.target.checked)}
          />
          Al responder, el chat queda a mi nombre si nadie lo tenía.
        </label>

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px]">Respuestas rápidas</h3>
            <button
              type="button"
              onClick={() =>
                setReplies((current) => [
                  ...current,
                  { id: crypto.randomUUID(), title: "", body: "", desk: "both" },
                ])
              }
              className="text-[12px] text-white/45"
            >
              Añadir
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {replies.map((reply, index) => (
              <div key={reply.id} className="grid gap-2 rounded-2xl bg-white/6 p-3 sm:grid-cols-[7rem_7rem_1fr_auto]">
                <input
                  value={reply.title}
                  placeholder="Título"
                  onChange={(event) =>
                    setReplies((current) =>
                      current.map((item, i) => (i === index ? { ...item, title: event.target.value } : item)),
                    )
                  }
                  className="h-10 rounded-xl bg-white/8 px-3 text-[13px] outline-none"
                />
                <select
                  value={reply.desk}
                  onChange={(event) =>
                    setReplies((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, desk: event.target.value as CrmQuickReply["desk"] } : item,
                      ),
                    )
                  }
                  className="h-10 rounded-xl bg-white/8 px-3 text-[13px] outline-none"
                >
                  <option value="both">Ambas</option>
                  <option value="sales">Ventas</option>
                  <option value="support">Soporte</option>
                </select>
                <textarea
                  value={reply.body}
                  rows={2}
                  onChange={(event) =>
                    setReplies((current) =>
                      current.map((item, i) => (i === index ? { ...item, body: event.target.value } : item)),
                    )
                  }
                  className="rounded-xl bg-white/8 p-2 text-[13px] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setReplies((current) => current.filter((_, i) => i !== index))}
                  className="text-[12px] text-white/35"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px]">Plantillas Meta</h3>
            <button
              type="button"
              onClick={() =>
                setTemplates((current) => [
                  ...current,
                  {
                    id: crypto.randomUUID(),
                    name: "",
                    language: "es",
                    label: "",
                    desk: "both",
                  },
                ])
              }
              className="text-[12px] text-white/45"
            >
              Añadir
            </button>
          </div>
          <p className="mt-1 text-[12px] text-white/40">
            El <em>name</em> es el de Meta, en minúsculas con guiones bajos. El label es lo que ve el vendedor.
          </p>
          <div className="mt-3 space-y-3">
            {templates.map((template, index) => (
              <div key={template.id} className="grid gap-2 rounded-2xl bg-white/6 p-3 sm:grid-cols-4">
                <input
                  value={template.label}
                  placeholder="Etiqueta"
                  onChange={(event) =>
                    setTemplates((current) =>
                      current.map((item, i) => (i === index ? { ...item, label: event.target.value } : item)),
                    )
                  }
                  className="h-10 rounded-xl bg-white/8 px-3 text-[13px] outline-none"
                />
                <input
                  value={template.name}
                  placeholder="nombre_meta"
                  onChange={(event) =>
                    setTemplates((current) =>
                      current.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)),
                    )
                  }
                  className="h-10 rounded-xl bg-white/8 px-3 text-[13px] outline-none"
                />
                <input
                  value={template.language}
                  placeholder="es"
                  onChange={(event) =>
                    setTemplates((current) =>
                      current.map((item, i) => (i === index ? { ...item, language: event.target.value } : item)),
                    )
                  }
                  className="h-10 rounded-xl bg-white/8 px-3 text-[13px] outline-none"
                />
                <div className="flex gap-2">
                  <select
                    value={template.desk}
                    onChange={(event) =>
                      setTemplates((current) =>
                        current.map((item, i) =>
                          i === index ? { ...item, desk: event.target.value as CrmTemplate["desk"] } : item,
                        ),
                      )
                    }
                    className="h-10 flex-1 rounded-xl bg-white/8 px-3 text-[13px] outline-none"
                  >
                    <option value="both">Ambas</option>
                    <option value="sales">Ventas</option>
                    <option value="support">Soporte</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setTemplates((current) => current.filter((_, i) => i !== index))}
                    className="text-[12px] text-white/35"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-8 flex items-center gap-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void persist()}
            className="h-11 rounded-full bg-white px-6 text-[13px] text-[#12111a] disabled:opacity-40"
          >
            {busy ? "Guardando…" : "Guardar"}
          </button>
          {saved ? <p className="text-[13px] text-white/45">{saved}</p> : null}
        </div>
      </div>
    </div>
  );
}
