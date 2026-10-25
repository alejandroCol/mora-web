import { BRAND } from "@/brand";
import { commerceLineLabel, orderNeedsSize, tallaPath } from "@/commerce/sizing";
import { finishLabel, formatMoney, products } from "@/lib/catalog";
import { PAYMENT_METHOD_LABEL } from "@/commerce/labels";
import { getSalesPresentation } from "./salesPolicy";
import type { AbandonedCart, MoraOrder } from "@/commerce/types";
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

const INK = "#111111";
const WHITE = "#ffffff";
const BLACK = "#0a0a0a";
const MIST = "#f3f3f3";
const LINE = "#e6e6e6";
const SOFT = "#5c5c5c";
const FROM_DEFAULT = "Mora <no-responder@moraring.com>";
const LOGO = "https://moraring.com/brand/wordmark.png";
const MARK = "https://moraring.com/brand/mark.png";

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://moraring.com"
  );
}

export function orderTrackingUrl(orderNumber: string) {
  return `${siteUrl()}/pedido/${encodeURIComponent(orderNumber)}`;
}

function button(href: string, label: string) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${BLACK};color:${WHITE};text-decoration:none;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;padding:16px 28px">${escapeHtml(label)}</a>`;
}

function itemRows(order: MoraOrder) {
  return order.items
    .map((item) => {
      const label = commerceLineLabel(item);
      return `<tr>
        <td style="padding:12px 0;border-bottom:1px solid ${LINE};font-size:14px;color:${INK}">${escapeHtml(label)} <span style="color:${SOFT}">×${item.qty}</span></td>
        <td style="padding:12px 0;border-bottom:1px solid ${LINE};font-size:14px;text-align:right;white-space:nowrap">${formatMoney(item.unitPrice * item.qty)}</td>
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
<meta name="color-scheme" content="light" />
<title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:${MIST}">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(opts.title)} · ${escapeHtml(BRAND.name)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${MIST};padding:28px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${WHITE};border:1px solid ${LINE}">
          <tr>
            <td align="center" bgcolor="${BLACK}" style="background:${BLACK};padding:36px 28px 32px">
              <img src="${LOGO}" alt="${escapeHtml(BRAND.name)}" width="176" height="56" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;height:auto;max-width:176px" />
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 0;color:${INK};font-family:Georgia,'Times New Roman',serif;background:${WHITE}">
              <div style="font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${SOFT}">${escapeHtml(opts.kicker)}</div>
              <h1 style="margin:14px 0 0;font-size:34px;line-height:1.05;font-weight:400;letter-spacing:-0.03em;color:${INK}">${escapeHtml(opts.title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 36px;color:${INK};font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.65;background:${WHITE}">
              <p style="margin:0 0 22px;color:${SOFT}">${opts.intro}</p>
              ${opts.body}
              ${opts.cta ? `<div style="margin:32px 0 4px">${opts.cta}</div>` : ""}
            </td>
          </tr>
          <tr>
            <td bgcolor="${BLACK}" style="background:${BLACK};padding:28px 32px 32px;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="28" style="vertical-align:middle">
                    <img src="${MARK}" alt="" width="28" height="28" style="display:block;border:0;width:28px;height:auto" />
                  </td>
                  <td style="padding-left:14px;vertical-align:middle">
                    <div style="color:${WHITE};font-size:13px;letter-spacing:0.18em;text-transform:uppercase">${escapeHtml(BRAND.name)}</div>
                    <div style="margin-top:4px;color:#bdbdbd;font-size:12px">${escapeHtml(BRAND.tagline)}</div>
                  </td>
                </tr>
              </table>
              <div style="margin-top:22px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.16);font-size:12px;line-height:1.7;color:#cfcfcf">
                <a href="https://moraring.com" style="color:${WHITE};text-decoration:none">moraring.com</a><br />
                <a href="mailto:no-responder@moraring.com" style="color:#cfcfcf;text-decoration:none">no-responder@moraring.com</a>
              </div>
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
    <table role="presentation" width="100%" style="background:${MIST};border:1px solid ${LINE};border-left:3px solid ${BLACK}">
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
      ${
        order.totals.discount
          ? `<tr><td style="padding:6px 0;color:${SOFT}">Descuento${order.meta?.offerCode ? ` · ${escapeHtml(order.meta.offerCode)}` : ""}</td><td style="text-align:right">−${formatMoney(order.totals.discount)}</td></tr>`
          : ""
      }
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

async function sendResend(
  to: string | string[],
  subject: string,
  html: string,
  extras?: {
    replyTo?: string;
    attachments?: { filename: string; content: Buffer }[];
  },
) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim() || FROM_DEFAULT;
  const recipients = (Array.isArray(to) ? to : [to]).map((item) => item.trim()).filter(Boolean);
  if (!key) {
    console.warn("[email] RESEND_API_KEY ausente; no se envió", subject, recipients.join(","));
    return { ok: false as const, error: "missing_resend" };
  }
  if (recipients.length === 0 || recipients.some((item) => !looksLikeEmail(item))) {
    return { ok: false as const, error: "invalid_email" };
  }

  const payload: Record<string, unknown> = {
    from,
    to: recipients,
    reply_to: extras?.replyTo || "no-responder@moraring.com",
    subject,
    html,
  };
  if (extras?.attachments?.length) {
    payload.attachments = extras.attachments.map((file) => ({
      filename: file.filename,
      content: file.content.toString("base64"),
    }));
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("[email] resend", res.status, text.slice(0, 180));
    return { ok: false as const, error: text.slice(0, 300) };
  }
  return { ok: true as const };
}

export async function sendPaidCustomerEmail(order: MoraOrder) {
  const sales = await getSalesPresentation();
  const needsSize = orderNeedsSize(order.items);
  const extra = needsSize
    ? `<p style="margin:16px 0 0;font-size:14px;color:${SOFT}">Te enviamos primero el medidor de tallas. Cuando lo uses, entra con tu pedido y pide el anillo. ${sales.promise}</p>`
    : `<p style="margin:16px 0 0;font-size:14px;color:${SOFT}">${sales.promise}</p>`;
  const html = shell({
    kicker: `${BRAND.name} · ${sales.label}`,
    title: "Tu pedido quedó.",
    intro: `Hola ${escapeHtml(order.customer.firstName || "")}. El pago se confirmó. Guardá el número de pedido para seguir cada paso.`,
    body: orderBody(order, extra),
    cta: button(
      needsSize
        ? `${siteUrl()}${tallaPath(order.orderNumber)}`
        : orderTrackingUrl(order.orderNumber),
      needsSize ? "Pedir mi talla" : "Ver mi pedido",
    ),
  });
  return sendResend(
    order.customer.email,
    `Pedido ${order.orderNumber} · ${BRAND.name}`,
    html,
  );
}

export async function sendSizerDispatchedEmail(order: MoraOrder) {
  const guia = order.shipments?.sizer?.trackingNumber?.trim() || "";
  const extra = `<p style="margin:16px 0 0;font-size:14px">Te enviamos el medidor de tallas${guia ? `. Tu guía es <strong>${escapeHtml(guia)}</strong>` : ""}${order.shipping.carrierLabel ? ` con ${escapeHtml(order.shipping.carrierLabel)}` : ""}.</p>
    <p style="margin:12px 0 0;font-size:14px;color:${SOFT}">Cuando lo recibas, elige la talla de cada anillo con tu número de pedido. Después sale el anillo.</p>`;
  const html = shell({
    kicker: "Medidor en camino",
    title: "Tu medidor fue despachado.",
    intro: `Pedido ${escapeHtml(order.orderNumber)} ya va hacia ${escapeHtml(order.shipping.ciudad)}.`,
    body: orderBody(order, extra),
    cta: button(`${siteUrl()}${tallaPath(order.orderNumber)}`, "Elegir mi talla"),
  });
  return sendResend(
    order.customer.email,
    `Medidor en camino ${order.orderNumber}${guia ? ` · guía ${guia}` : ""} · ${BRAND.name}`,
    html,
  );
}

export async function sendDispatchedCustomerEmail(order: MoraOrder) {
  const guia = order.shipments?.rings?.trackingNumber?.trim() || "";
  const carrier = order.shipments?.rings?.carrierLabel || order.shipping.carrierLabel;
  const extra = guia
    ? `<p style="margin:16px 0 0;font-size:14px">Tu guía es <strong>${escapeHtml(guia)}</strong>${carrier ? ` con ${escapeHtml(carrier)}` : ""}.</p>`
    : "";
  const html = shell({
    kicker: "En camino",
    title: "Tu pedido fue despachado.",
    intro: `Pedido ${escapeHtml(order.orderNumber)} ya va hacia ${escapeHtml(order.shipping.ciudad)}.`,
    body: orderBody(order, extra),
    cta: button(orderTrackingUrl(order.orderNumber), "Ver mi pedido"),
  });
  return sendResend(
    order.customer.email,
    `Tu pedido fue despachado ${order.orderNumber}${guia ? ` · guía ${guia}` : ""} · ${BRAND.name}`,
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

export function abandonedCheckoutUrl(code: string) {
  return `${siteUrl()}/checkout?oferta=${encodeURIComponent(code)}`;
}

export async function sendAbandonedOfferEmail(cart: AbandonedCart) {
  const email = cart.customer.email?.trim();
  const offer = cart.offer;
  if (!email || !offer) return { ok: false as const, error: "missing_offer" };

  const name = cart.customer.firstName?.trim() || "hola";
  const lines = cart.items
    .map((item) => {
      const model = products[item.modelId];
      const finish = finishLabel(item.modelId, item.finishId);
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid ${LINE};font-size:14px;color:${INK}">Mora ${escapeHtml(model?.name ?? "")} · ${escapeHtml(finish)} <span style="color:${SOFT}">×${item.qty}</span></td>
      </tr>`;
    })
    .join("");
  const discounted = Math.max(0, cart.subtotal - offer.discountCop);
  const html = shell({
    kicker: "Tu Mora te espera",
    title: "Dejamos un detalle en tu pedido.",
    intro: `${escapeHtml(name)}, tu carrito sigue guardado. Aplicamos ${escapeHtml(formatMoney(offer.discountCop))} de descuento para que lo termines cuando quieras.`,
    body: `
      <table role="presentation" width="100%">${lines}</table>
      <table role="presentation" width="100%" style="margin-top:8px;font-size:14px">
        <tr><td style="padding:6px 0;color:${SOFT}">Subtotal</td><td style="text-align:right">${formatMoney(cart.subtotal)}</td></tr>
        <tr><td style="padding:6px 0;color:${SOFT}">Descuento · ${escapeHtml(offer.code)}</td><td style="text-align:right">−${formatMoney(offer.discountCop)}</td></tr>
        <tr><td style="padding-top:12px;border-top:1px solid ${INK};font-weight:600">Anillos</td><td style="padding-top:12px;border-top:1px solid ${INK};text-align:right;font-weight:600">${formatMoney(discounted)}</td></tr>
      </table>
      <p style="margin:18px 0 0;font-size:13px;color:${SOFT}">El envío se cotiza al volver al pago. Código ${escapeHtml(offer.code)}.</p>
    `,
    cta: button(abandonedCheckoutUrl(offer.code), "Terminar mi pedido"),
  });
  return sendResend(
    email,
    `Tu Mora con ${formatMoney(offer.discountCop)} de descuento`,
    html,
  );
}

