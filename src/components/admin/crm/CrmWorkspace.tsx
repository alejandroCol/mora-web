"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  AbandonedCart,
  MoraOrder,
} from "@/commerce/types";
import type {
  CrmCounts,
  CrmDesk,
  CrmNote,
  CrmSeller,
  CrmSettings,
  MoraLead,
  WhatsAppConversation,
  WhatsAppMessage,
  WhatsAppUsageReport,
} from "@/growth/types";
import { DESK_LABEL } from "@/crm/labels";
import { useAdminAuth } from "../AdminAuth";
import { ManualSaleForm } from "../ManualSaleForm";
import { CrmBoard } from "./CrmBoard";
import { CrmComposer } from "./CrmComposer";
import { CrmContactPanel } from "./CrmContactPanel";
import { CrmInboxList } from "./CrmInboxList";
import { CrmSettingsPanel } from "./CrmSettings";
import { CrmThread } from "./CrmThread";
import { CrmUsagePanel } from "./CrmUsagePanel";

type Connection = {
  ready: boolean;
  displayNumber: string;
  webhook: string;
  welcome: boolean;
  webhookDebug?: {
    lastPostAt: number;
    lastIngestAt: number;
    lastMessageCount: number;
    lastFrom: string;
    lastError: string;
  };
};

type Filter = "all" | "mine" | "unassigned" | "unread" | "today" | "waiting" | "resolved";
type View = "inbox" | "board";
type Pane = "list" | "thread" | "ficha";

export type CrmContactState = {
  conversation: WhatsAppConversation | null;
  lead: MoraLead | null;
  orders: MoraOrder[];
  carts: AbandonedCart[];
  notes: CrmNote[];
  windowOpen: boolean;
  windowClosesAt: number | null;
};

const SALES_FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "mine", label: "Míos" },
  { id: "unassigned", label: "Sin dueño" },
  { id: "unread", label: "Sin leer" },
  { id: "today", label: "Seguir hoy" },
];

const SUPPORT_FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Abiertos" },
  { id: "waiting", label: "Esperando" },
  { id: "resolved", label: "Resueltos" },
  { id: "mine", label: "Míos" },
  { id: "unassigned", label: "Sin dueño" },
];

