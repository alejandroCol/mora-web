"use client";

import type { WhatsAppConversation } from "@/growth/types";
import { INTEREST_LABEL, PIPELINE_LABEL, SUPPORT_STATUS_LABEL, followUpLabel, formatWhen, isSnoozed, needsReply } from "@/crm/labels";

type Filter = "all" | "mine" | "unassigned" | "unread" | "today" | "waiting" | "resolved" | "reply" | "snoozed";

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
    <aside className={`crm-list ${hidden ? "" : "is-open"}`}>
      <div className="crm-list-head">
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Nombre, teléfono o mensaje"
          className="crm-search"
        />
        <div className="crm-filters">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onFilter(item.id)}
              className={`crm-filter ${filter === item.id ? "is-on" : ""}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
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
                  className={`crm-row flex w-full flex-col items-start gap-1 px-5 py-3 text-left ${
                    on ? "is-on" : ""
                  } ${needsReply(item) ? "needs-you" : ""}`}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {item.pinned ? <span className="crm-pin">✦</span> : null}
                      <span className="truncate text-[14px]">{item.name || item.phone}</span>
                    </span>
                    <span className="shrink-0 text-[10px] text-white/30">
                      {formatWhen(item.lastAt)}
                    </span>
                  </span>
                  <span className="truncate text-[12px] text-white/40">{item.lastMessage}</span>
                  <span className="flex w-full flex-wrap items-center gap-1.5 text-[10px] text-white/30">
                    {item.unread > 0 ? (
                      <span className="rounded-full bg-[#1d1d1f] px-1.5 text-white">{item.unread}</span>
                    ) : null}
                    {needsReply(item) ? <span className="crm-dot">Te toca</span> : null}
                    {isSnoozed(item.snoozedUntil) ? <span>Dormido</span> : null}
                    {item.interest && item.interest !== "unknown" ? (
                      <span>{INTEREST_LABEL[item.interest]}</span>
                    ) : null}
                    <span>· {stage}</span>
                    {item.assignedName ? <span>· {item.assignedName}</span> : (
                      <span
                        role="presentation"
                        onClick={(event) => {
                          event.stopPropagation();
                          onClaim(item.id);
                        }}
                        className="crm-claim"
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
