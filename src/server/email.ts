import { BRAND } from "@/brand";
import { isCaseLine, lineFinishTitle, lineName } from "@/commerce/lines";
import { orderNeedsSize, sizeCopy, tallaPath } from "@/commerce/sizing";
import { caseColor } from "@/lib/cases";
import { finishPhoto, formatMoney, isFinishId, isModelId } from "@/lib/catalog";
import { PAYMENT_METHOD_LABEL } from "@/commerce/labels";
import { getSalesPresentation } from "./salesPolicy";
import { listGallery } from "./gallery";
import type { AbandonedCart, CartLine, MoraOrder } from "@/commerce/types";
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

const EMAIL_BRAND = "Mora Ring";
const FONT = "Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif";
const INK = "#16141f";
const SOFT = "#6a6580";
const MUTED = "#8b84a6";
const ACCENT = "#6f61b8";
const LILAC = "#e6e2f4";
const MIST = "#f4f3f8";
const PAPER = "#fbfbfd";
const WHITE = "#ffffff";
const LINE = "#ebe8f5";
const FROM_DEFAULT = `${EMAIL_BRAND} <no-responder@moraring.com>`;
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

function absoluteUrl(src: string) {
  if (/^https?:\/\//.test(src)) return src;
  return `${siteUrl()}${src.startsWith("/") ? "" : "/"}${src}`;
}

type PhotoLine = Pick<CartLine, "kind" | "modelId" | "finishId">;

/** La misma foto que el carrito; si la galería falla, la foto fija del color. */
async function linePhotos(lines: PhotoLine[]) {
  const byFinish = new Map<string, Promise<string>>();
  return Promise.all(
    lines.map((line) => {
      if (isCaseLine(line)) return Promise.resolve(absoluteUrl(caseColor(line.finishId).src));
      if (!isModelId(line.modelId) || !isFinishId(line.finishId)) return Promise.resolve("");
      const modelId = line.modelId;
      const finishId = line.finishId;
      const key = `${modelId}:${finishId}`;
      let photo = byFinish.get(key);
      if (!photo) {
        photo = listGallery(modelId, { finishId })
          .then((images) => {
            const uploaded = images.find(
              (image) => !image.system && !image.hidden && !image.src.startsWith("data:"),
            );
            return absoluteUrl(uploaded?.src ?? finishPhoto(finishId));
          })
          .catch(() => absoluteUrl(finishPhoto(finishId)));
        byFinish.set(key, photo);
      }
      return photo;
    }),
  );
}

function button(href: string, label: string) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto">
    <tr>
      <td bgcolor="${ACCENT}" style="border-radius:999px;background:${ACCENT}">
        <a href="${escapeHtml(href)}" style="display:inline-block;padding:15px 34px;font-family:${FONT};font-size:15px;font-weight:500;line-height:1;color:${WHITE};text-decoration:none;border-radius:999px">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

function sectionTitle(label: string) {
  return `<div style="margin:32px 0 6px;font-family:${FONT};font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:${MUTED};font-weight:500">${escapeHtml(label)}</div>`;
}

function nextSteps(steps: string[]) {
  const rows = steps
    .map(
      (text, index) => `<tr>
        <td width="34" valign="top" style="padding:${index === 0 ? "0" : "12px"} 0 0">
          <div style="width:24px;height:24px;border-radius:999px;background:${WHITE};color:${ACCENT};font-family:${FONT};font-size:12px;line-height:24px;text-align:center;font-weight:500">${index + 1}</div>
        </td>
        <td valign="top" style="padding:${index === 0 ? "2px" : "14px"} 0 0;font-family:${FONT};font-size:14px;line-height:1.55;color:${INK}">${escapeHtml(text)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${MIST};border-radius:16px">
    <tr><td style="padding:20px 22px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table>
    </td></tr>
  </table>`;
}

function itemRows(
  items: (CartLine & { name?: string; finishTitle?: string; unitPrice?: number })[],
  photos: string[],
  withPrice: boolean,
) {
  return items
    .map((item, index) => {
      const photo = photos[index];
      const finish = lineFinishTitle(item);
      const meta = isCaseLine(item) ? finish : [finish, sizeCopy(item)].filter(Boolean).join(" · ");
      const qty = item.qty > 1 ? ` <span style="color:${MUTED}">×${item.qty}</span>` : "";
      const border = index === 0 ? "" : `border-top:1px solid ${LINE};`;
      const price =
        withPrice && item.unitPrice != null
          ? `<td align="right" valign="middle" style="${border}padding:14px 0;font-family:${FONT};font-size:15px;color:${INK};white-space:nowrap">${formatMoney(item.unitPrice * item.qty)}</td>`
          : "";
      const thumb = photo
        ? `<img src="${escapeHtml(photo)}" alt="" width="64" height="64" style="display:block;width:64px;height:64px;border:0;border-radius:14px;object-fit:cover;background:${MIST}" />`
        : `<div style="width:64px;height:64px;border-radius:14px;background:${LILAC}"></div>`;
      return `<tr>
        <td width="64" valign="middle" style="${border}padding:14px 0">${thumb}</td>
        <td valign="middle" style="${border}padding:14px 12px 14px 16px;font-family:${FONT}">
          <div style="font-size:15px;line-height:1.3;color:${INK};font-weight:500">${escapeHtml(lineName(item))}${qty}</div>
          <div style="margin-top:4px;font-size:13px;line-height:1.4;color:${SOFT}">${escapeHtml(meta)}</div>
        </td>
        ${price}
      </tr>`;
    })
    .join("");
}

function orderNumberBox(order: MoraOrder) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${PAPER};border:1px solid ${LINE};border-radius:16px">
    <tr>
      <td style="padding:18px 20px;font-family:${FONT}">
        <div style="font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:${MUTED}">Número de pedido</div>
        <div style="margin-top:6px;font-size:21px;letter-spacing:0.04em;font-weight:500;color:${INK}">${escapeHtml(order.orderNumber)}</div>
      </td>
      <td align="right" style="padding:18px 20px;font-family:${FONT}">
        <div style="font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:${MUTED}">Total</div>
        <div style="margin-top:6px;font-size:21px;font-weight:500;color:${INK};white-space:nowrap">${formatMoney(order.totals.total)}</div>
      </td>
    </tr>
  </table>`;
}

function totalRow(label: string, value: string, strong = false) {
  const top = strong ? `padding-top:14px;border-top:1px solid ${LINE};` : "padding-top:8px;";
  const tone = strong ? `font-size:16px;color:${INK};font-weight:500` : `font-size:14px;color:${SOFT}`;
  return `<tr>
    <td style="${top}font-family:${FONT};${tone}">${label}</td>
    <td align="right" style="${top}font-family:${FONT};${tone};white-space:nowrap">${value}</td>
  </tr>`;
}

function shippingBlock(order: MoraOrder) {
  const depto = formatoDepartamentoEtiqueta(order.shipping.departamento);
  const name = [order.customer.firstName, order.customer.lastName].filter(Boolean).join(" ");
  const lines = [
    name,
    order.shipping.direccion,
    order.shipping.referencia,
    [order.shipping.ciudad, depto].filter(Boolean).join(", "),
  ]
    .map((line) => line?.trim())
    .filter(Boolean)
    .map((line) => escapeHtml(line as string))
    .join("<br />");
  return `${sectionTitle("Lo enviamos a")}
    <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.6;color:${INK}">${lines}</p>`;
}

function orderSummary(order: MoraOrder, photos: string[]) {
  const shipping = order.totals.shipping === 0 ? "Gratis" : formatMoney(order.totals.shipping);
  const carrier = order.shipping.carrierLabel ? ` · ${escapeHtml(order.shipping.carrierLabel)}` : "";
  const discount = order.totals.discount
    ? totalRow(
        `Descuento${order.meta?.offerCode ? ` · ${escapeHtml(order.meta.offerCode)}` : ""}`,
        `−${formatMoney(order.totals.discount)}`,
      )
    : "";
  return `${orderNumberBox(order)}
    ${sectionTitle("Tu pedido")}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${itemRows(order.items, photos, true)}</table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:6px;border-top:1px solid ${LINE}">
      ${totalRow("Subtotal", formatMoney(order.totals.subtotal))}
      ${discount}
      ${totalRow(`Envío${carrier}`, shipping)}
      <tr><td colspan="2" style="height:10px;line-height:10px;font-size:0">&nbsp;</td></tr>
      ${totalRow("Total", formatMoney(order.totals.total), true)}
    </table>
    ${shippingBlock(order)}`;
}

function guideBox(label: string, guide: string, carrier?: string) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;background:${MIST};border-radius:16px">
    <tr><td style="padding:18px 20px;font-family:${FONT}">
      <div style="font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:${MUTED}">${escapeHtml(label)}</div>
      <div style="margin-top:6px;font-size:19px;letter-spacing:0.03em;font-weight:500;color:${INK}">${escapeHtml(guide)}</div>
      ${carrier ? `<div style="margin-top:4px;font-size:13px;color:${SOFT}">con ${escapeHtml(carrier)}</div>` : ""}
    </td></tr>
  </table>`;
}

function shell(opts: {
  preheader: string;
  kicker: string;
  title: string;
  intro: string;
  body: string;
  cta?: string;
  after?: string;
  help?: boolean;
}) {
  const help =
    opts.help === false
      ? ""
      : `<tr>
            <td align="center" class="mora-pad" style="padding:28px 32px 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED}">
              ¿Tienes alguna pregunta? Escríbenos a <a href="mailto:${escapeHtml(BRAND.contact.email)}" style="color:${ACCENT};text-decoration:none">${escapeHtml(BRAND.contact.email)}</a> o por <a href="${escapeHtml(BRAND.contact.whatsapp)}" style="color:${ACCENT};text-decoration:none">WhatsApp</a>. Con gusto te ayudamos.
            </td>
          </tr>`;
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(opts.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500&display=swap" rel="stylesheet" />
<style>
  body, table, td, a, p, div, h1 { font-family: ${FONT}; }
  a { color: ${ACCENT}; }
  @media (max-width: 620px) {
    .mora-pad { padding-left: 22px !important; padding-right: 22px !important; }
    .mora-title { font-size: 26px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${MIST};-webkit-font-smoothing:antialiased">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(opts.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${MIST};padding:32px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px">
          <tr>
            <td align="center" style="padding:4px 0 24px">
              <img src="${LOGO}" alt="${EMAIL_BRAND}" width="132" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;height:auto;width:132px;max-width:132px" />
            </td>
          </tr>
          <tr>
            <td style="background:${WHITE};border:1px solid ${LINE};border-radius:24px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td class="mora-pad" style="padding:40px 40px 0;font-family:${FONT}">
                    <span style="display:inline-block;background:${LILAC};color:${ACCENT};font-size:12px;letter-spacing:0.08em;text-transform:uppercase;font-weight:500;padding:7px 13px;border-radius:999px">${escapeHtml(opts.kicker)}</span>
                    <h1 class="mora-title" style="margin:18px 0 0;font-family:${FONT};font-size:30px;line-height:1.15;font-weight:400;letter-spacing:-0.02em;color:${INK}">${escapeHtml(opts.title)}</h1>
                    <p style="margin:14px 0 0;font-family:${FONT};font-size:16px;line-height:1.6;font-weight:300;color:${SOFT}">${opts.intro}</p>
                  </td>
                </tr>
                <tr>
                  <td class="mora-pad" style="padding:28px 40px 40px;font-family:${FONT};font-size:15px;line-height:1.6;color:${INK}">
                    ${opts.body}
                    ${opts.cta ? `<div style="margin-top:34px;text-align:center">${opts.cta}</div>` : ""}
                    ${opts.after ?? ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${help}
          <tr>
            <td align="center" style="padding:24px 24px 0">
              <img src="${MARK}" alt="" width="26" height="26" style="display:block;margin:0 auto;border:0;width:26px;height:auto" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:10px 24px 0;font-family:${FONT};font-size:12px;letter-spacing:0.16em;text-transform:uppercase;font-weight:500;color:${INK}">${EMAIL_BRAND}</td>
          </tr>
          <tr>
            <td align="center" style="padding:4px 24px 0;font-family:${FONT};font-size:12px;color:${MUTED}">${escapeHtml(BRAND.tagline)}</td>
          </tr>
          <tr>
            <td align="center" style="padding:10px 24px 8px;font-family:${FONT};font-size:12px">
              <a href="https://moraring.com" style="color:${ACCENT};text-decoration:none">moraring.com</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function plainText(html: string) {
  return html
    .replace(/<head[\s\S]*?<\/head>/i, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h1|table)>/gi, "\n")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n\n")
    .trim();
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
    reply_to: extras?.replyTo || BRAND.contact.email,
    subject,
    html,
    text: plainText(html),
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

function staffRecipients() {
  const extra = process.env.MORA_SALES_EMAIL?.trim();
  const to: string[] = [BRAND.contact.email];
  if (extra && extra.toLowerCase() !== BRAND.contact.email.toLowerCase()) to.push(extra);
  return to;
}

function firstNameOf(order: MoraOrder) {
  return escapeHtml(order.customer.firstName?.trim() || "");
}

export async function sendPaidCustomerEmail(order: MoraOrder) {
  const [sales, photos] = await Promise.all([getSalesPresentation(), linePhotos(order.items)]);
  const withSizer = orderNeedsSize(order.items);
  const name = firstNameOf(order);
  const steps = withSizer
    ? [
        "Te enviamos el medidor de tallas a tu casa. Te escribimos apenas salga, con la guía para que lo sigas.",
        "Te lo pruebas con calma, en el dedo donde vas a llevar tu anillo.",
        "Nos cuentas qué número te quedó mejor, con tu número de pedido.",
        `Te enviamos tu anillo en esa talla.${sales.paidNote ? ` ${sales.paidNote}` : ""}`,
      ]
    : [
        "Ya estamos alistando tu pedido con mucho cariño.",
        "Te escribimos apenas salga, con la guía para que lo sigas.",
        sales.paidNote || "Lo recibes en la dirección que nos diste.",
      ];
  const sizeLink = withSizer
    ? `<p style="margin:22px 0 0;text-align:center;font-family:${FONT};font-size:13px;line-height:1.6;color:${SOFT}">¿Ya tienes tu talla? <a href="${escapeHtml(`${siteUrl()}${tallaPath(order.orderNumber)}`)}" style="color:${ACCENT};text-decoration:none;font-weight:500">Cuéntanos aquí</a></p>`
    : "";
  const html = shell({
    preheader: `Tu pago quedó aprobado. Pedido ${order.orderNumber}.`,
    kicker: "Pedido confirmado",
    title: name ? `¡Gracias, ${order.customer.firstName.trim()}!` : "¡Gracias por tu compra!",
    intro:
      "Tu pago quedó aprobado y tu pedido está confirmado. Aquí tienes todo el detalle; guarda este correo para seguir cada paso.",
    body: `${orderSummary(order, photos)}
      ${sectionTitle("Lo que sigue")}
      ${nextSteps(steps)}`,
    cta: button(orderTrackingUrl(order.orderNumber), "Ver mi pedido"),
    after: sizeLink,
  });
  return sendResend(
    order.customer.email,
    `¡Listo! Tu pedido ${order.orderNumber} está confirmado · ${EMAIL_BRAND}`,
    html,
  );
}

export async function sendSizerDispatchedEmail(order: MoraOrder) {
  const guia = order.shipments?.sizer?.trackingNumber?.trim() || "";
  const carrier = order.shipments?.sizer?.carrierLabel || order.shipping.carrierLabel;
  const photos = await linePhotos(order.items);
  const name = firstNameOf(order);
  const html = shell({
    preheader: "Tu medidor de tallas ya va hacia ti.",
    kicker: "Medidor en camino",
    title: "Tu medidor ya va en camino.",
    intro: `${name ? `Hola, ${name}. ` : ""}Ya te enviamos el medidor de tallas a ${escapeHtml(order.shipping.ciudad)}. Cuando te llegue, pruébatelo con calma y cuéntanos qué número te quedó mejor. Apenas lo tengamos, te enviamos tu anillo.`,
    body: `${guia ? guideBox("Guía del medidor", guia, carrier) : ""}
      ${sectionTitle("Para elegir bien")}
      ${nextSteps([
        "Pruébatelo en el dedo donde vas a llevar tu anillo, mejor al final del día.",
        "Debe entrar sin forzar y no girar solo.",
        "Si dudas entre dos tallas, elige la más grande.",
      ])}
      ${sectionTitle("Tu pedido")}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${itemRows(order.items, photos, false)}</table>`,
    cta: button(`${siteUrl()}${tallaPath(order.orderNumber)}`, "Contarles mi talla"),
  });
  return sendResend(
    order.customer.email,
    `Tu medidor va en camino · ${order.orderNumber} · ${EMAIL_BRAND}`,
    html,
  );
}

export async function sendDeliveredCustomerEmail(order: MoraOrder) {
  const photos = await linePhotos(order.items);
  const name = firstNameOf(order);
  const html = shell({
    preheader: "Tu pedido ya llegó. Gracias por elegir Mora Ring.",
    kicker: "Entregado",
    title: "Ya está en tus manos.",
    intro: `${name ? `Hola, ${name}. ` : ""}Tu pedido ${escapeHtml(order.orderNumber)} llegó a ${escapeHtml(order.shipping.ciudad)}. Esperamos que te quede tan bien como lo imaginaste.`,
    body: `${sectionTitle("Tu pedido")}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${itemRows(order.items, photos, false)}</table>
      ${sectionTitle("Si necesitas algo")}
      <p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.6;color:${SOFT}">Tienes un mes de garantía por fallas de fabricación. Si algo no se siente bien, escríbenos con tu número de pedido y te ayudamos.</p>`,
    cta: button(orderTrackingUrl(order.orderNumber), "Ver mi pedido"),
  });
  return sendResend(
    order.customer.email,
    `Tu pedido llegó · ${order.orderNumber} · ${EMAIL_BRAND}`,
    html,
  );
}

