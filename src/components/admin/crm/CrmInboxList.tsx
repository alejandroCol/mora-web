"use client";

import type { WhatsAppConversation } from "@/growth/types";
import { PIPELINE_LABEL, SUPPORT_STATUS_LABEL, followUpLabel, formatWhen } from "@/crm/labels";

type Filter = "all" | "mine" | "unassigned" | "unread" | "today" | "waiting" | "resolved";

export function CrmInboxList({
  conversations,
  activeId,
  query,
  filter,
  filters,
  hidden,
  onQuery,
  onFilter,
  onOpen,
  onClaim,
}: {
  conversations: WhatsAppConversation[];
  activeId: string | null;
  query: string;
  filter: Filter;
  filters: { id: Filter; label: string }[];
  hidden?: boolean;
  onQuery: (value: string) => void;
  onFilter: (value: Filter) => void;
  onOpen: (id: string) => void;
  onClaim: (id: string) => void;
}) {
  return (
    <aside className={`crm-list ${hidden ? "max-lg:hidden" : ""}`}>
      <div className="p-4 pb-2">
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Nombre, teléfono o mensaje"
          className="h-10 w-full rounded-full bg-white/8 px-4 text-[13px] outline-none"
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onFilter(item.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] ${
                filter === item.id ? "bg-[#1d1d1f] text-white" : "bg-white/8 text-white/50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <ul className="max-h-[28vh] overflow-y-auto lg:max-h-none lg:flex-1">
        {conversations.length === 0 ? (
          <li className="px-5 py-8 text-[13px] text-white/35">Nada en este filtro.</li>
        ) : (
          conversations.map((item) => {
            const on = item.id === activeId;
            const stage =
              (item.desk ?? "sales") === "support"
                ? SUPPORT_STATUS_LABEL[item.supportStatus ?? "open"]
                : PIPELINE_LABEL[item.status];
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpen(item.id)}
                  className={`flex w-full flex-col items-start gap-1 px-5 py-3 text-left ${
                    on ? "bg-white/10" : "hover:bg-white/4"
                  }`}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="truncate text-[14px]">{item.name || item.phone}</span>
                    <span className="shrink-0 text-[10px] text-white/30">
                      {formatWhen(item.lastAt)}
                    </span>
                  </span>
                  <span className="truncate text-[12px] text-white/40">{item.lastMessage}</span>
                  <span className="flex w-full flex-wrap items-center gap-1.5 text-[10px] text-white/30">
                    {item.unread > 0 ? (
                      <span className="rounded-full bg-[#1d1d1f] px-1.5 text-white">{item.unread}</span>
                    ) : null}
                    <span>{item.source === "ad" ? "Anuncio" : "Orgánico"}</span>
                    <span>· {stage}</span>
                    {item.assignedName ? <span>· {item.assignedName}</span> : (
                      <span
                        role="presentation"
                        onClick={(event) => {
                          event.stopPropagation();
                          onClaim(item.id);
                        }}
                        className="rounded-full bg-white/10 px-1.5 text-white/70"
                      >
                        Tomar
                      </span>
                    )}
                    {(item.nextFollowUpAt ?? 0) > 0 ? (
                      <span>· {followUpLabel(item.nextFollowUpAt!)}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
}
