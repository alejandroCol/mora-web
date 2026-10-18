"use client";

import { useEffect, useRef, useState } from "react";
import type { CrmSeller, WhatsAppConversation, WhatsAppConversationStatus, WhatsAppMessage } from "@/growth/types";
import { PIPELINE_LABEL, SUPPORT_STATUS_LABEL } from "@/crm/labels";
import { formatClock } from "@/crm/labels";

function initial(name: string, phone: string) {
  const source = name.trim() || phone;
  return source.slice(0, 1).toUpperCase();
}

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
      <header className="crm-chat-head">
        <div className="crm-chat-who">
          <button type="button" onClick={onBack} className="crm-chat-back lg:hidden">
            Inbox
          </button>
          <span className="crm-chat-mark" aria-hidden>
            {initial(conversation.name, conversation.phone)}
          </span>
          <div className="min-w-0">
            <p className="crm-chat-name">{conversation.name || conversation.phone}</p>
            <p className="crm-chat-phone">+{conversation.phone}</p>
          </div>
        </div>
        <div className="crm-chat-tools">
          <select
            value={conversation.assignedTo || ""}
            onChange={(event) => onPatch({ assignedTo: event.target.value || null })}
            className="crm-chat-select"
          >
            <option value="">Sin dueño</option>
            {sellers.map((seller) => (
              <option key={seller.uid} value={seller.uid}>
                {seller.uid === meUid ? `Yo · ${seller.name}` : seller.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => onPatch({ desk: support ? "sales" : "support" })} className="crm-chat-chip">
            {support ? "Ventas" : "Soporte"}
          </button>
          <button type="button" onClick={onFicha} className="crm-chat-chip xl:hidden">
            Ficha
          </button>
          <button type="button" onClick={onSale} className="crm-chat-sale">
            Venta
          </button>
        </div>
        <div className="crm-chat-pipe">
          {support
            ? (["open", "waiting", "resolved"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => onPatch({ supportStatus: status })}
                  className={`crm-pipe ${(conversation.supportStatus ?? "open") === status ? "is-on" : ""}`}
                >
                  {SUPPORT_STATUS_LABEL[status]}
                </button>
              ))
            : (Object.keys(PIPELINE_LABEL) as WhatsAppConversationStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => onPatch({ status })}
                  className={`crm-pipe ${conversation.status === status ? "is-on" : ""}`}
                >
                  {PIPELINE_LABEL[status]}
                </button>
              ))}
        </div>
      </header>

      <div ref={scroller} className="crm-scroll flex-1 space-y-2 overflow-y-auto px-4 py-3 lg:px-5">
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
