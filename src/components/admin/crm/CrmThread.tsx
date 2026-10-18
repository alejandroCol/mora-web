"use client";

import { useEffect, useRef, useState } from "react";
import type { CrmSeller, WhatsAppConversation, WhatsAppConversationStatus, WhatsAppMessage } from "@/growth/types";
import { PIPELINE_LABEL, SUPPORT_STATUS_LABEL } from "@/crm/labels";
import { formatClock } from "@/crm/labels";

export function CrmThread({
  conversation,
  messages,
  sellers,
  meUid,
  onBack,
  onFicha,
  onPatch,
  onSale,
  authorizedFetch,
}: {
  conversation: WhatsAppConversation;
  messages: WhatsAppMessage[];
  sellers: CrmSeller[];
  meUid?: string;
  onBack: () => void;
  onFicha: () => void;
  onPatch: (body: Record<string, unknown>) => void;
  onSale: () => void;
  authorizedFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const support = (conversation.desk ?? "sales") === "support";

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length, conversation.id]);

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-3 lg:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <button type="button" onClick={onBack} className="text-[12px] text-white/40 lg:hidden">
              Inbox
            </button>
            <p className="truncate text-[15px]">{conversation.name || conversation.phone}</p>
          </div>
          <p className="text-[12px] text-white/40">+{conversation.phone}</p>
          {conversation.referral?.headline ? (
            <p className="mt-1 text-[12px] text-white/50">Anuncio: {conversation.referral.headline}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={conversation.assignedTo || ""}
            onChange={(event) =>
              onPatch({ assignedTo: event.target.value || null })
            }
            className="h-8 rounded-full bg-white/8 px-3 text-[11px] outline-none"
          >
            <option value="">Sin dueño</option>
            {sellers.map((seller) => (
              <option key={seller.uid} value={seller.uid}>
                {seller.uid === meUid ? `Yo · ${seller.name}` : seller.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onPatch({ desk: support ? "sales" : "support" })}
            className="rounded-full bg-white/8 px-3 py-1.5 text-[11px] text-white/55"
          >
            {support ? "A ventas" : "A soporte"}
          </button>
          <button
            type="button"
            onClick={onFicha}
            className="rounded-full bg-white/8 px-3 py-1.5 text-[11px] text-white/55 xl:hidden"
          >
            Ficha
          </button>
          <button
            type="button"
            onClick={onSale}
            className="rounded-full bg-white px-3 py-1.5 text-[11px] text-[#12111a]"
          >
            Registrar venta
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5 border-b border-white/8 px-4 py-2 lg:px-5">
        {support
          ? (["open", "waiting", "resolved"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => onPatch({ supportStatus: status })}
                className={`rounded-full px-3 py-1 text-[11px] ${
                  (conversation.supportStatus ?? "open") === status
                    ? "bg-white text-[#12111a]"
                    : "bg-white/8 text-white/55"
                }`}
              >
                {SUPPORT_STATUS_LABEL[status]}
              </button>
            ))
          : (Object.keys(PIPELINE_LABEL) as WhatsAppConversationStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => onPatch({ status })}
                className={`rounded-full px-3 py-1 text-[11px] ${
                  conversation.status === status
                    ? "bg-white text-[#12111a]"
                    : "bg-white/8 text-white/55"
                }`}
              >
                {PIPELINE_LABEL[status]}
              </button>
            ))}
      </div>

      <div ref={scroller} className="crm-scroll flex-1 space-y-2 overflow-y-auto px-4 py-5 lg:px-5">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[82%] rounded-2xl px-3 py-2 text-[13px] leading-6 ${
              message.direction === "out" ? "admin-bubble-out ml-auto" : "admin-bubble-in"
            }`}
          >
            {message.mediaId && message.type === "image" ? (
              <MediaBubble mediaId={message.mediaId} authorizedFetch={authorizedFetch} />
            ) : null}
            {message.text ? <p>{message.text}</p> : null}
            <p className={`mt-1 text-[10px] ${message.direction === "out" ? "text-white/50" : "text-white/35"}`}>
              {formatClock(message.at)}
              {message.status && message.direction === "out" ? ` · ${message.status}` : ""}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

function MediaBubble({
  mediaId,
  authorizedFetch,
}: {
  mediaId: string;
  authorizedFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
}) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let url = "";
    void authorizedFetch(`/api/admin/whatsapp/media/${mediaId}`)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!blob) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [authorizedFetch, mediaId]);

  if (!src) return <p className="text-white/40">[foto]</p>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="mb-2 max-h-64 w-full rounded-xl object-cover" />
  );
}
