"use client";

import { useEffect } from "react";
import type { CheckoutNotice as CheckoutNoticeModel } from "./checkoutNotice";

function dialogTitle(notice: CheckoutNoticeModel) {
  switch (notice.action?.field) {
    case "phone":
      return "Tu celular";
    case "document":
      return "Tu documento";
    case "email":
      return "Tu correo";
    case "shipping":
      return "Tu envío";
    default:
      return "Antes de continuar";
  }
}

export function CheckoutNotice({
  notice,
  onFix,
  onDismiss,
}: {
  notice: CheckoutNoticeModel;
  onFix: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="check-dialog" role="dialog" aria-modal="true" aria-labelledby="check-dialog-title">
      <button type="button" className="check-dialog-dim" onClick={onDismiss} aria-label="Cerrar" />
      <div className="check-dialog-card">
        <button type="button" className="check-dialog-x" onClick={onDismiss} aria-label="Cerrar">
          ×
        </button>
        <p className="check-dialog-kicker">Checkout</p>
        <h2 id="check-dialog-title" className="check-dialog-title">
          {dialogTitle(notice)}
        </h2>
        <p className="check-dialog-body">{notice.message}</p>
        <div className="check-dialog-actions">
          {notice.action ? (
            <button type="button" className="check-dialog-primary" onClick={onFix}>
              {notice.action.label}
            </button>
          ) : null}
          <button type="button" className="check-dialog-secondary" onClick={onDismiss}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