export async function sendCancelledCustomerEmail(order: MoraOrder) {
  const photos = await linePhotos(order.items);
  const name = firstNameOf(order);
  const paid = Boolean(order.paidAt) || order.payment.status === "approved";
  const html = shell({
    preheader: paid
      ? "Cancelamos tu pedido. Si pagaste, te ayudamos."
      : "Cancelamos tu pedido. No te cobramos nada.",
    kicker: "Pedido cancelado",
    title: "Cancelamos tu pedido.",
    intro: paid
      ? `${name ? `Hola, ${name}. ` : ""}Cancelamos el pedido ${escapeHtml(order.orderNumber)}. Si el pago ya se hizo, escríbenos y te ayudamos con la devolución.`
      : `${name ? `Hola, ${name}. ` : ""}Cancelamos el pedido ${escapeHtml(order.orderNumber)}. No se cobró nada. Cuando quieras, puedes volver a pedir tu anillo.`,
    body: `${sectionTitle("Este era tu pedido")}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${itemRows(order.items, photos, false)}</table>
      <p style="margin:22px 0 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${SOFT}">Si esto fue un error o tienes una duda, respóndenos este correo o escríbenos por WhatsApp. Con gusto te ayudamos.</p>`,
    cta: button(BRAND.contact.whatsapp, "Escribirnos"),
  });
  return sendResend(
    order.customer.email,
    `Pedido cancelado ${order.orderNumber} · ${EMAIL_BRAND}`,
    html,
  );
}

