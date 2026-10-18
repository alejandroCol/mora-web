"use client";

import type { CrmDesk, SupportStatus, WhatsAppConversation, WhatsAppConversationStatus } from "@/growth/types";
import { PIPELINE_LABEL, SUPPORT_STATUS_LABEL, formatWhen } from "@/crm/labels";

const SALES: WhatsAppConversationStatus[] = ["new", "interested", "quoted", "sold", "closed"];
const SUPPORT: SupportStatus[] = ["open", "waiting", "resolved"];

export function CrmBoard({
  desk,
  conversations,
  onOpen,
}: {
  desk: CrmDesk;
  conversations: WhatsAppConversation[];
  onOpen: (id: string) => void;
}) {
  const columns =
    desk === "support"
      ? SUPPORT.map((status) => ({
          id: status,
          label: SUPPORT_STATUS_LABEL[status],
          items: conversations.filter((item) => (item.supportStatus ?? "open") === status),
        }))
      : SALES.map((status) => ({
          id: status,
          label: PIPELINE_LABEL[status],
          items: conversations.filter((item) => item.status === status),
        }));

  return (
    <div className="crm-board">
      {columns.map((column) => (
        <section key={column.id} className="crm-column">
          <header className="flex items-baseline justify-between px-1 pb-3">
            <h2 className="text-[13px]">{column.label}</h2>
            <span className="text-[11px] text-white/35">{column.items.length}</span>
          </header>
          <ul className="space-y-2">
            {column.items.length === 0 ? (
              <li className="rounded-2xl bg-white/6 px-3 py-6 text-[12px] text-white/30">Vacío</li>
            ) : (
              column.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(item.id)}
                    className="w-full rounded-2xl bg-white px-3 py-3 text-left shadow-[var(--admin-shadow)]"
                  >
                    <p className="truncate text-[13px]">{item.name || item.phone}</p>
                    <p className="mt-1 truncate text-[12px] text-white/40">{item.lastMessage}</p>
                    <p className="mt-2 text-[10px] text-white/30">
                      {item.assignedName || "Sin dueño"} · {formatWhen(item.lastAt)}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
