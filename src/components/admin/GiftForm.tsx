"use client";

import { useEffect, useMemo, useState } from "react";
import { CASE_COLOR_LIST, CASE_PRODUCT, caseLineKey, type CaseColorId } from "@/lib/cases";
import {
  GIFT_MAX_PER_LINE,
  giftPieces,
  type GiftChat,
  type GiftContext,
  type GiftRecord,
  type GiftRequest,
} from "@/commerce/gifts";
import { lineSwatch, lineUnitPrice } from "@/commerce/lines";
import { commerceLineLabel } from "@/commerce/sizing";
import { cartLineKey, stockSku } from "@/commerce/sku";
import type { CartLine } from "@/commerce/types";
import { CHANNEL_LABEL } from "@/crm/channel";
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

type ProductPick = ModelId | "case";
type Who = "chat" | "person";

const LOW_STOCK = 3;
const CHAT_RESULTS = 6;

function plain(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function GiftForm({
  onClose,
  onCreated,
  authorizedFetch,
  chat,
}: {
  onClose: () => void;
  /** El regalo quedó registrado. El formulario sigue abierto mostrando el resultado. */
  onCreated: (gift: GiftRecord) => void;
  authorizedFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  /** Abierto desde un chat del CRM: el destinatario ya está elegido. */
  chat?: Pick<GiftChat, "id" | "title" | "handle" | "channel">;
}) {
  const [context, setContext] = useState<GiftContext | null>(null);
  const [contextError, setContextError] = useState("");
  const [reload, setReload] = useState(0);

  // 1 · Piezas
  const [product, setProduct] = useState<ProductPick>("aero");
  const [finishId, setFinishId] = useState<FinishId>(products.aero.finishes[0]);
  const [caseColorId, setCaseColorId] = useState<CaseColorId>(CASE_PRODUCT.colors[0]);
  const [size, setSize] = useState<number | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);

  // 2 · Quién lo recibe
  const [who, setWho] = useState<Who>("chat");
  const [picked, setPicked] = useState<Pick<GiftChat, "id" | "title" | "handle" | "channel"> | null>(
    chat ?? null,
  );
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");

  // 3 · Nota
  const [note, setNote] = useState("");

  const [tried, setTried] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<GiftRecord | null>(null);

  useEffect(() => {
    let alive = true;
    authorizedFetch("/api/admin/gifts?context=1")
      .then((res) => res.json())
      .then((data: { ok?: boolean; context?: GiftContext; error?: string }) => {
        if (!alive) return;
        if (data.ok && data.context) {
          setContext(data.context);
          setContextError("");
        } else {
          setContextError(data.error || "No pudimos leer el inventario.");
        }
      })
      .catch(() => {
        if (alive) setContextError("No pudimos leer el inventario.");
      });
    return () => {
      alive = false;
    };
  }, [authorizedFetch, reload]);

  const isCase = product === "case";
  const model = isCase ? null : products[product];

  /** Unidades libres de una referencia, descontando lo que ya va en este regalo. */
  function left(sku: string | null) {
    // Sin inventario leído no se ofrece nada: un regalo siempre descuenta.
    if (!sku || !context) return 0;
    const inGift = lines.reduce((sum, line) => (stockSku(line) === sku ? sum + line.qty : sum), 0);
    return Math.max(0, (context.stock[sku] ?? 0) - inGift);
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

  const pieces = lines.reduce((sum, line) => sum + line.qty, 0);
  const value = lines.reduce((sum, line) => sum + lineUnitPrice(line) * line.qty, 0);

  const results = useMemo(() => {
    const chats = context?.chats ?? [];
    const q = plain(search.trim());
    const digits = q.replace(/\D/g, "");
    const matches = q
      ? chats.filter(
          (item) =>
            plain(item.title).includes(q) ||
            plain(item.handle).includes(q) ||
            (digits.length >= 4 && item.id.includes(digits)),
        )
      : // Sin búsqueda: primero los chats de creadores, que es a quienes más se les regala.
        [...chats].sort((a, b) => Number(b.creator) - Number(a.creator));
    return matches.slice(0, CHAT_RESULTS);
  }, [context, search]);

  const toChat = Boolean(chat) || who === "chat";

  const missing: string[] = [];
  if (lines.length === 0) missing.push("Añade al menos una pieza.");
  if (toChat && !picked) missing.push("Elige el chat de quien lo recibe.");
  if (!toChat && !name.trim()) missing.push("Escribe el nombre de quien lo recibe.");

  async function submit() {
    setTried(true);
    if (missing.length > 0 || busy) return;
    setBusy(true);
    setError("");
    const payload: GiftRequest = {
      items: lines,
      note: note.trim(),
      ...(toChat
        ? { conversationId: picked!.id }
        : { name: name.trim(), contact: contact.trim() }),
    };
    try {
      const res = await authorizedFetch("/api/admin/gifts", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; gift?: GiftRecord };
      if (!data.ok || !data.gift) throw new Error(data.error || "No se pudo registrar el regalo.");
      setCreated(data.gift);
      onCreated(data.gift);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el regalo.");
      // Otro pudo llevarse la pieza mientras tanto: volver a leer el stock.
      setReload((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setCreated(null);
    setLines([]);
    setSize(null);
    setNote("");
    setTried(false);
    setError("");
    if (!chat) {
      setPicked(null);
      setSearch("");
      setName("");
      setContact("");
    }
    // El stock cambió con el regalo anterior.
    setReload((n) => n + 1);
  }

  if (created) {
    const count = giftPieces(created);
    return (
      <Shell title="Regalo registrado" onClose={onClose}>
        <div className="sale-done">
          <p className="sale-done-kicker">Regalo para</p>
          <p className="sale-done-number">{created.recipient.name}</p>
          <p className="sale-done-total">
            {count} {count === 1 ? "pieza" : "piezas"} · valor comercial {formatMoney(created.valueCop)}
          </p>
          <ul className="sale-done-list">
            {created.items.map((item) => (
              <li key={item.key}>{commerceLineLabel(item)}</li>
            ))}
            <li>Ya se descontó del inventario. No cuenta como venta ni como ingreso.</li>
            {created.recipient.conversationId ? <li>Quedó ligado a su chat del CRM.</li> : null}
          </ul>
          <div className="sale-done-actions">
            <button type="button" onClick={startOver} className="order-soft-btn">
              Otro regalo
            </button>
            <button type="button" onClick={onClose} className="admin-cta">
              Listo
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      title="Nuevo regalo"
      onClose={onClose}
      footer={
        <>
          <dl className="sale-totals">
            <div>
              <dt>Piezas</dt>
              <dd>{pieces}</dd>
            </div>
            <div>
              <dt>Valor comercial</dt>
              <dd>{formatMoney(value)}</dd>
            </div>
            <div>
              <dt>Se cobra</dt>
              <dd>{formatMoney(0)}</dd>
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
            disabled={busy || lines.length === 0}
            onClick={() => void submit()}
            className="admin-cta sale-cta"
          >
            {busy ? <span className="btn-spin" aria-hidden /> : null}
            {busy
              ? "Guardando…"
              : pieces > 0
                ? `Registrar regalo · ${pieces} ${pieces === 1 ? "pieza" : "piezas"}`
                : "Registrar regalo"}
          </button>
        </>
      }
    >
      <Step n={1} title="Qué regalas" hint="Sale del inventario al registrar. Solo aparece lo que hay en stock.">
        {contextError ? (
          <p className="sale-error" role="alert">
            {contextError}{" "}
            <button type="button" className="underline" onClick={() => setReload((n) => n + 1)}>
              Reintentar
            </button>
          </p>
        ) : null}
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
                    className={`sale-swatch ${caseColorId === item.id ? "is-on" : ""} ${context && free < 1 ? "is-out" : ""}`}
                    aria-pressed={caseColorId === item.id}
                    title={context && free < 1 ? `${item.title} · agotado` : item.title}
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
                    setSize(null);
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
                    title={context && free < 1 ? "Agotada" : undefined}
                  >
                    {item}
                    {free >= 1 && free <= LOW_STOCK ? <small>quedan {free}</small> : null}
                    {context && free < 1 ? <small>agotada</small> : null}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        <button type="button" onClick={addLine} disabled={!draft || draftLeft < 1} className="sale-add">
          {!context && !contextError
            ? "Leyendo inventario…"
            : !draft
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
                    <small>Valor {formatMoney(lineUnitPrice(line) * line.qty)}</small>
                  </span>
                  <span className="sale-qty">
                    <button type="button" onClick={() => changeQty(line.key, -1)} aria-label="Quitar uno">
                      −
                    </button>
                    <output>{line.qty}</output>
                    <button
                      type="button"
                      onClick={() => changeQty(line.key, 1)}
                      disabled={more < 1 || line.qty >= GIFT_MAX_PER_LINE}
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

      <Step n={2} title="Quién lo recibe">
        {chat ? null : (
          <div className="sale-seg">
            <button type="button" className={who === "chat" ? "is-on" : ""} onClick={() => setWho("chat")}>
              Chat del CRM
            </button>
            <button type="button" className={who === "person" ? "is-on" : ""} onClick={() => setWho("person")}>
              Otra persona
            </button>
          </div>
        )}

        {toChat ? (
          picked ? (
            <div className="gift-picked">
              <span>
                {picked.title}
                <small>{[CHANNEL_LABEL[picked.channel], picked.handle].filter(Boolean).join(" · ")}</small>
              </span>
              {chat ? null : (
                <button type="button" onClick={() => setPicked(null)}>
                  Cambiar
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="sale-card">
                <label className="sale-field">
                  <span>Buscar chat</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Nombre, @usuario o teléfono"
                    autoComplete="off"
                  />
                </label>
              </div>
              {results.length > 0 ? (
                <ul className="gift-chats">
                  {results.map((item) => (
                    <li key={item.id}>
                      <button type="button" onClick={() => setPicked(item)}>
                        <span>
                          {item.title}
                          <small>
                            {[CHANNEL_LABEL[item.channel], item.handle, item.creator ? "Creadores" : ""]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </span>
                        <b>Elegir</b>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sale-note">
                  {!context
                    ? "Cargando chats…"
                    : search.trim()
                      ? "Ningún chat coincide. Si no tiene chat, usa «Otra persona»."
                      : "Aún no hay chats. Usa «Otra persona»."}
                </p>
              )}
            </>
          )
        ) : (
          <div className="sale-card sale-grid">
            <label className="sale-field">
              <span>Nombre</span>
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
            </label>
            <label className="sale-field">
              <span>@usuario o teléfono (opcional)</span>
              <input
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                autoCapitalize="none"
                autoComplete="off"
              />
            </label>
          </div>
        )}
      </Step>

      <Step n={3} title="Nota" hint="Opcional. Por qué se regaló o qué se acordó.">
        <div className="sale-card">
          <label className="sale-field">
            <span>Nota interna</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={280}
              placeholder="Ej.: video de unboxing en noviembre"
              autoComplete="off"
            />
          </label>
        </div>
      </Step>
    </Shell>
  );
}

function Shell({
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