export async function sendDispatchedCustomerEmail(order: MoraOrder) {
  const guia = order.shipments?.rings?.trackingNumber?.trim() || "";
  const carrier = order.shipments?.rings?.carrierLabel || order.shipping.carrierLabel;
  const photos = await linePhotos(order.items);
  const name = firstNameOf(order);
  const html = shell({
    preheader: "Tu pedido ya salió y va hacia ti.",
    kicker: "En camino",
    title: "Tu anillo ya va en camino.",
    intro: `${name ? `Hola, ${name}. ` : ""}Tu pedido ya salió y va hacia ${escapeHtml(order.shipping.ciudad)}. Muy pronto lo tienes en tus manos.`,
    body: `${guia ? guideBox("Tu guía", guia, carrier) : ""}
      ${sectionTitle("Tu pedido")}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${itemRows(order.items, photos, false)}</table>
      ${shippingBlock(order)}`,
    cta: button(orderTrackingUrl(order.orderNumber), "Seguir mi pedido"),
  });
  return sendResend(
    order.customer.email,
    `Tu pedido va en camino · ${order.orderNumber}${guia ? ` · guía ${guia}` : ""} · ${EMAIL_BRAND}`,
    html,
  );
}

function whatsappLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits.length === 10 ? `57${digits}` : digits}`;
}

function detailRow(label: string, value: string) {
  return `<tr>
    <td valign="top" style="padding:8px 0;font-family:${FONT};font-size:13px;color:${MUTED};width:110px">${escapeHtml(label)}</td>
    <td valign="top" style="padding:8px 0;font-family:${FONT};font-size:14px;color:${INK}">${value}</td>
  </tr>`;
}

export async function sendPaidStaffEmail(order: MoraOrder) {
  const photos = await linePhotos(order.items);
  const customer = order.customer;
  const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "Cliente";
  const wa = whatsappLink(customer.phone ?? "");
  const pieces = order.items.reduce((sum, item) => sum + item.qty, 0);
  const method = PAYMENT_METHOD_LABEL[order.payment.method];
  const sizerNote = orderNeedsSize(order.items)
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;background:${LILAC};border-radius:14px">
        <tr><td style="padding:14px 18px;font-family:${FONT};font-size:14px;line-height:1.5;color:${INK}">Pidió <strong style="font-weight:500">medidor de tallas</strong>: primero sale el medidor y luego el anillo.</td></tr>
      </table>`
    : "";
  const html = shell({
    preheader: `${fullName} · ${formatMoney(order.totals.total)} · ${method}`,
    kicker: "Nueva venta",
    title: `Entró una venta de ${formatMoney(order.totals.total)}`,
    intro: `${escapeHtml(fullName)} compró ${pieces} ${pieces === 1 ? "pieza" : "piezas"} con ${escapeHtml(method)}.`,
    body: `${sectionTitle("Cliente")}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        ${detailRow("Nombre", escapeHtml(fullName))}
        ${detailRow("Correo", `<a href="mailto:${escapeHtml(customer.email)}" style="color:${ACCENT};text-decoration:none">${escapeHtml(customer.email)}</a>`)}
        ${detailRow("Teléfono", wa ? `<a href="${escapeHtml(wa)}" style="color:${ACCENT};text-decoration:none">${escapeHtml(customer.phone)}</a>` : escapeHtml(customer.phone ?? ""))}
        ${customer.documentNumber ? detailRow("Documento", escapeHtml(`${customer.documentType ?? "CC"} ${customer.documentNumber}`)) : ""}
        ${detailRow("Pago", escapeHtml(method))}
      </table>
      ${sizerNote}
      <div style="height:24px;line-height:24px;font-size:0">&nbsp;</div>
      ${orderSummary(order, photos)}`,
    cta: button(`${siteUrl()}/superadmin/ventas`, "Abrir ventas"),
    help: false,
  });
  return sendResend(
    staffRecipients(),
    `Nueva venta ${order.orderNumber} · ${formatMoney(order.totals.total)} · ${EMAIL_BRAND}`,
    html,
    { replyTo: looksLikeEmail(customer.email ?? "") ? customer.email : undefined },
  );
}

