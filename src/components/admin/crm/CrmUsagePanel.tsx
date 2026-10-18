"use client";

import type { WhatsAppUsageReport } from "@/growth/types";
import { formatCop, formatUsd } from "@/crm/whatsappPricing";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="crm-meter">
      <p className="crm-meter-label">{label}</p>
      <p className="crm-meter-value">{value}</p>
    </div>
  );
}

export function CrmUsagePanel({ usage }: { usage: WhatsAppUsageReport | null }) {
  if (!usage) return null;

  const { freeAllowance, totals, byCategory } = usage;
  const cap = freeAllowance.servicePerMonth;
  const used = freeAllowance.serviceUsed;
  const pct = cap ? Math.min(100, (used / cap) * 100) : 0;
  const extras = [
    byCategory.marketing.count ? `${byCategory.marketing.count} marketing` : "",
    byCategory.utility.count ? `${byCategory.utility.count} utilidad` : "",
    byCategory.authentication.count ? `${byCategory.authentication.count} auth` : "",
    byCategory.free_ctwa.count ? `${byCategory.free_ctwa.count} anuncio` : "",
  ].filter(Boolean);

  return (
    <section className="crm-meter-row" aria-label="Uso WhatsApp este mes">
      <Metric label="Estimado" value={`${formatUsd(totals.estimatedUsd)} · ${formatCop(totals.estimatedCop)}`} />
      <Metric label="Gratis" value={`${used.toLocaleString("es-CO")} / ${cap.toLocaleString("es-CO")}`} />
      <Metric label="Entrantes" value={String(totals.inbound)} />
      <Metric label="Salientes" value={String(totals.outboundDelivered)} />
      <div className="crm-meter crm-meter-bar">
        <p className="crm-meter-label">Cupo de servicio</p>
        <div
          className="crm-meter-track"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${Math.max(pct, used ? 4 : 0)}%` }} />
        </div>
        <p className="crm-meter-foot">
          {extras.length ? extras.join(" · ") : `${freeAllowance.serviceRemaining.toLocaleString("es-CO")} restantes`}
        </p>
      </div>
    </section>
  );
}
