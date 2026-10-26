"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconClose } from "@/components/icons/NavIcons";
import { shouldSuggestCase } from "@/commerce/lines";
import { insightCaseOffer, insightProductCart } from "@/insights/client";
import {
  CASE_COLOR_LIST,
  CASE_PRODUCT,
  caseColor,
  caseFromCheckoutPath,
  type CaseColorId,
} from "@/lib/cases";
import { formatMoney } from "@/lib/catalog";
import { useMoraStore } from "@/lib/store";

const SEEN_KEY = "mora-case-offer-seen";
const HIDE_KEY = "mora-case-offer-hide";

function flag(key: string) {
  return typeof window !== "undefined" && sessionStorage.getItem(key) === "1";
}

function mark(key: string) {
  sessionStorage.setItem(key, "1");
}

export function hideCaseOffer() {
  mark(HIDE_KEY);
}

export function CaseOffer() {
  const router = useRouter();
  const cart = useMoraStore((state) => state.cart);
  const addCaseToCart = useMoraStore((state) => state.addCaseToCart);
  const [colorId, setColorId] = useState<CaseColorId>(CASE_PRODUCT.colors[0]);
  const [open, setOpen] = useState(false);
  const color = caseColor(colorId);

  useEffect(() => {
    const allowed = shouldSuggestCase(cart) && !flag(HIDE_KEY);
    setOpen(allowed);
    if (!allowed || flag(SEEN_KEY)) return;
    mark(SEEN_KEY);
    insightCaseOffer("shown");
  }, [cart]);

  if (!open) return null;

  function dismiss() {
    mark(HIDE_KEY);
    setOpen(false);
    insightCaseOffer("dismiss");
  }

  function add() {
    mark(HIDE_KEY);
    addCaseToCart(colorId);
    setOpen(false);
    insightCaseOffer("add");
    insightProductCart(CASE_PRODUCT.id, CASE_PRODUCT.name);
  }

  function openDetail() {
    router.push(caseFromCheckoutPath(colorId));
  }

  return (
    <aside className="case-offer" aria-label="Agregar un Case">
      <button
        type="button"
        className="case-offer-close"
        onClick={(event) => {
          event.stopPropagation();
          dismiss();
        }}
        aria-label="Cerrar"
      >
        <IconClose className="h-3 w-3" />
      </button>
      <button type="button" className="case-offer-hit" onClick={openDetail}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={color.src} alt="" className="case-offer-photo" />
        <span className="case-offer-body">
          <span className="case-offer-title">Agrega un Case a tu pedido</span>
          <span className="case-offer-meta">{formatMoney(CASE_PRODUCT.price)}</span>
        </span>
      </button>
      <div className="case-offer-dots" role="group" aria-label="Color">
        {CASE_COLOR_LIST.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-label={item.title}
            aria-pressed={item.id === colorId}
            className={`case-offer-dot ${item.id === colorId ? "on" : ""}`}
            style={{ background: item.swatch }}
            onClick={() => setColorId(item.id)}
          />
        ))}
      </div>
      <button type="button" className="case-offer-add" onClick={add}>
        Agregar
      </button>
    </aside>
  );
}

export function noteCaseOfferPay() {
  if (flag(SEEN_KEY)) insightCaseOffer("pay");
}