export function CrmWorkspace() {
  const { authorizedFetch, me } = useAdminAuth();
  const router = useRouter();
  const search = useSearchParams();
  const [desk, setDesk] = useState<CrmDesk>(
    search.get("desk") === "support" ? "support" : "sales",
  );
  const [view, setView] = useState<View>("inbox");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [pane, setPane] = useState<Pane>("list");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sale, setSale] = useState(false);
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [sellers, setSellers] = useState<CrmSeller[]>([]);
  const [settings, setSettings] = useState<CrmSettings | null>(null);
  const [counts, setCounts] = useState<CrmCounts>({
    unread: 0,
    unassigned: 0,
    followUpDue: 0,
    supportOpen: 0,
    mine: 0,
  });
  const [connection, setConnection] = useState<Connection | null>(null);
  const [usage, setUsage] = useState<WhatsAppUsageReport | null>(null);
  const [activeId, setActiveId] = useState<string | null>(search.get("c"));
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [contact, setContact] = useState<CrmContactState | null>(null);
  const [error, setError] = useState("");

  const loadWorkspace = useCallback(async () => {
    const res = await authorizedFetch("/api/admin/crm");
    const data = (await res.json()) as {
      ok?: boolean;
      conversations?: WhatsAppConversation[];
      sellers?: CrmSeller[];
      settings?: CrmSettings;
      counts?: CrmCounts;
      connection?: Connection;
      usage?: WhatsAppUsageReport;
    };
    if (!data.ok) return;
    setConversations(data.conversations ?? []);
    setSellers(data.sellers ?? []);
    setSettings(data.settings ?? null);
    if (data.counts) setCounts(data.counts);
    if (data.connection) setConnection(data.connection);
    if (data.usage) setUsage(data.usage);
  }, [authorizedFetch]);

  const loadThread = useCallback(
    async (id: string) => {
      const [threadRes, contactRes] = await Promise.all([
        authorizedFetch(`/api/admin/whatsapp/${id}`),
        authorizedFetch(`/api/admin/crm/contacts/${id}`),
      ]);
      const thread = (await threadRes.json()) as {
        ok?: boolean;
        conversation?: WhatsAppConversation;
        messages?: WhatsAppMessage[];
      };
      const dossier = (await contactRes.json()) as { ok?: boolean } & Partial<CrmContactState>;
      if (thread.ok) {
        setMessages(thread.messages ?? []);
        if (thread.conversation) {
          setConversations((current) =>
            current.map((item) => (item.id === id ? thread.conversation! : item)),
          );
        }
      }
      if (dossier.ok) {
        setContact({
          conversation: dossier.conversation ?? thread.conversation ?? null,
          lead: dossier.lead ?? null,
          orders: dossier.orders ?? [],
          carts: dossier.carts ?? [],
          notes: dossier.notes ?? [],
          windowOpen: Boolean(dossier.windowOpen),
          windowClosesAt: dossier.windowClosesAt ?? null,
        });
      }
      if ((thread.conversation?.unread ?? 0) > 0) {
        await authorizedFetch(`/api/admin/whatsapp/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ unread: 0 }),
        });
      }
    },
    [authorizedFetch],
  );

  useEffect(() => {
    const start = window.setTimeout(() => void loadWorkspace(), 0);
    const timer = window.setInterval(() => void loadWorkspace(), 8000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
  }, [loadWorkspace]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setContact(null);
      return;
    }
    const start = window.setTimeout(() => void loadThread(activeId), 0);
    const timer = window.setInterval(() => void loadThread(activeId), 6000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
  }, [activeId, loadThread]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const due = new Date();
    due.setHours(23, 59, 59, 999);
    return conversations.filter((item) => {
      const itemDesk = item.desk ?? "sales";
      if (itemDesk !== desk) return false;
      if (desk === "support") {
        const support = item.supportStatus ?? "open";
        if (filter === "all" && support === "resolved") return false;
        if (filter === "waiting" && support !== "waiting") return false;
        if (filter === "resolved" && support !== "resolved") return false;
      }
      if (filter === "mine" && item.assignedTo !== me?.uid) return false;
      if (filter === "unassigned" && item.assignedTo) return false;
      if (filter === "unread" && item.unread < 1) return false;
      if (filter === "today" && (!(item.nextFollowUpAt ?? 0) || (item.nextFollowUpAt ?? 0) > due.getTime())) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.phone.includes(q) ||
        item.lastMessage.toLowerCase().includes(q) ||
        (item.assignedName ?? "").toLowerCase().includes(q)
      );
    });
  }, [conversations, desk, filter, me?.uid, query]);

  const active = conversations.find((item) => item.id === activeId) ?? contact?.conversation ?? null;

  function openChat(id: string) {
    setActiveId(id);
    setPane("thread");
    setView("inbox");
    router.replace(`/superadmin/crm?c=${id}&desk=${desk}`, { scroll: false });
  }

  function switchDesk(next: CrmDesk) {
    setDesk(next);
    setFilter("all");
    router.replace(activeId ? `/superadmin/crm?c=${activeId}&desk=${next}` : `/superadmin/crm?desk=${next}`, {
      scroll: false,
    });
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setError("");
    const res = await authorizedFetch(`/api/admin/whatsapp/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      conversation?: WhatsAppConversation;
    };
    if (!data.ok) {
      setError(data.error ?? "No se pudo guardar.");
      return;
    }
    if (data.conversation) {
      setConversations((current) =>
        current.map((item) => (item.id === id ? data.conversation! : item)),
      );
      setContact((current) =>
        current ? { ...current, conversation: data.conversation! } : current,
      );
    }
    await loadWorkspace();
  }

  async function send(text: string) {
    if (!activeId) return;
    setError("");
    const res = await authorizedFetch(`/api/admin/whatsapp/${activeId}`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string; message?: WhatsAppMessage };
    if (!data.ok) {
      setError(data.error ?? "No se pudo enviar.");
      return;
    }
    if (data.message) setMessages((current) => [...current, data.message!]);
    await loadWorkspace();
    await loadThread(activeId);
  }

  async function sendTemplate(templateId: string) {
    if (!activeId) return;
    setError("");
    const first = active?.name?.split(" ")[0] ?? "";
    const res = await authorizedFetch(`/api/admin/whatsapp/${activeId}`, {
      method: "POST",
      body: JSON.stringify({ templateId, params: first ? [first] : [] }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string; message?: WhatsAppMessage };
    if (!data.ok) {
      setError(data.error ?? "WhatsApp no aceptó la plantilla.");
      return;
    }
    if (data.message) setMessages((current) => [...current, data.message!]);
    await loadWorkspace();
  }

  async function addNote(text: string) {
    if (!activeId) return;
    const res = await authorizedFetch("/api/admin/crm/notes", {
      method: "POST",
      body: JSON.stringify({ phone: activeId, text }),
    });
    const data = (await res.json()) as { ok?: boolean; note?: CrmNote };
    if (data.ok && data.note) {
      setContact((current) =>
        current ? { ...current, notes: [data.note!, ...current.notes] } : current,
      );
    }
  }

  const filters = desk === "support" ? SUPPORT_FILTERS : SALES_FILTERS;

  return (
    <div className="crm-app">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Casa</p>
          <h1 className="mt-2 font-display text-4xl tracking-[-0.05em] text-[#f4f1ea]">CRM.</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
            Un inbox para vender y otro para cuidar el pedido. Cada chat tiene dueño, nota y
            siguiente paso.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(DESK_LABEL) as CrmDesk[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => switchDesk(item)}
              className={`rounded-full px-3 py-1.5 text-[12px] ${
                desk === item ? "bg-[#1d1d1f] text-white" : "bg-white/8 text-white/55"
              }`}
            >
              {DESK_LABEL[item]}
              {item === "support" && counts.supportOpen > 0 ? ` ${counts.supportOpen}` : ""}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setView(view === "inbox" ? "board" : "inbox")}
            className="rounded-full bg-white/8 px-3 py-1.5 text-[12px] text-white/55"
          >
            {view === "inbox" ? "Tablero" : "Inbox"}
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-full bg-white/8 px-3 py-1.5 text-[12px] text-white/55"
          >
            Ajustes
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 text-[12px] text-white/45">
        <span>{counts.unread} sin leer</span>
        <span>·</span>
        <span>{counts.unassigned} sin dueño</span>
        <span>·</span>
        <span>{counts.followUpDue} seguir hoy</span>
        {connection && !connection.ready ? (
          <>
            <span>·</span>
            <button type="button" className="underline" onClick={() => setSettingsOpen(true)}>
              Conecta WhatsApp
            </button>
          </>
        ) : null}
      </div>

      {connection?.ready ? (
        <CrmUsagePanel usage={usage} webhookDebug={connection.webhookDebug} />
      ) : null}

      {view === "board" ? (
        <CrmBoard desk={desk} conversations={filtered} onOpen={openChat} />
      ) : (
        <div className={`crm-frame ${pane !== "list" ? "is-open" : ""}`}>
          <CrmInboxList
            conversations={filtered}
            activeId={activeId}
            query={query}
            filter={filter}
            filters={filters}
            hidden={pane !== "list"}
            onQuery={setQuery}
            onFilter={(value) => setFilter(value)}
            onOpen={openChat}
            onClaim={(id) => void patch(id, { assignedTo: me?.uid })}
          />
          <section className={`crm-thread ${pane === "list" ? "max-lg:hidden" : ""}`}>
            {active ? (
              <>
                <CrmThread
                  conversation={active}
                  messages={messages}
                  sellers={sellers}
                  meUid={me?.uid}
                  onBack={() => {
                    setPane("list");
                    setActiveId(null);
                    router.replace(`/superadmin/crm?desk=${desk}`, { scroll: false });
                  }}
                  onFicha={() => setPane(pane === "ficha" ? "thread" : "ficha")}
                  onPatch={(body) => void patch(active.id, body)}
                  onSale={() => setSale(true)}
                  authorizedFetch={authorizedFetch}
                />
                <CrmComposer
                  desk={desk}
                  settings={settings}
                  windowOpen={contact?.windowOpen ?? false}
                  windowClosesAt={contact?.windowClosesAt ?? null}
                  error={error}
                  onSend={(text) => void send(text)}
                  onTemplate={(id) => void sendTemplate(id)}
                />
              </>
            ) : (
              <div className="grid flex-1 place-items-center px-8 text-center text-[14px] text-white/35">
                {connection && !connection.ready
                  ? "Conecta la Cloud API en Ajustes. Los chats de anuncio llegan aquí."
                  : desk === "support"
                    ? "Elige un caso. Foto, pedido y guía viven en la ficha."
                    : "Elige un chat. Tómalo, escribe y registra la venta sin salir."}
              </div>
            )}
          </section>
          <CrmContactPanel
            open={pane === "ficha"}
            conversation={active}
            contact={contact}
            sellers={sellers}
            hidden={!active}
            onClose={() => setPane("thread")}
            onPatch={(body) => (active ? void patch(active.id, body) : undefined)}
            onNote={(text) => void addNote(text)}
            onSale={() => setSale(true)}
          />
        </div>
      )}

      {settingsOpen ? (
        <CrmSettingsPanel
          settings={settings}
          connection={connection}
          onClose={() => setSettingsOpen(false)}
          onSave={async (next) => {
            const res = await authorizedFetch("/api/admin/crm/settings", {
              method: "PUT",
              body: JSON.stringify(next),
            });
            const data = (await res.json()) as { ok?: boolean; settings?: CrmSettings };
            if (data.settings) setSettings(data.settings);
          }}
        />
      ) : null}

      {sale && active ? (
        <ManualSaleForm
          authorizedFetch={authorizedFetch}
          onClose={() => setSale(false)}
          onCreated={() => {
            setSale(false);
            void loadWorkspace();
            if (activeId) void loadThread(activeId);
          }}
          initial={{
            firstName: active.name,
            phone: active.phone,
            email: active.email || contact?.lead?.email,
            notes: active.referral?.headline
              ? `WhatsApp / anuncio: ${active.referral.headline}`
              : desk === "support"
                ? "Pedido desde soporte"
                : "Venta WhatsApp",
            conversationId: active.id,
            channel: "whatsapp",
          }}
        />
      ) : null}
    </div>
  );
}

