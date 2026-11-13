"use client";

import { useEffect, useRef, useState } from "react";
import type { CrmChannel, WhatsAppConversation } from "@/growth/types";
import { CHANNEL_LABEL, channelOf, conversationTitle } from "@/crm/channel";
import { INTEREST_LABEL, PIPELINE_LABEL, SUPPORT_STATUS_LABEL, followUpLabel, formatWhen, isSnoozed, needsReply } from "@/crm/labels";
import { cameFromAd, referralKindLabel, referralTitle } from "@/crm/referral";

type Filter = "all" | "mine" | "unassigned" | "unread" | "today" | "waiting" | "resolved" | "reply" | "snoozed";
export type ChannelFilter = "all" | CrmChannel;

const CHANNEL_FILTERS: { id: ChannelFilter; label: string }[] = [
  { id: "all", label: "Todo" },
  { id: "whatsapp", label: CHANNEL_LABEL.whatsapp },
  { id: "instagram", label: CHANNEL_LABEL.instagram },
];

export function CrmInboxList({
  conversations,
  loading,
  pageKey,
  activeId,
  query,
  filter,
  filters,
  channel,
  showChannels,
  hidden,
  onQuery,
  onFilter,
  onChannel,
  onOpen,
  onClaim,
}: {
  conversations: WhatsAppConversation[];
  loading: boolean;
  /** Cambia con filtro, canal o búsqueda: la paginación vuelve a la primera página. */
  pageKey: string;
  activeId: string | null;
  query: string;
  filter: Filter;
  filters: { id: Filter; label: string }[];
  channel: ChannelFilter;
  /** Solo cuando ya hay chats de los dos canales: con uno solo el selector sobra. */
  showChannels: boolean;
  hidden?: boolean;
  onQuery: (value: string) => void;
  onFilter: (value: Filter) => void;
  onChannel: (value: ChannelFilter) => void;
  onOpen: (id: string) => void;
  onClaim: (id: string) => void;
}) {
  return (
    <aside className={`crm-list ${hidden ? "" : "is-open"}`}>
      <div className="crm-list-head">
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={showChannels ? "Nombre, teléfono, @usuario o mensaje" : "Nombre, teléfono o mensaje"}
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
        {showChannels ? (
          <div className="crm-channels" role="group" aria-label="Canal">
            {CHANNEL_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onChannel(item.id)}
                className={`crm-channel-tab ${channel === item.id ? "is-on" : ""}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {loading ? (
        <ul className="min-h-0 flex-1 overflow-hidden" aria-busy="true" aria-label="Cargando chats">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="crm-skeleton-row">
              <span className="crm-skeleton" style={{ width: `${48 + ((i * 17) % 30)}%` }} />
              <span className="crm-skeleton" style={{ width: `${70 + ((i * 11) % 22)}%` }} />
              <span className="crm-skeleton is-short" />
            </li>
          ))}
        </ul>
      ) : (
        <CrmInboxRows key={pageKey} conversations={conversations} activeId={activeId} onOpen={onOpen} onClaim={onClaim} />
      )}
    </aside>
  );
}

const PAGE = 40;

function CrmInboxRows({
  conversations,
  activeId,
  onOpen,
  onClaim,
}: {
  conversations: WhatsAppConversation[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onClaim: (id: string) => void;
}) {
  const [limit, setLimit] = useState(PAGE);
  const more = useRef<HTMLLIElement>(null);
  const hasMore = conversations.length > limit;

  useEffect(() => {
    const node = more.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setLimit((current) => current + PAGE);
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, limit]);

  return (
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <li className="px-5 py-8 text-[13px] text-white/35">Nada en este filtro.</li>
        ) : (
          conversations.slice(0, limit).map((item) => {
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
                      <span className="truncate text-[14px]">{conversationTitle(item)}</span>
                      {channelOf(item) === "instagram" ? (
                        <span className="crm-channel-badge" title="Chat de Instagram">
                          IG
                        </span>
                      ) : null}
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
                    {cameFromAd(item) ? (
                      <span className="crm-ad-badge" title={item.referral ? referralTitle(item.referral) : "Entró por anuncio"}>
                        {referralKindLabel(item.referral)}
                      </span>
                    ) : null}
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
        {hasMore ? (
          <li ref={more} className="px-5 py-4 text-center text-[11px] text-white/30">
            {conversations.length - limit} más
          </li>
        ) : null}
      </ul>
  );
}
