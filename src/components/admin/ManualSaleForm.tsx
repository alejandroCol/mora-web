"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CASE_COLOR_LIST, CASE_PRODUCT, caseLineKey, type CaseColorId } from "@/lib/cases";
import { cartCount, discountOf, subtotalOf } from "@/commerce/cartMath";
import { DOCUMENT_TYPES } from "@/commerce/labels";
import { cartHasRing, isCaseLine, lineSwatch, lineUnitPrice } from "@/commerce/lines";
import {
  isLinkMethod,
  looksLikeEmail,
  MANUAL_PAY_LABEL,
  MANUAL_PAY_METHODS,
  MANUAL_PENDING_HOURS,
  manualDiscountOf,
  type ManualPayMethod,
  type ManualQuote,
  type ManualSaleContext,
  type ManualSaleRequest,
  type ManualStockHold,
} from "@/commerce/manualSale";
import { commerceLineLabel } from "@/commerce/sizing";
import { cartLineKey, stockSku } from "@/commerce/sku";
import type { CartLine, MoraOrder } from "@/commerce/types";
import {
  catalog,
  finishLabel,
  finishes,
  formatMoney,
  productTitle,
  products,
  type FinishId,
  type ModelId,
} from "@/lib/catalog";
import { ColombiaFields, useDebounced } from "@/components/checkout/ColombiaFields";
import { usePricing } from "@/components/sales/SalesProvider";

type ProductPick = ModelId | "case";
/** Talla elegida, «kit» = sale con medidor, null = aún sin elegir. */
type SizePick = number | "kit" | null;

type Created = { order: MoraOrder; payUrl?: string };

const LOW_STOCK = 3;

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function clock(at: number) {
  return new Date(at).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
}

