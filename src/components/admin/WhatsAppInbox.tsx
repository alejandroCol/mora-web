"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  WhatsAppConversation,
  WhatsAppConversationStatus,
  WhatsAppMessage,
} from "@/growth/types";
import { useAdminAuth } from "./AdminAuth";
import { ManualSaleForm } from "./ManualSaleForm";

const STATUS_LABEL: Record<WhatsAppConversationStatus, string> = {
  new: "Nuevo",
  interested: "Interesado",
  sold: "Vendido",
  closed: "Cerrado",
};

export function WhatsAppInbox() {
  const { authorizedFetch } = useAdminAuth();
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sale, setSale] = useState(false);
  const [query, setQuery] = useState("");

  const loadList = useCallback(async () => {
    const res = await authorizedFetch("/api/admin/whatsapp");
    const data = (await res.json()) as {
      ok?: boolean;
      conversations?: WhatsAppConversation[];
    };
    if (data.ok) setConversations(data.conversations ?? []);
  }, [authorizedFetch]);

  const loadThread = useCallback(
    async (id: string) => {
      const res = await authorizedFetch(`/api/admin/whatsapp/${id}`);
      const data = (await res.json()) as {
        ok?: boolean;
        conversation?: WhatsAppConversation;
        messages?: WhatsAppMessage[];
      };
      if (!data.ok) return;
      setMessages(data.messages ?? []);
      if (data.conversation) {
        setConversations((current) =>
          current.map((item) => (item.id === id ? data.conversation! : item)),
        );
      }
      if ((data.conversation?.unread ?? 0) > 0) {
        await authorizedFetch(`/api/admin/whatsapp/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ unread: 0 }),
        });
      }
    },
    [authorizedFetch],
  );

  useEffect(() => {
    const start = window.setTimeout(() => {
      void loadList();
    }, 0);
    const timer = window.setInterval(() => void loadList(), 8000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
  }, [loadList]);

  useEffect(() => {
    if (!activeId) return;
    const start = window.setTimeout(() => {
      void loadThread(activeId);
    }, 0);
    const timer = window.setInterval(() => void loadThread(activeId), 6000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
  }, [activeId, loadThread]);

  const active = conversations.find((item) => item.id === activeId) ?? null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((item) => {
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.phone.includes(q) ||
        item.lastMessage.toLowerCase().includes(q)
      );
    });
  }, [conversations, query]);

  async function send() {
    if (!activeId || !draft.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await authorizedFetch(`/api/admin/whatsapp/${activeId}`, {
        method: "POST",
        body: JSON.stringify({ text: draft.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: WhatsAppMessage };
      if (!data.ok) throw new Error(data.error);
      setDraft("");
      if (data.message) setMessages((current) => [...current, data.message!]);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: WhatsAppConversationStatus) {
    if (!activeId) return;
    await authorizedFetch(`/api/admin/whatsapp/${activeId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await loadList();
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">WhatsApp Business</p>
          <h1 className="mt-2 font-display text-4xl tracking-[-0.05em] text-[#f4f1ea]">
            Conversaciones.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
            Inbox oficial de la Cloud API. Los anuncios Click-to-WhatsApp llegan aquí, no a un
            iframe de WhatsApp Web. Desde cada chat puedes registrar la venta.
          </p>
        </div>
        <a
          href="https://web.whatsapp.com"
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/15 px-4 py-2 text-[12px] text-white/60 hover:text-white"
        >
          Abrir WhatsApp Web
        </a>
      </div>

      <div className="mt-8 grid min-h-[70vh] overflow-hidden rounded-[28px] border border-white/8 bg-[#12111a] lg:grid-cols-[18rem_1fr]">
        <aside className="border-b border-white/8 lg:border-b-0 lg:border-r">
          <div className="p-4">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar"
              className="h-10 w-full rounded-full bg-white/8 px-4 text-[13px] outline-none"
            />
          </div>
          <ul className="max-h-[32vh] overflow-y-auto lg:max-h-[62vh]">
            {filtered.length === 0 ? (
              <li className="px-5 py-8 text-[13px] text-white/35">
                Aún no hay chats. Conecta la Cloud API en Campañas.
              </li>
            ) : (
              filtered.map((item) => {
                const on = item.id === activeId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(item.id)}
                      className={`flex w-full flex-col items-start gap-1 px-5 py-3 text-left ${
                        on ? "bg-white/10" : "hover:bg-white/4"
                      }`}
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="truncate text-[14px]">{item.name || item.phone}</span>
                        {item.unread > 0 ? (
                          <span className="rounded-full bg-white px-1.5 text-[10px] text-[#12111a]">
                            {item.unread}
                          </span>
                        ) : null}
                      </span>
                      <span className="truncate text-[12px] text-white/40">{item.lastMessage}</span>
                      <span className="text-[10px] uppercase tracking-[0.12em] text-white/30">
                        {item.source === "ad" ? "Anuncio" : "Orgánico"} · {STATUS_LABEL[item.status]}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        <section className="flex min-h-[42vh] flex-col">
          {active ? (
            <>
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
                <div>
                  <p className="text-[15px]">{active.name || active.phone}</p>
                  <p className="text-[12px] text-white/40">+{active.phone}</p>
                  {active.referral?.headline ? (
                    <p className="mt-1 text-[12px] text-white/50">
                      Llegó del anuncio: {active.referral.headline}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(STATUS_LABEL) as WhatsAppConversationStatus[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => void setStatus(status)}
                      className={`rounded-full px-3 py-1.5 text-[11px] ${
                        active.status === status
                          ? "bg-white text-[#12111a]"
                          : "bg-white/8 text-white/55"
                      }`}
                    >
                      {STATUS_LABEL[status]}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSale(true)}
                    className="rounded-full bg-white px-3 py-1.5 text-[11px] text-[#12111a]"
                  >
                    Registrar venta
                  </button>
                </div>
              </header>

              <div className="flex-1 space-y-2 overflow-y-auto px-5 py-5">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-6 ${
                      message.direction === "out"
                        ? "ml-auto bg-white text-[#12111a]"
                        : "bg-white/8 text-[#f4f1ea]"
                    }`}
                  >
                    {message.text}
                  </div>
                ))}
              </div>

              <form
                className="flex gap-2 border-t border-white/8 p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void send();
                }}
              >
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Escribe un mensaje"
                  className="h-11 flex-1 rounded-full bg-white/8 px-4 text-[13px] outline-none"
                />
                <button
                  type="submit"
                  disabled={busy || !draft.trim()}
                  className="h-11 rounded-full bg-white px-5 text-[13px] text-[#12111a] disabled:opacity-40"
                >
                  Enviar
                </button>
              </form>
              {error ? <p className="px-5 pb-4 text-[12px] text-red-300">{error}</p> : null}
            </>
          ) : (
            <div className="grid flex-1 place-items-center px-8 text-center text-[14px] text-white/35">
              Elige un chat. Los anuncios de Meta llegan con la etiqueta Anuncio.
            </div>
          )}
        </section>
      </div>

      {sale && active ? (
        <ManualSaleForm
          authorizedFetch={authorizedFetch}
          onClose={() => setSale(false)}
          onCreated={() => {
            void loadList();
            if (activeId) void loadThread(activeId);
          }}
          initial={{
            firstName: active.name,
            phone: active.phone,
            notes: active.referral?.headline
              ? `WhatsApp / anuncio: ${active.referral.headline}`
              : "Venta WhatsApp",
            conversationId: active.id,
            channel: "whatsapp",
          }}
        />
      ) : null}
    </div>
  );
}
