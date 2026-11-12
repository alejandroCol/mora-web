"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import type { CrmQuickReply, CrmSettings, CrmTemplate } from "@/growth/types";
import { defaultCrmReplies } from "@/crm/replies";

type Connection = {
  ready: boolean;
  displayNumber: string;
  webhook: string;
  welcome: boolean;
  welcomeText?: string;
  twoStep?: boolean;
  twoStepSetAt?: number;
  webhookDebug?: { signatureProvenFor?: string };
};

export function CrmSettingsPanel({
  settings,
  connection,
  instagram,
  onClose,
  onSave,
  onSetPin,
}: {
  settings: CrmSettings | null;
  connection: Connection | null;
  instagram: { ready: boolean; username: string; humanAgent: boolean } | null;
  onClose: () => void;
  onSave: (next: CrmSettings, welcome: string) => Promise<void>;
  onSetPin: (pin: string) => Promise<void>;
}) {
  const [replies, setRepliesState] = useState<CrmQuickReply[]>(settings?.replies ?? defaultCrmReplies());
  const [templates, setTemplatesState] = useState<CrmTemplate[]>(settings?.templates ?? []);
  const [autoClaim, setAutoClaimState] = useState(settings?.autoClaimOnReply !== false);
  // El workspace recarga `settings` cada 8 s: con cambios sin guardar, no se pisan.
  const dirty = useRef(false);
  function edited<T>(set: Dispatch<SetStateAction<T>>) {
    return (next: SetStateAction<T>) => {
      dirty.current = true;
      set(next);
    };
  }
  const setReplies = edited(setRepliesState);
  const setTemplates = edited(setTemplatesState);
  const setAutoClaim = edited(setAutoClaimState);
  const [welcome, setWelcome] = useState(connection?.welcomeText ?? "");
  const [pin, setPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMsg, setPinMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    if (!settings || dirty.current) return;
    setRepliesState(settings.replies);
    setTemplatesState(settings.templates);
    setAutoClaimState(settings.autoClaimOnReply);
  }, [settings]);

  useEffect(() => {
    if (connection?.welcomeText !== undefined) setWelcome(connection.welcomeText);
  }, [connection?.welcomeText]);

  async function persist() {
    setBusy(true);
    setSaved("");
    try {
      await onSave(
        {
          replies,
          templates,
          autoClaimOnReply: autoClaim,
          updatedAt: Date.now(),
        },
        welcome,
      );
      dirty.current = false;
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
          {connection?.ready ? (
            <p className="mt-2 text-[12px] text-white/40">
              {connection.webhookDebug?.signatureProvenFor
                ? "Firma de Meta comprobada: solo entran avisos firmados."
                : "Aún no se comprueba la firma de Meta en los avisos. Pega el App secret en Campañas y se activa sola con el siguiente mensaje."}
            </p>
          ) : null}

          <div className="mt-5 rounded-2xl bg-white/6 p-3">
            <p className="text-[13px]">
              {connection?.twoStep ? "PIN de 2 pasos activo en Meta." : "PIN de 2 pasos · aún no está en Meta."}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={pin}
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="h-10 w-28 rounded-full bg-white/8 px-4 text-center tracking-[0.35em] outline-none"
              />
              <button
                type="button"
                disabled={pinBusy || pin.length !== 6}
                onClick={() => {
                  setPinBusy(true);
                  setPinMsg("");
                  void onSetPin(pin)
                    .then(() => {
                      setPin("");
                      setPinMsg("Listo. Guárdalo fuera de Mora.");
                    })
                    .catch((error: unknown) => {
                      setPinMsg(error instanceof Error ? error.message : "Meta no lo aceptó.");
                    })
                    .finally(() => setPinBusy(false));
                }}
                className="h-10 rounded-full bg-[#1d1d1f] px-4 text-[12px] text-white disabled:opacity-40"
              >
                {pinBusy ? "Enviando…" : connection?.twoStep ? "Cambiar PIN" : "Activar"}
              </button>
            </div>
            {pinMsg ? <p className="mt-2 text-[12px] text-white/45">{pinMsg}</p> : null}
          </div>
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

        <section className="mt-8">
          <h3 className="text-[14px]">Instagram</h3>
          <p className="mt-1 text-[13px] leading-6 text-white/45">
            Los mensajes directos llegan a este mismo inbox, con la marca IG. Se responde igual, sin plantillas:
            Instagram deja escribir {instagram?.humanAgent ? "7 días" : "24 h"} después del último mensaje de la persona.
          </p>
          <p className="mt-3 text-[13px]">
            {instagram?.ready ? (
              `Conectado · @${instagram.username}`
            ) : (
              <>
                Falta conectar. Se hace una vez en{" "}
                <Link href="/superadmin/automatizaciones" className="underline">
                  Automatizaciones
                </Link>
                .
              </>
            )}
          </p>
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
          <h3 className="text-[14px]">Primera respuesta</h3>
          <p className="mt-1 text-[12px] leading-5 text-white/40">
            Se envía sola la primera vez que alguien escribe. Vacío = no hay auto-respuesta.
          </p>
          <textarea
            value={welcome}
            rows={3}
            onChange={(event) => setWelcome(event.target.value)}
            placeholder="Hola, soy Mora…"
            className="mt-3 w-full rounded-2xl bg-white/8 p-3 text-[13px] outline-none"
          />
        </section>

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
                    billingCategory: "marketing",
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
            La categoría Meta define el costo en el panel del CRM.
          </p>
          <div className="mt-3 space-y-3">
            {templates.map((template, index) => (
              <div key={template.id} className="grid gap-2 rounded-2xl bg-white/6 p-3 sm:grid-cols-[1fr_1fr_4rem_6rem_5rem_auto]">
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
                <select
                  value={template.billingCategory ?? "marketing"}
                  onChange={(event) =>
                    setTemplates((current) =>
                      current.map((item, i) =>
                        i === index
                          ? {
                              ...item,
                              billingCategory: event.target.value as NonNullable<
                                CrmTemplate["billingCategory"]
                              >,
                            }
                          : item,
                      ),
                    )
                  }
                  className="h-10 rounded-xl bg-white/8 px-2 text-[12px] outline-none"
                  title="Categoría de cobro Meta"
                >
                  <option value="marketing">Marketing</option>
                  <option value="utility">Utilidad</option>
                  <option value="authentication">Auth</option>
                </select>
                <select
                  value={template.desk}
                  onChange={(event) =>
                    setTemplates((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, desk: event.target.value as CrmTemplate["desk"] } : item,
                      ),
                    )
                  }
                  className="h-10 rounded-xl bg-white/8 px-2 text-[12px] outline-none"
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
                <textarea
                  value={template.body ?? ""}
                  placeholder="Texto aprobado en Meta (usa {{1}} si tiene variables). Se muestra en el hilo al enviarla."
                  rows={2}
                  onChange={(event) =>
                    setTemplates((current) =>
                      current.map((item, i) =>
                        i === index
                          ? {
                              ...item,
                              body: event.target.value,
                              variables: new Set(event.target.value.match(/\{\{\d+\}\}/g) ?? []).size,
                            }
                          : item,
                      ),
                    )
                  }
                  className="rounded-xl bg-white/8 px-3 py-2 text-[13px] outline-none sm:col-span-6"
                />
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