function whatsappUrl(phone: string, text: string) {
  const raw = digits(phone);
  const number = raw.length === 10 ? `57${raw}` : raw;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function ManualSaleForm({
  onClose,
  onCreated,
  authorizedFetch,
  initial,
}: {
  onClose: () => void;
  /** La venta quedó creada. El formulario sigue abierto mostrando el resultado. */
  onCreated: () => void;
  authorizedFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  initial?: {
    firstName?: string;
    phone?: string;
    email?: string;
    notes?: string;
    conversationId?: string;
    channel?: "manual" | "whatsapp" | "instagram";
  };
}) {
  // Venta desde un chat: casi siempre se envía y se paga por transferencia.
  const fromChat = Boolean(initial?.conversationId);
  const pricing = usePricing();

  const [context, setContext] = useState<ManualSaleContext | null>(null);

  // 1 · Productos
  const [product, setProduct] = useState<ProductPick>("aero");
  const [finishId, setFinishId] = useState<FinishId>(products.aero.finishes[0]);
  const [caseColorId, setCaseColorId] = useState<CaseColorId>(CASE_PRODUCT.colors[0]);
  const [size, setSize] = useState<SizePick>(null);
  const [lines, setLines] = useState<CartLine[]>([]);

  // 2 · Cliente
  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [documentType, setDocumentType] = useState("CC");
  const [documentNumber, setDocumentNumber] = useState("");

  // 3 · Entrega
  const [ship, setShip] = useState(fromChat);
  const [departamento, setDepartamento] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [direccion, setDireccion] = useState("");
  const [referencia, setReferencia] = useState("");
  const [carrier, setCarrier] = useState("");
  const [freeShipping, setFreeShipping] = useState(false);
  const [quoted, setQuoted] = useState<{ key: string; quote?: ManualQuote; error?: string } | null>(null);

  // 4 · Pago
  const [method, setMethod] = useState<ManualPayMethod>(fromChat ? "transferencia" : "efectivo");
  const [paid, setPaid] = useState(true);
  const [reference, setReference] = useState("");
  const [invoice, setInvoice] = useState(false);
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const [tried, setTried] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const [releasing, setReleasing] = useState("");

  useEffect(() => {
    let alive = true;
    authorizedFetch("/api/admin/orders/manual")
      .then((res) => res.json())
      .then((data: { ok?: boolean; context?: ManualSaleContext }) => {
        if (alive && data.ok && data.context) setContext(data.context);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [authorizedFetch]);

  function reloadContext() {
    return authorizedFetch("/api/admin/orders/manual")
      .then((res) => res.json())
      .then((data: { ok?: boolean; context?: ManualSaleContext }) => {
        if (data.ok && data.context) setContext(data.context);
      })
      .catch(() => undefined);
  }

  async function releaseHold(hold: ManualStockHold) {
    const who = hold.customer || "el cliente";
    const ok = window.confirm(
      `¿Cancelar ${hold.orderNumber} de ${who} y liberar la pieza?\n\n` +
        `Si ${hold.method === "addi" ? "Addi" : "el pago"} lo aprueba de todas formas, el pedido vuelve como pagado ` +
        "y queda marcado para reponer la pieza o reembolsar.",
    );
    if (!ok) return;
    setReleasing(hold.orderId);
    setError("");
    try {
      const res = await authorizedFetch(`/api/admin/orders/${hold.orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled", note: "Liberado para una venta manual" }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) throw new Error(data.error || "No se pudo liberar.");
      await reloadContext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo liberar.");
    } finally {
      setReleasing("");
    }
  }

  const isCase = product === "case";
  const model = isCase ? null : products[product];
  const finishHolds = model
    ? model.sizes.flatMap((item) =>
        (context?.holds?.[`${product}__${finishId}__${item}`] ?? []).map((hold) => ({ size: item, hold })),
      )
    : [];

  /** Unidades libres de una referencia, descontando lo que ya va en esta venta. */
  function left(sku: string | null) {
    if (!sku || !context) return Infinity;
    const inCart = lines.reduce((sum, line) => (stockSku(line) === sku ? sum + line.qty : sum), 0);
    return Math.max(0, (context.stock[sku] ?? 0) - inCart);
  }

  const draft: CartLine | null = isCase
    ? {
        key: caseLineKey(caseColorId),
        kind: "case",
        modelId: "case",
        finishId: caseColorId,
        size: 0,
        sizing: "self",
        qty: 1,
      }
    : size === null
      ? null
      : size === "kit"
        ? {
            key: cartLineKey(product, finishId, 0, "kit"),
            kind: "ring",
            modelId: product,
            finishId,
            size: 0,
            sizing: "kit",
            qty: 1,
          }
        : {
            key: cartLineKey(product, finishId, size),
            kind: "ring",
            modelId: product,
            finishId,
            size,
            sizing: "self",
            qty: 1,
          };
  const draftLeft = draft ? left(stockSku(draft)) : 0;

  function addLine() {
    if (!draft || draftLeft < 1) return;
    setLines((current) =>
      current.some((line) => line.key === draft.key)
        ? current.map((line) => (line.key === draft.key ? { ...line, qty: line.qty + 1 } : line))
        : [...current, draft],
    );
    setError("");
  }

  function changeQty(key: string, delta: number) {
    setLines((current) =>
      current
        .map((line) => (line.key === key ? { ...line, qty: line.qty + delta } : line))
        .filter((line) => line.qty > 0),
    );
  }

  // Totales. `pricing` cambia el precio vivo aunque las líneas sean las mismas.
  const subtotal = useMemo(
    () => subtotalOf(lines),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pricing re-run
    [lines, pricing],
  );
  const hasRing = cartHasRing(lines);
  const promo = context?.promo ?? null;
  const promoCop = promo ? discountOf(subtotal, { kind: "percent", value: promo.percent }) : 0;
  const manualCop = Number(digits(discount)) || 0;
  const { discountCop, promoApplied } = manualDiscountOf(subtotal, manualCop, promoCop);

  // Envío: gratis si lleva anillo; si es solo case se cotiza como en la tienda.
  const needsQuote = ship && lines.length > 0 && !hasRing && Boolean(departamento && ciudad);
  const quoteKey = needsQuote ? JSON.stringify({ items: lines, departamento, ciudad }) : "";
  const quoteKeyDebounced = useDebounced(quoteKey, 350);

  useEffect(() => {
    if (!quoteKeyDebounced) return;
    let alive = true;
    authorizedFetch("/api/admin/orders/manual", {
      method: "POST",
      body: quoteKeyDebounced,
    })
      .then((res) => res.json())
      .then((data: { ok?: boolean; quote?: ManualQuote; error?: string }) => {
        if (!alive) return;
        setQuoted(
          data.ok && data.quote
            ? { key: quoteKeyDebounced, quote: data.quote }
            : { key: quoteKeyDebounced, error: data.error || "No pudimos cotizar el envío." },
        );
      })
      .catch(() => {
        if (alive) setQuoted({ key: quoteKeyDebounced, error: "No pudimos cotizar el envío." });
      });
    return () => {
      alive = false;
    };
  }, [authorizedFetch, quoteKeyDebounced]);

  const quote = needsQuote && quoted?.key === quoteKey ? quoted.quote : undefined;
  const quoteError = needsQuote && quoted?.key === quoteKey ? quoted.error : undefined;
  const quoting = needsQuote && !quote && !quoteError;
  const option = quote?.opciones.find((item) => item.carrier === carrier) ?? quote?.seleccionada ?? null;
  const envio = !ship || hasRing || freeShipping ? 0 : (option?.totalPriceCop ?? quote?.envioCop ?? 0);
  const total = Math.max(0, subtotal + envio - discountCop);

  const link = !paid && isLinkMethod(method);
  const methodReady = (item: ManualPayMethod) =>
    !context || (item === "bold" ? context.bold : item === "addi" ? context.addi : true);

  function pickMethod(next: ManualPayMethod) {
    setMethod(next);
    // Lo normal: efectivo, datáfono y transferencia ya entraron; Bold y Addi van por enlace.
    setPaid(!isLinkMethod(next));
  }

  // Qué falta, en el orden en que se llena. La primera línea se muestra junto al botón.
  const missing: string[] = [];
  if (lines.length === 0) missing.push("Añade al menos un producto.");
  if (ship) {
    if (!firstName.trim()) missing.push("Nombre de quien recibe.");
    if (digits(phone).length < 7) missing.push("Teléfono de quien recibe.");
    if (!departamento || !ciudad || !direccion.trim()) missing.push("Departamento, ciudad y dirección del envío.");
  }
  if (email.trim() && !looksLikeEmail(email)) missing.push("Revisa el correo.");
  if (link && !looksLikeEmail(email)) missing.push("Correo del cliente para el enlace de pago.");
  if (link && method === "addi") {
    if (!/^3\d{9}$/.test(digits(phone).slice(-10))) missing.push("Addi pide un celular de 10 dígitos.");
    if (digits(documentNumber).length < 5) missing.push("Addi pide la cédula del cliente.");
  }
  if (invoice) {
    if (!digits(documentNumber)) missing.push("Documento para la factura.");
    if (!looksLikeEmail(email)) missing.push("Correo para enviar la factura.");
  }
  if (link && total <= 0) missing.push("Un pedido en cero no necesita enlace.");

  const cta = paid
    ? `Registrar venta · ${formatMoney(total)}`
    : link
      ? `Crear pedido y enlace · ${formatMoney(total)}`
      : `Crear pedido por cobrar · ${formatMoney(total)}`;

  async function submit() {
    setTried(true);
    if (missing.length > 0) return;
    setBusy(true);
    setError("");
    const payload: ManualSaleRequest = {
      items: lines,
      customer: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        documentType,
        documentNumber: digits(documentNumber),
      },
      delivery: ship
        ? {
            mode: "ship",
            departamento,
            ciudad,
            direccion: direccion.trim(),
            referencia: referencia.trim(),
            carrier: option?.carrier,
            free: freeShipping,
          }
        : { mode: "pickup" },
      payment: { method, paid, reference: paid ? reference.trim() : undefined },
      invoice,
      discountCop: manualCop,
      notes: notes.trim(),
      channel: initial?.channel ?? "manual",
      conversationId: initial?.conversationId,
    };
    try {
      const res = await authorizedFetch("/api/admin/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok: boolean; error?: string } & Partial<Created>;
      if (!data.ok || !data.order) throw new Error(data.error || "No se pudo registrar.");
      setCreated({ order: data.order, payUrl: data.payUrl });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar.");
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setCreated(null);
    setLines([]);
    setSize(null);
    setReference("");
    setDiscount("");
    setInvoice(false);
    setTried(false);
    setError("");
    setCopied(false);
    // El stock cambió con la venta anterior.
    void reloadContext();
    topRef.current?.scrollIntoView({ block: "start" });
  }

  if (created) {
    return (
      <SaleShell onClose={onClose} title="Venta creada">
        <SaleDone
          created={created}
          copied={copied}
          onCopy={() => {
            if (!created.payUrl) return;
            void navigator.clipboard?.writeText(created.payUrl).then(() => setCopied(true));
          }}
          onAnother={startOver}
          onClose={onClose}
        />
      </SaleShell>
    );
  }

  return (
    <SaleShell
      onClose={onClose}
      title="Nueva venta"
      footer={
        <>
          <dl className="sale-totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatMoney(subtotal)}</dd>
            </div>
            {discountCop > 0 ? (
              <div>
                <dt>{promoApplied && promo ? `${promo.label} −${promo.percent} %` : "Descuento"}</dt>
                <dd>−{formatMoney(discountCop)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Envío</dt>
              <dd>
                {!ship
                  ? "Entrega en mano"
                  : lines.length === 0
                    ? "—"
                    : quoting
                      ? "Cotizando…"
                      : envio === 0
                        ? "Gratis"
                        : formatMoney(envio)}
              </dd>
            </div>
          </dl>
          {error ? (
            <p className="sale-error" role="alert">
              {error}
            </p>
          ) : tried && missing.length > 0 ? (
            <p className="sale-error" role="alert">
              {missing[0]}
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy || lines.length === 0 || quoting}
            onClick={() => void submit()}
            className="admin-cta sale-cta"
          >
            {busy ? <span className="btn-spin" aria-hidden /> : null}
            {busy ? "Guardando…" : cta}
          </button>
        </>
      }
    >
      <div ref={topRef} />

      <Step n={1} title="Productos" hint="Solo se puede añadir lo que hay en stock.">
        <div className="sale-seg" role="tablist" aria-label="Producto">
          {catalog.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={product === item.id}
              className={product === item.id ? "is-on" : ""}
              onClick={() => {
                setProduct(item.id);
                setFinishId(products[item.id].finishes[0]);
                setSize(null);
              }}
            >
              {productTitle(item.id)}
              <small>{formatMoney(products[item.id].price)}</small>
            </button>
          ))}
          <button
            type="button"
            role="tab"
            aria-selected={isCase}
            className={isCase ? "is-on" : ""}
            onClick={() => setProduct("case")}
          >
            Mora Case
            <small>{formatMoney(CASE_PRODUCT.price)}</small>
          </button>
        </div>

        <p className="sale-label">
          Color ·{" "}
          <strong>
            {isCase
              ? CASE_COLOR_LIST.find((item) => item.id === caseColorId)?.title
              : finishLabel(product as ModelId, finishId)}
          </strong>
        </p>
        <div className="sale-swatches">
          {isCase
            ? CASE_COLOR_LIST.map((item) => {
                const free = left(`case__${item.id}`);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCaseColorId(item.id)}
                    className={`sale-swatch ${caseColorId === item.id ? "is-on" : ""} ${free < 1 ? "is-out" : ""}`}
                    aria-pressed={caseColorId === item.id}
                    title={free < 1 ? `${item.title} · agotado` : item.title}
                  >
                    <span style={{ background: item.swatch }} aria-hidden />
                    {item.title}
                  </button>
                );
              })
            : model!.finishes.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setFinishId(id);
                    setSize((current) => (current === "kit" ? current : null));
                  }}
                  className={`sale-swatch ${finishId === id ? "is-on" : ""}`}
                  aria-pressed={finishId === id}
                >
                  <span style={{ background: finishes[id].swatch }} aria-hidden />
                  {finishLabel(product as ModelId, id)}
                </button>
              ))}
        </div>

        {model ? (
          <>
            <p className="sale-label">Talla</p>
            <div className="sale-sizes">
              {model.sizes.map((item) => {
                const free = left(`${product}__${finishId}__${item}`);
                return (
                  <button
                    key={item}
                    type="button"
                    disabled={free < 1}
                    onClick={() => setSize(item)}
                    className={`sale-size ${size === item ? "is-on" : ""}`}
                    aria-pressed={size === item}
                    title={free < 1 ? "Agotada" : undefined}
                  >
                    {item}
                    {free >= 1 && free <= LOW_STOCK ? <small>quedan {free}</small> : null}
                    {free < 1 ? <small>agotada</small> : null}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSize("kit")}
                className={`sale-size is-wide ${size === "kit" ? "is-on" : ""}`}
                aria-pressed={size === "kit"}
              >
                Con medidor
                <small>elige talla después</small>
              </button>
            </div>
            {size === "kit" ? (
              <p className="sale-note">
                Primero sale el medidor. El cliente confirma la talla desde su pedido y ahí se descuenta el
                stock.
              </p>
            ) : null}
            {finishHolds.length > 0 ? (
              <ul className="sale-holds">
                {finishHolds.map(({ size: heldSize, hold }) => (
                  <li key={`${hold.orderId}-${heldSize}`}>
                    <span>
                      <strong>Talla {heldSize}</strong> · {hold.customer || "Cliente"} está pagando con{" "}
                      {hold.method === "addi" ? "Addi" : "tarjeta o PSE"}
                      {hold.channel === "online" ? " en la tienda" : " por enlace"} · {hold.orderNumber}
                      {hold.until ? ` · se libera sola a las ${clock(hold.until)}` : ""}
                    </span>
                    <button
                      type="button"
                      disabled={releasing === hold.orderId}
                      onClick={() => void releaseHold(hold)}
                    >
                      {releasing === hold.orderId ? "…" : "Liberar"}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}

        <button type="button" onClick={addLine} disabled={!draft || draftLeft < 1} className="sale-add">
          {!draft
            ? "Elige la talla"
            : draftLeft < 1
              ? "Sin stock"
              : `Añadir ${commerceLineLabel(draft)}`}
        </button>

        {lines.length > 0 ? (
          <ul className="sale-lines">
            {lines.map((line) => {
              const more = left(stockSku(line));
              return (
                <li key={line.key}>
                  <span className="sale-dot" style={{ background: lineSwatch(line) }} aria-hidden />
                  <span className="sale-line-name">
                    {commerceLineLabel({ ...line, qty: 1 })}
                    <small>{formatMoney(lineUnitPrice(line) * line.qty)}</small>
                  </span>
                  <span className="sale-qty">
                    <button type="button" onClick={() => changeQty(line.key, -1)} aria-label="Quitar uno">
                      −
                    </button>
                    <output>{line.qty}</output>
                    <button
                      type="button"
                      onClick={() => changeQty(line.key, 1)}
                      disabled={more < 1}
                      aria-label="Añadir uno"
                    >
                      +
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </Step>

      <Step n={2} title="Cliente" hint="Con correo le llega la confirmación, igual que en la tienda.">
        <div className="sale-card sale-grid">
          <Field label="Nombre">
            <input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="off" />
          </Field>
          <Field label="Apellido">
            <input value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="off" />
          </Field>
          <Field label="Celular">
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
              autoComplete="off"
            />
          </Field>
          <Field label="Correo">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              inputMode="email"
              autoCapitalize="none"
              autoComplete="off"
            />
          </Field>
          <Field label="Documento">
            <select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
              {DOCUMENT_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={invoice || (link && method === "addi") ? "Número" : "Número (opcional)"}>
            <input
              value={documentNumber}
              onChange={(event) => setDocumentNumber(event.target.value)}
              inputMode="numeric"
              autoComplete="off"
            />
          </Field>
        </div>
      </Step>

      <Step n={3} title="Entrega">
        <div className="sale-seg">
          <button type="button" className={!ship ? "is-on" : ""} onClick={() => setShip(false)}>
            Entrega en mano
          </button>
          <button type="button" className={ship ? "is-on" : ""} onClick={() => setShip(true)}>
            Envío a domicilio
          </button>
        </div>
        {ship ? (
          <>
            <div className="sale-card sale-geo">
              <ColombiaFields
                departamento={departamento}
                ciudad={ciudad}
                onDepartamento={(value) => {
                  setDepartamento(value);
                  setCiudad("");
                  setCarrier("");
                }}
                onCiudad={(value) => {
                  setCiudad(value);
                  setCarrier("");
                }}
              />
              <div className="sale-grid">
                <Field label="Dirección">
                  <input value={direccion} onChange={(event) => setDireccion(event.target.value)} autoComplete="off" />
                </Field>
                <Field label="Apto, barrio o indicaciones">
                  <input value={referencia} onChange={(event) => setReferencia(event.target.value)} autoComplete="off" />
                </Field>
              </div>
            </div>

            <div className="sale-quote" aria-live="polite">
              {lines.length === 0 ? (
                <p>Añade productos para saber el envío.</p>
              ) : hasRing ? (
                <p>
                  <strong>Envío gratis.</strong> Lleva anillo.
                </p>
              ) : !departamento || !ciudad ? (
                <p>Elige la ciudad y cotizamos el envío del case.</p>
              ) : quoting ? (
                <p>Cotizando el envío…</p>
              ) : quoteError ? (
                <p>{quoteError}</p>
              ) : quote?.gratis ? (
                <p>
                  <strong>Envío gratis.</strong> Supera el monto de envío gratis.
                </p>
              ) : quote && quote.opciones.length > 1 ? (
                <div className="sale-carriers">
                  {quote.opciones.map((item) => (
                    <label key={`${item.carrier}-${item.service}`} className={option?.carrier === item.carrier ? "is-on" : ""}>
                      <input
                        type="radio"
                        name="sale-carrier"
                        checked={option?.carrier === item.carrier}
                        onChange={() => setCarrier(item.carrier)}
                      />
                      <span>
                        {item.carrierLabel}
                        {item.deliveryEstimate ? <small>{item.deliveryEstimate}</small> : null}
                      </span>
                      <b>{formatMoney(item.totalPriceCop)}</b>
                    </label>
                  ))}
                </div>
              ) : quote ? (
                <p>
                  <strong>{formatMoney(option?.totalPriceCop ?? quote.envioCop)}</strong>
                  {option?.carrierLabel ? ` · ${option.carrierLabel}` : " · tarifa de envío"}
                  {option?.deliveryEstimate ? ` · ${option.deliveryEstimate}` : ""}
                </p>
              ) : null}
              {!hasRing && lines.length > 0 && !quote?.gratis ? (
                <label className="sale-check">
                  <input
                    type="checkbox"
                    checked={freeShipping}
                    onChange={(event) => setFreeShipping(event.target.checked)}
                  />
                  Cortesía: no cobrar el envío
                </label>
              ) : null}
            </div>
          </>
        ) : (
          <p className="sale-note">Se entrega en persona. No se cobra envío ni se crea guía.</p>
        )}
      </Step>

      <Step n={4} title="Pago">
        <div className="sale-chips">
          {MANUAL_PAY_METHODS.map((item) => (
            <button
              key={item}
              type="button"
              disabled={!methodReady(item)}
              onClick={() => pickMethod(item)}
              className={method === item ? "is-on" : ""}
              aria-pressed={method === item}
              title={!methodReady(item) ? "Sin configurar" : undefined}
            >
              {MANUAL_PAY_LABEL[item]}
            </button>
          ))}
        </div>

        <div className="sale-seg">
          <button type="button" className={paid ? "is-on" : ""} onClick={() => setPaid(true)}>
            Ya pagó
          </button>
          <button type="button" className={!paid ? "is-on" : ""} onClick={() => setPaid(false)}>
            {isLinkMethod(method) ? "Enviarle el enlace" : "Queda por cobrar"}
          </button>
        </div>

        {paid ? (
          <div className="sale-card">
            <Field
              label={
                method === "transferencia"
                  ? "Comprobante o referencia (opcional)"
                  : method === "efectivo"
                    ? "Nota del pago (opcional)"
                    : "Número de aprobación (opcional)"
              }
            >
              <input value={reference} onChange={(event) => setReference(event.target.value)} autoComplete="off" />
            </Field>
          </div>
        ) : null}
        <p className="sale-note">
          {paid
            ? "El pedido queda pagado, descuenta stock y pasa a despacho."
            : link
              ? method === "addi"
                ? `Te damos un enlace para que pague a cuotas con Addi. Al pagar, el pedido se confirma solo. La pieza se aparta cuando el cliente abre el pago, no antes. El enlace dura ${MANUAL_PENDING_HOURS} h.`
                : `Te damos un enlace para que pague con tarjeta, PSE o Nequi. Al pagar, el pedido se confirma solo. La pieza se aparta cuando el cliente abre el pago, no antes. El enlace dura ${MANUAL_PENDING_HOURS} h.`
              : `Queda en «Esperando pago» con el stock apartado ${MANUAL_PENDING_HOURS} h. Cuando entre el dinero, confírmalo en el pedido.`}
        </p>

        <label className={`sale-check is-card ${context && !context.invoice ? "is-off" : ""}`}>
          <input
            type="checkbox"
            checked={invoice}
            disabled={Boolean(context && !context.invoice)}
            onChange={(event) => setInvoice(event.target.checked)}
          />
          <span>
            Factura electrónica
            <small>
              {context && !context.invoice
                ? "La facturación no está configurada."
                : paid
                  ? "Se emite al registrar y le llega al correo. Pide documento y correo."
                  : "Se emite sola cuando entre el pago. Pide documento y correo."}
            </small>
          </span>
        </label>

        <div className="sale-card sale-grid">
          <Field
            label={
              promo
                ? `Descuento en pesos (${promo.label} ya descuenta ${promo.percent} %)`
                : "Descuento en pesos (opcional)"
            }
          >
            <input
              value={discount ? Number(digits(discount)).toLocaleString("es-CO") : ""}
              onChange={(event) => setDiscount(digits(event.target.value))}
              inputMode="numeric"
              placeholder="0"
              autoComplete="off"
            />
          </Field>
          <Field label="Nota interna (opcional)">
            <input value={notes} onChange={(event) => setNotes(event.target.value)} autoComplete="off" />
          </Field>
        </div>
      </Step>
    </SaleShell>
  );
}

function SaleShell({
  title,
  onClose,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="sale-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sale-sheet">
        <header className="sale-head">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} className="sale-close">
            Cerrar
          </button>
        </header>
        <div className="sale-body">{children}</div>
        {footer ? <footer className="sale-foot">{footer}</footer> : null}
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="sale-step">
      <h3>
        <span aria-hidden>{n}</span>
        {title}
      </h3>
      {hint ? <p className="sale-hint">{hint}</p> : null}
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="sale-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SaleDone({
  created,
  copied,
  onCopy,
  onAnother,
  onClose,
}: {
  created: Created;
  copied: boolean;
  onCopy: () => void;
  onAnother: () => void;
  onClose: () => void;
}) {
  const { order, payUrl } = created;
  const isPaid = order.status !== "awaiting_payment";
  const email = order.customer.email;
  const invoiceAsked = Boolean(order.meta?.invoiceRequested);
  const invoice = order.invoice;
  const pieces = cartCount(order.items);
  const onlyCases = order.items.every(isCaseLine);
  const shareText = `Hola ${order.customer.firstName}, este es el enlace para pagar tu pedido ${order.orderNumber} de Mora Ring: ${payUrl ?? ""}`;

  return (
    <div className="sale-done">
      <p className="sale-done-kicker">{isPaid ? "Pagado" : "Esperando pago"}</p>
      <p className="sale-done-number">{order.orderNumber}</p>
      <p className="sale-done-total">
        {formatMoney(order.totals.total)} · {pieces} {pieces === 1 ? (onlyCases ? "case" : "pieza") : "piezas"} ·{" "}
        {MANUAL_PAY_LABEL[order.payment.method as ManualPayMethod] ?? order.payment.method}
      </p>

      <ul className="sale-done-list">
        {isPaid ? (
          <li>
            {email
              ? `Le enviamos la confirmación a ${email}.`
              : "Sin correo: no le llega confirmación. Compártele el número de pedido."}
          </li>
        ) : payUrl ? (
          <li>Cuando pague desde el enlace, el pedido se confirma solo y le llega el correo.</li>
        ) : (
          <li>
            Cuando entre el dinero, abre el pedido en «Esperando pago» y toca «Confirmar pago recibido». Ahí
            le llega el correo.
          </li>
        )}
        {invoiceAsked ? (
          <li>
            {invoice?.status === "success"
              ? `Factura ${invoice.prefix ?? ""}${invoice.documentNumber ?? ""} emitida. Le llega al correo.`
              : invoice?.status === "failed"
                ? `La factura no salió: ${invoice.error ?? "error de la DIAN"}. El pedido sí quedó registrado.`
                : isPaid
                  ? "La factura no se emitió. Revisa el pedido."
                  : "La factura se emite sola cuando entre el pago."}
          </li>
        ) : null}
        {!isPaid ? (
          payUrl ? (
            <li>
              La pieza no queda apartada: se aparta cuando abra el pago. Si alguien la compra antes, el enlace le
              avisa. El enlace dura {MANUAL_PENDING_HOURS} horas.
            </li>
          ) : (
            <li>El stock queda apartado {MANUAL_PENDING_HOURS} horas.</li>
          )
        ) : null}
      </ul>

      {payUrl ? (
        <div className="sale-link">
          <p>{payUrl}</p>
          <div>
            <button type="button" onClick={onCopy} className="admin-cta">
              {copied ? "Copiado" : "Copiar enlace"}
            </button>
            {digits(order.customer.phone).length >= 10 ? (
              <a
                href={whatsappUrl(order.customer.phone, shareText)}
                target="_blank"
                rel="noreferrer"
                className="order-soft-btn"
              >
                Enviar por WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="sale-done-actions">
        <button type="button" onClick={onAnother} className="order-soft-btn">
          Otra venta
        </button>
        <button type="button" onClick={onClose} className={payUrl ? "order-soft-btn" : "admin-cta"}>
          Listo
        </button>
      </div>
    </div>
  );
}
