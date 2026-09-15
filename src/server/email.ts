import { BRAND, absoluteBrandUrl, brandLockup } from "@/brand";
import { formatMoney } from "@/lib/catalog";
import { PAYMENT_METHOD_LABEL } from "@/commerce/labels";
import type { MoraOrder } from "@/commerce/types";
import { formatoDepartamentoEtiqueta } from "@/lib/colombiaGeo";

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

const INK = "#16141f";
const PAPER = "#fbfbfd";
const DAWN = "#f4f3f8";
const SOFT = "#6a6580";

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://mora.ring"
  );
}

export function orderTrackingUrl(orderNumber: string) {
  return `${siteUrl()}/pedido/${encodeURIComponent(orderNumber)}`;
}

function button(href: string, label: string) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${INK};color:#fff;text-decoration:none;font-size:14px;letter-spacing:0.02em;padding:14px 26px;border-radius:999px">${escapeHtml(label)}</a>`;
}

function itemRows(order: MoraOrder) {
  return order.items
    .map((item) => {
      const label = `${item.name} · ${item.finishTitle} · #${item.size}`;
      return `<tr>
        <td style="padding:12px 0;border-bottom:1px solid rgba(22,20,31,0.08);font-size:14px;color:${INK}">${escapeHtml(label)} <span style="color:${SOFT}">×${item.qty}</span></td>
        <td style="padding:12px 0;border-bottom:1px solid rgba(22,20,31,0.08);font-size:14px;text-align:right;white-space:nowrap">${formatMoney(item.unitPrice * item.qty)}</td>
      </tr>`;
    })
    .join("");
}

function shell(opts: {
  kicker: string;
  title: string;
  intro: string;
  body: string;
  cta?: string;
}) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:${DAWN}">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${DAWN};padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${PAPER};border-radius:24px;overflow:hidden;border:1px solid rgba(22,20,31,0.08)">
          <tr>
            <td style="padding:28px 28px 8px;color:${INK};font-family:Georgia,'Times New Roman',serif">
              <img src="${absoluteBrandUrl("wordmark")}" alt="${escapeHtml(BRAND.name)}" width="148" height="47" style="display:block;border:0;height:auto;max-width:148px" />
              <div style="margin-top:22px;font-family:ui-sans-serif,system-ui,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${SOFT}">${escapeHtml(opts.kicker)}</div>
              <h1 style="margin:12px 0 0;font-size:32px;line-height:1.05;font-weight:400;letter-spacing:-0.03em">${escapeHtml(opts.title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 32px;color:${INK};font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6">
              <p style="margin:0 0 20px;color:${SOFT}">${opts.intro}</p>
              ${opts.body}
              ${opts.cta ? `<div style="margin:28px 0 8px">${opts.cta}</div>` : ""}
              <p style="margin:28px 0 0;padding-top:18px;border-top:1px solid rgba(22,20,31,0.08);font-size:12px;color:${SOFT}">${escapeHtml(brandLockup())}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function orderBody(order: MoraOrder, extra?: string) {
  const depto = formatoDepartamentoEtiqueta(order.shipping.departamento);
  const guia = order.shipping.trackingNumber?.trim();
  return `
    <table role="presentation" width="100%" style="background:${DAWN};border-radius:16px">
      <tr>
        <td style="padding:16px 18px">
          <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${SOFT}">Número de pedido</div>
          <div style="margin-top:6px;font-size:22px;letter-spacing:0.04em;font-weight:600">${escapeHtml(order.orderNumber)}</div>
          ${
            guia
              ? `<div style="margin-top:12px;font-size:13px;color:${SOFT}">Guía · <strong style="color:${INK}">${escapeHtml(guia)}</strong></div>`
              : ""
          }
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" style="margin-top:18px">${itemRows(order)}</table>
    <table role="presentation" width="100%" style="margin-top:8px;font-size:14px">
      <tr><td style="padding:6px 0;color:${SOFT}">Anillos</td><td style="text-align:right">${formatMoney(order.totals.subtotal)}</td></tr>
      <tr><td style="padding:6px 0;color:${SOFT}">Envío${order.shipping.carrierLabel ? ` · ${escapeHtml(order.shipping.carrierLabel)}` : ""}</td><td style="text-align:right">${order.totals.shipping === 0 ? "Gratis" : formatMoney(order.totals.shipping)}</td></tr>
      <tr><td style="padding-top:12px;border-top:1px solid ${INK};font-weight:600">Total</td><td style="padding-top:12px;border-top:1px solid ${INK};text-align:right;font-weight:600">${formatMoney(order.totals.total)}</td></tr>
    </table>
    <p style="margin:18px 0 0;font-size:13px;color:${SOFT}">
      ${escapeHtml(order.customer.firstName)} · ${escapeHtml(order.shipping.ciudad)}${depto ? `, ${escapeHtml(depto)}` : ""}<br />
      ${escapeHtml(order.shipping.direccion)}
    </p>
    ${extra ?? ""}
  `;
}

async function sendResend(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim() || `${BRAND.name} <hola@mora.ring>`;
  if (!key) {
    console.warn("[email] RESEND_API_KEY ausente; no se envió", subject, to);
    return { ok: false as const, error: "missing_resend" };
  }
  if (!looksLikeEmail(to)) return { ok: false as const, error: "invalid_email" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to.trim()], subject, html }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false as const, error: text.slice(0, 300) };
  }
  return { ok: true as const };
}