const CREATOR_LILAC = "#6f61b8";
const CREATOR_MIST = "#f4f3f8";
const CREATOR_INK = "#3d3852";
const CREATOR_SOFT = "#6a6580";
const CREATOR_LINE = "#e6e2f4";

function creatorInterestShell(input: { name: string }) {
  const hello = escapeHtml(input.name.trim() || "Hola");
  const banner = `${siteUrl()}/creadores/fondo.jpg`;
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>Estamos emocionados · ${escapeHtml(BRAND.name)}</title>
</head>
<body style="margin:0;padding:0;background:${CREATOR_MIST}">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">Recibimos tu registro. Revisaremos tus redes y nos comunicaremos pronto.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${CREATOR_MIST};padding:32px 14px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fbfbfd;border:1px solid ${CREATOR_LINE};border-radius:4px;overflow:hidden">
          <tr>
            <td style="padding:0;line-height:0;background:#fbfbfd">
              <img src="${banner}" alt="" width="560" height="224" style="display:block;width:100%;max-width:560px;height:auto;border:0;opacity:0.92" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 32px 8px;background:#fbfbfd">
              <img src="${LOGO}" alt="${escapeHtml(BRAND.name)}" width="148" height="46" style="display:block;margin:0 auto;border:0;outline:none;height:auto;max-width:148px;opacity:0.88" />
            </td>
          </tr>
          <tr>
            <td style="padding:8px 36px 0;color:${CREATOR_INK};font-family:Roboto,ui-sans-serif,system-ui,-apple-system,sans-serif;background:#fbfbfd">
              <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#8b84a6;font-weight:400">Creadores</div>
              <h1 style="margin:12px 0 0;font-size:32px;line-height:1.08;font-weight:300;letter-spacing:-0.04em;color:${CREATOR_INK}">Estamos emocionados.</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 36px 36px;font-family:Roboto,ui-sans-serif,system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.65;background:#fbfbfd;color:${CREATOR_SOFT}">
              <p style="margin:0 0 20px;color:${CREATOR_SOFT};font-weight:300">Hola ${hello}. Recibimos tu registro para usar ${escapeHtml(BRAND.name)} antes que nadie.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${CREATOR_MIST};border:1px solid ${CREATOR_LINE};border-radius:16px">
                <tr>
                  <td style="padding:20px 22px">
                    <p style="margin:0;font-size:15px;line-height:1.6;color:${CREATOR_INK};font-weight:300">Vamos a revisar tus redes y tus estadísticas con calma.</p>
                    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:${CREATOR_INK};font-weight:400">Nos comunicaremos pronto contigo.</p>
                  </td>
                </tr>
              </table>
              <p style="margin:22px 0 0;font-size:13px;line-height:1.55;color:#8b84a6;font-weight:300">Si tienes dudas, escríbenos a <a href="mailto:${escapeHtml(BRAND.contact.email)}" style="color:${CREATOR_LILAC};text-decoration:none">${escapeHtml(BRAND.contact.email)}</a>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 36px 28px;background:#fbfbfd;border-top:1px solid ${CREATOR_LINE};font-family:Roboto,ui-sans-serif,system-ui,-apple-system,sans-serif">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="28" style="vertical-align:middle">
                    <img src="${MARK}" alt="" width="28" height="28" style="display:block;border:0;width:28px;height:auto;opacity:0.9" />
                  </td>
                  <td style="padding-left:12px;vertical-align:middle">
                    <div style="color:${CREATOR_INK};font-size:12px;letter-spacing:0.14em;text-transform:uppercase;font-weight:400">${escapeHtml(BRAND.name)}</div>
                    <div style="margin-top:3px;color:#8b84a6;font-size:12px;font-weight:300">${escapeHtml(BRAND.tagline)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendCreatorInterestEmail(input: { name: string; email: string }) {
  const html = creatorInterestShell({ name: input.name });
  return sendResend(input.email, "Estamos emocionados · nos comunicaremos pronto", html, {
    replyTo: BRAND.contact.email,
  });
}

export async function sendCreatorStaffEmail(input: {
  name: string;
  email: string;
  phone: string;
  network: string;
  secondary?: string;
  followersLabel: string;
  audience: string;
  shots: { filename: string; content: Buffer }[];
}) {
  const extra = process.env.MORA_SALES_EMAIL?.trim();
  const to: string[] = [BRAND.contact.email];
  if (extra && extra.toLowerCase() !== BRAND.contact.email.toLowerCase()) to.push(extra);
  const html = shell({
    kicker: "Creadores",
    title: "Nueva postulación.",
    intro: `${escapeHtml(input.name)} quiere el anillo en primicia.`,
    body: `
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6">${escapeHtml(input.network)}<br />${escapeHtml(input.followersLabel)} seguidores</p>
      ${input.secondary ? `<p style="margin:0 0 14px;font-size:14px;color:${SOFT}">También ${escapeHtml(input.secondary)}</p>` : ""}
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6">${escapeHtml(input.audience)}</p>
      <p style="margin:0;font-size:13px;color:${SOFT}">${escapeHtml(input.email)} · ${escapeHtml(input.phone)}<br />Los pantallazos van adjuntos.</p>
    `,
  });
  return sendResend(to, `Creador · ${input.name} · ${input.followersLabel}`, html, {
    replyTo: input.email,
    attachments: input.shots,
  });
}