export function abandonedCheckoutUrl(code: string) {
  return `${siteUrl()}/checkout?oferta=${encodeURIComponent(code)}`;
}

export async function sendAbandonedOfferEmail(cart: AbandonedCart) {
  const email = cart.customer.email?.trim();
  const offer = cart.offer;
  if (!email || !offer) return { ok: false as const, error: "missing_offer" };

  const name = cart.customer.firstName?.trim();
  const photos = await linePhotos(cart.items);
  const discounted = Math.max(0, cart.subtotal - offer.discountCop);
  const html = shell({
    preheader: `Guardamos tu carrito con ${formatMoney(offer.discountCop)} de descuento.`,
    kicker: "Te lo guardamos",
    title: "Tu anillo te está esperando.",
    intro: `${name ? `Hola, ${escapeHtml(name)}. ` : ""}Vimos que dejaste tu pedido a medio camino, así que lo guardamos para ti con ${escapeHtml(formatMoney(offer.discountCop))} de descuento. Termínalo cuando quieras.`,
    body: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${itemRows(cart.items, photos, false)}</table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:6px;border-top:1px solid ${LINE}">
        ${totalRow("Subtotal", formatMoney(cart.subtotal))}
        ${totalRow(`Descuento · ${escapeHtml(offer.code)}`, `−${formatMoney(offer.discountCop)}`)}
        <tr><td colspan="2" style="height:10px;line-height:10px;font-size:0">&nbsp;</td></tr>
        ${totalRow("Con tu descuento", formatMoney(discounted), true)}
      </table>
      <p style="margin:18px 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${SOFT}">El envío se calcula al volver al pago. Tu código es <strong style="color:${INK};font-weight:500">${escapeHtml(offer.code)}</strong>.</p>`,
    cta: button(abandonedCheckoutUrl(offer.code), "Terminar mi pedido"),
  });
  return sendResend(
    email,
    `Tu anillo te espera con ${formatMoney(offer.discountCop)} de descuento · ${EMAIL_BRAND}`,
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
<title>Estamos emocionados · ${EMAIL_BRAND}</title>
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
              <img src="${LOGO}" alt="${EMAIL_BRAND}" width="148" height="46" style="display:block;margin:0 auto;border:0;outline:none;height:auto;max-width:148px;opacity:0.88" />
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
              <p style="margin:0 0 20px;color:${CREATOR_SOFT};font-weight:300">Hola ${hello}. Recibimos tu registro para usar ${EMAIL_BRAND} antes que nadie.</p>
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
                    <div style="color:${CREATOR_INK};font-size:12px;letter-spacing:0.14em;text-transform:uppercase;font-weight:400">${EMAIL_BRAND}</div>
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
  const to = staffRecipients();
  const html = shell({
    preheader: `${input.name} · ${input.followersLabel} seguidores`,
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