export async function sendPaidCustomerEmail(order: MoraOrder) {
  const html = shell({
    kicker: BRAND.name,
    title: "Tu pedido quedó.",
    intro: `Hola ${escapeHtml(order.customer.firstName || "")}. El pago se confirmó. Guardá el número de pedido para seguir cada paso.`,
    body: orderBody(order),
    cta: button(orderTrackingUrl(order.orderNumber), "Ver mi pedido"),
  });
  return sendResend(
    order.customer.email,
    `Pedido ${order.orderNumber} · ${BRAND.name}`,
    html,
  );
}

export async function sendDispatchedCustomerEmail(order: MoraOrder) {
  const guia = order.shipping.trackingNumber?.trim();
  const extra = guia
    ? `<p style="margin:16px 0 0;font-size:14px">Tu guía es <strong>${escapeHtml(guia)}</strong>${order.shipping.carrierLabel ? ` con ${escapeHtml(order.shipping.carrierLabel)}` : ""}.</p>`
    : "";
  const html = shell({
    kicker: "En camino",
    title: "Tu anillo salió.",
    intro: `Pedido ${escapeHtml(order.orderNumber)} ya va hacia ${escapeHtml(order.shipping.ciudad)}.`,
    body: orderBody(order, extra),
    cta: button(orderTrackingUrl(order.orderNumber), "Ver mi pedido"),
  });
  return sendResend(
    order.customer.email,
    `En camino ${order.orderNumber}${guia ? ` · guía ${guia}` : ""} · ${BRAND.name}`,
    html,
  );
}

export async function sendPaidStaffEmail(order: MoraOrder) {
  const to = process.env.MORA_SALES_EMAIL?.trim();
  if (!to) return { ok: false as const, error: "missing_staff_email" };
  const html = shell({
    kicker: "Atelier",
    title: "Entró una venta.",
    intro: `${escapeHtml(PAYMENT_METHOD_LABEL[order.payment.method])} · ${formatMoney(order.totals.total)}`,
    body: orderBody(
      order,
      `<p style="margin:16px 0 0;font-size:13px;color:${SOFT}">${escapeHtml(order.customer.email)} · ${escapeHtml(order.customer.phone)}</p>`,
    ),
    cta: button(`${siteUrl()}/superadmin/ventas`, "Abrir ventas"),
  });
  return sendResend(to, `Venta ${order.orderNumber} · ${BRAND.name}`, html);
}
