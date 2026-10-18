"use client";

import { useState } from "react";
import Link from "next/link";
import { ORDER_STATUS_LABEL } from "@/commerce/labels";
import type { CrmLostReason } from "@/growth/types";
import { formatMoney } from "@/lib/catalog";
import type { CrmSeller, ProductInterest, SupportTopic, WhatsAppConversation } from "@/growth/types";
import {
  INTEREST_LABEL,
  LOST_REASON_LABEL,
  SUPPORT_TOPIC_LABEL,
  followUpLabel,
  formatDay,
  formatWhen,
} from "@/crm/labels";
import type { CrmContactState } from "./CrmWorkspace";

const INTERESTS = Object.keys(INTEREST_LABEL) as ProductInterest[];
const TOPICS = Object.keys(SUPPORT_TOPIC_LABEL) as SupportTopic[];

function later(days: number) {
  const date = new Date();
  if (days === 0) {
    date.setHours(23, 0, 0, 0);
    return date.getTime();
  }
  date.setDate(date.getDate() + days);
  date.setHours(10, 0, 0, 0);
  return date.getTime();
}

export function CrmContactPanel({
  open,
  conversation,
  contact,
  sellers,
  hidden,
  onClose,
  onPatch,
  onNote,
  onSale,
}: {
  open: boolean;
  conversation: WhatsAppConversation | null;
  contact: CrmContactState | null;
  sellers: CrmSeller[];
  hidden?: boolean;
  onClose: () => void;
  onPatch: (body: Record<string, unknown>) => void;
  onNote: (text: string) => void;
  onSale: () => void;
}) {
  const [note, setNote] = useState("");
  const [customDay, setCustomDay] = useState("");

  if (hidden || !conversation) return <aside className="crm-panel hidden" />;

  const support = (conversation.desk ?? "sales") === "support";
  const lastOrder = contact?.orders[0];

  return (
    <aside className={`crm-panel ${open ? "is-open" : ""}`}>
      <div className="flex items-center justify-between px-5 pt-5">
        <p className="text-[13px] text-white/45">Ficha</p>
        <button type="button" onClick={onClose} className="text-[12px] text-white/40 xl:hidden">
          Cerrar
        </button>
      </div>

      <div key={conversation.id} className="space-y-5 overflow-y-auto px-5 py-4">
        <div>
          <p className="text-[16px]">{conversation.name || "Sin nombre"}</p>
          <p className="text-[12px] text-white/40">+{conversation.phone}</p>
          {conversation.assignedName ? (
            <p className="mt-1 text-[12px] text-white/45">Dueño: {conversation.assignedName}</p>
          ) : (
            <p className="mt-1 text-[12px] text-white/35">Nadie lo tiene. Tómalo arriba.</p>
          )}
        </div>

        <label className="block">
          <span className="text-[11px] text-white/35">Nombre</span>
          <input
            defaultValue={conversation.name}
            onBlur={(event) => {
              const value = event.target.value.trim();
              if (value && value !== conversation.name) onPatch({ name: value });
            }}
            className="mt-1 h-10 w-full rounded-2xl bg-white/8 px-3 text-[13px] outline-none"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[11px] text-white/35">Ciudad</span>
            <input
              defaultValue={conversation.city ?? ""}
              onBlur={(event) => onPatch({ city: event.target.value })}
              className="mt-1 h-10 w-full rounded-2xl bg-white/8 px-3 text-[13px] outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-white/35">Correo</span>
            <input
              defaultValue={conversation.email ?? contact?.lead?.email ?? ""}
              onBlur={(event) => onPatch({ email: event.target.value })}
              className="mt-1 h-10 w-full rounded-2xl bg-white/8 px-3 text-[13px] outline-none"
            />
          </label>
        </div>

        <div>
          <p className="text-[11px] text-white/35">Interés</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {INTERESTS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onPatch({ interest: item })}
                className={`rounded-full px-2.5 py-1 text-[11px] ${
                  (conversation.interest ?? "unknown") === item
                    ? "bg-[#1d1d1f] text-white"
                    : "bg-white/8 text-white/50"
                }`}
              >
                {INTEREST_LABEL[item]}
              </button>
            ))}
          </div>
        </div>

        {support ? (
          <label className="block">
            <span className="text-[11px] text-white/35">Tema de soporte</span>
            <select
              value={conversation.supportTopic ?? "other"}
              onChange={(event) => onPatch({ supportTopic: event.target.value })}
              className="mt-1 h-10 w-full rounded-2xl bg-white/8 px-3 text-[13px] outline-none"
            >
              {TOPICS.map((topic) => (
                <option key={topic} value={topic}>
                  {SUPPORT_TOPIC_LABEL[topic]}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {conversation.status === "closed" ? (
          <div>
            <p className="text-[11px] text-white/35">Por qué se fue</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(Object.keys(LOST_REASON_LABEL) as CrmLostReason[]).map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => onPatch({ lostReason: reason })}
                  className={`rounded-full px-2.5 py-1 text-[11px] ${
                    conversation.lostReason === reason ? "bg-[#1d1d1f] text-white" : "bg-white/8 text-white/50"
                  }`}
                >
                  {LOST_REASON_LABEL[reason]}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <p className="text-[11px] text-white/35">
            Seguir{" "}
            {(conversation.nextFollowUpAt ?? 0) > 0
              ? `· ${followUpLabel(conversation.nextFollowUpAt!)}`
              : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              { label: "Hoy", at: later(0) },
              { label: "Mañana", at: later(1) },
              { label: "3 días", at: later(3) },
              { label: "Semana", at: later(7) },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onPatch({ nextFollowUpAt: item.at })}
                className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] text-white/55"
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onPatch({ nextFollowUpAt: null })}
              className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] text-white/40"
            >
              Quitar
            </button>
          </div>
          <input
            type="date"
            value={customDay}
            onChange={(event) => {
              setCustomDay(event.target.value);
              if (!event.target.value) return;
              const at = new Date(`${event.target.value}T10:00:00`).getTime();
              onPatch({ nextFollowUpAt: at });
            }}
            className="mt-2 h-10 w-full rounded-2xl bg-white/8 px-3 text-[13px] outline-none"
          />
        </div>

        <div>
          <p className="text-[11px] text-white/35">Nota interna</p>
          <form
            className="mt-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!note.trim()) return;
              onNote(note.trim());
              setNote("");
            }}
          >
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="Lo que no cabe en el chat: talla, objeción, ciudad."
              className="w-full rounded-2xl bg-white/8 p-3 text-[13px] outline-none"
            />
            <button
              type="submit"
              disabled={!note.trim()}
              className="mt-2 h-9 rounded-full bg-white px-4 text-[12px] text-[#12111a] disabled:opacity-40"
            >
              Guardar nota
            </button>
          </form>
          <ul className="mt-3 space-y-2">
            {(contact?.notes ?? []).map((item) => (
              <li key={item.id} className="rounded-2xl bg-white/6 px-3 py-2">
                <p className="text-[12px] leading-5">{item.text}</p>
                <p className="mt-1 text-[10px] text-white/30">
                  {item.byName} · {formatWhen(item.at)}
                  {item.kind === "system" ? " · sistema" : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-white/35">Pedidos</p>
            <Link href="/superadmin/ventas" className="text-[11px] text-white/40">
              Ventas
            </Link>
          </div>
          {contact?.orders.length ? (
            <ul className="mt-2 space-y-2">
              {contact.orders.map((order) => (
                <li key={order.id} className="rounded-2xl bg-white/6 px-3 py-2 text-[12px]">
                  <p>
                    {order.orderNumber} · {ORDER_STATUS_LABEL[order.status]}
                  </p>
                  <p className="text-white/40">
                    {formatMoney(order.totals.total)} · {formatDay(order.createdAt)}
                  </p>
                  {order.shipping.trackingNumber ? (
                    <p className="text-white/40">Guía {order.shipping.trackingNumber}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[12px] text-white/35">Aún no hay pedido.</p>
          )}
          {lastOrder ? null : (
            <button
              type="button"
              onClick={onSale}
              className="mt-3 h-9 rounded-full bg-[#1d1d1f] px-4 text-[12px] text-white"
            >
              Registrar venta
            </button>
          )}
        </div>

        {contact?.carts.length ? (
          <div>
            <p className="text-[11px] text-white/35">Carrito abandonado</p>
            <p className="mt-2 text-[12px] leading-5 text-white/55">
              Dejó {contact.carts[0].items.length} anillo(s) en la web.{" "}
              {formatMoney(contact.carts[0].subtotal)}.
            </p>
          </div>
        ) : null}

        {conversation.attribution?.utmCampaign ? (
          <p className="text-[12px] text-white/35">
            Campaña {conversation.attribution.utmCampaign}
          </p>
        ) : null}

        <p className="pb-4 text-[11px] text-white/25">
          {sellers.length} en el equipo. El chat y el pedido viven en la misma persona.
        </p>
      </div>
    </aside>
  );
}
