"use client";

import type { CheckoutNotice as CheckoutNoticeModel } from "./checkoutNotice";

export function CheckoutNotice({
  notice,
  onFix,
  onDismiss,
}: {
  notice: CheckoutNoticeModel;
  onFix: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="check-notice-wrap" role="presentation">
      <div className="check-notice" role="alert" aria-live="polite">
        <p className="check-notice-text">{notice.message}</p>
        <div className="check-notice-actions">
          {notice.action ? (
            <button type="button" className="check-notice-primary" onClick={onFix}>
              {notice.action.label}
            </button>
          ) : null}
          <button type="button" className="check-notice-dismiss" onClick={onDismiss} aria-label="Cerrar">
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
