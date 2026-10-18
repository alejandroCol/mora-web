"use client";

import type { WhatsAppUsageReport } from "@/growth/types";
import { formatCop, formatUsd } from "@/crm/whatsappPricing";

export function CrmUsagePanel({ usage }: { usage: WhatsAppUsageReport | null }) {
  if (!usage) return null;

  const { freeAllowance, totals, byCategory } = usage;
  const serviceCap = freeAllowance.servicePerMonth;
  const servicePct = serviceCap
    ? Math.min(100, Math.round((freeAllowance.serviceUsed / serviceCap) * 100))
    : 0;

  return (
    <section className="crm-usage" aria-label="Costos estimados WhatsApp API">
      <div className="crm-usage-head">
        <div>
          <p className="crm-usage-kicker">WhatsApp Cloud API · {usage.monthLabel}</p>
          <p className="crm-usage-total">
            {formatUsd(totals.estimatedUsd)}
            <span className="crm-usage-cop">≈ {formatCop(totals.estimatedCop)}</span>
          </p>
          <p className="crm-usage-note">{usage.policyNote}</p>
        </div>
        <a
          href={usage.docUrl}
          target="_blank"
          rel="noreferrer"
          className="crm-usage-doc"
        >
          Tarifas Meta
        </a>
      </div>

      <div className="crm-usage-grid">
        <div className="crm-usage-card">
          <p className="crm-usage-label">Gratis · servicio (mes)</p>
          <p className="crm-usage-value">
            {freeAllowance.serviceUsed} / {serviceCap}
          </p>
          <div className="crm-usage-bar" role="progressbar" aria-valuenow={servicePct} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${servicePct}%` }} />
          </div>
          <p className="crm-usage-hint">
            {freeAllowance.serviceRemaining} restantes · desde {freeAllowance.serviceBillingEffectiveFrom}
          </p>
        </div>

        <div className="crm-usage-card">
          <p className="crm-usage-label">Entrantes</p>
          <p className="crm-usage-value">{totals.inbound}</p>
          <p className="crm-usage-hint">Meta no cobra por recibir.</p>
        </div>

        <div className="crm-usage-card">
          <p className="crm-usage-label">Salientes (estimados)</p>
          <p className="crm-usage-value">{totals.outboundDelivered}</p>
          <p className="crm-usage-hint">Entregados según Mora · Colombia {usage.rates.effectiveQuarter}</p>
        </div>
      </div>

      <ul className="crm-usage-breakdown">
        {byCategory.free_service_tier.count > 0 ? (
          <li>
            <span>Servicio (cupo gratis)</span>
            <span>{byCategory.free_service_tier.count}</span>
          </li>
        ) : null}
        {byCategory.free_ctwa.count > 0 ? (
          <li>
            <span>Anuncio · 72 h</span>
            <span>{byCategory.free_ctwa.count}</span>
          </li>
        ) : null}
        {byCategory.service.count > 0 ? (
          <li>
            <span>Servicio (de pago)</span>
            <span>
              {byCategory.service.count} · {formatUsd(byCategory.service.subtotalUsd)}
            </span>
          </li>
        ) : null}
        {byCategory.utility.count > 0 ? (
          <li>
            <span>Utilidad</span>
            <span>
              {byCategory.utility.count} · {formatUsd(byCategory.utility.subtotalUsd)}
            </span>
          </li>
        ) : null}
        {byCategory.marketing.count > 0 ? (
          <li>
            <span>Marketing</span>
            <span>
              {byCategory.marketing.count} · {formatUsd(byCategory.marketing.subtotalUsd)}
            </span>
          </li>
        ) : null}
        {byCategory.authentication.count > 0 ? (
          <li>
            <span>Autenticación</span>
            <span>
              {byCategory.authentication.count} · {formatUsd(byCategory.authentication.subtotalUsd)}
            </span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
