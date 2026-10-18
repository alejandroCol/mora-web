"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { cartCount, discountOf, subtotalOf } from "@/commerce/cartMath";
import type { ShippingQuoteOption } from "@/commerce/types";
import { commerceLineLabel } from "@/commerce/sizing";
import { finishLabel, finishes, formatMoney, products } from "@/lib/catalog";
import { PRESALE } from "@/lib/presale";
import { useMoraStore } from "@/lib/store";
import type { BoldCheckoutSession } from "@/payments/types";
import { ColombiaFields, useDebounced } from "./ColombiaFields";
import { currentAttribution, track } from "@/growth/track";
import { loadBoldScript, useBoldCheckout } from "@/components/payments/useBoldCheckout";

const STEPS = [
  {
    label: "Tú",
    title: "Tus datos",
    whisper: "Nombre, correo y a dónde llega. El envío se cotiza al instante.",
    action: "Continuar al pago",
  },
  {
    label: "Pagar",
    title: "Revisa y paga",
    whisper: `${PRESALE.promise} Tarjeta, Nequi, PSE o Bancolombia.`,
    action: "Pagar",
  },
] as const;

type QuoteResponse = {
  ok: boolean;
  error?: string;
  envioCop?: number;
  fuente?: "envia" | "estatico";
  gratis?: boolean;
  seleccionada?: ShippingQuoteOption | null;
  opciones?: ShippingQuoteOption[];
};

type AppliedOffer = {
  code: string;
  kind: "percent" | "amount";
  value: number;
};

export function CheckoutFlow() {
  const {
    cart,
    draft,
    setDraft,
    clearCart,
    cartSessionId,
    offerCode,
    ensureCartSession,
    setOfferCode,
  } = useMoraStore();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [carrier, setCarrier] = useState<string>("");
  const [appliedOffer, setAppliedOffer] = useState<AppliedOffer | null>(null);
  const bold = useBoldCheckout();
  const checkoutTracked = useRef(false);
  const pendingPay = useRef<{ orderNumber: string; session: BoldCheckoutSession } | null>(
    null,
  );

  const subtotal = subtotalOf(cart);
  const piezas = cartCount(cart);
  const discount = appliedOffer ? discountOf(subtotal, appliedOffer) : 0;
  useEffect(() => {
    const session = ensureCartSession();
    const fromUrl = new URLSearchParams(window.location.search).get("oferta");
    if (fromUrl) setOfferCode(fromUrl);
    if (!session || cart.length === 0) return;
    void fetch("/api/checkout/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session,
        items: cart,
        customer: {
          firstName: draft.firstName,
          lastName: draft.lastName,
          email: draft.email,
          phone: draft.phone,
          documentType: draft.documentType,
          documentNumber: draft.documentNumber,
        },
        shipping: {
          departamento: draft.departamento,
          ciudad: draft.ciudad,
          direccion: draft.address,
          referencia: draft.referencia,
        },
      }),
    }).catch(() => undefined);
    // Solo al entrar al checkout; los cambios siguientes van por debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first landing snapshot
  }, [ensureCartSession, setOfferCode]);

  const draftSnap = useDebounced(
    JSON.stringify({
      sessionId: cartSessionId,
      items: cart,
      customer: {
        firstName: draft.firstName,
        lastName: draft.lastName,
        email: draft.email,
        phone: draft.phone,
        documentType: draft.documentType,
        documentNumber: draft.documentNumber,
      },
      shipping: {
        departamento: draft.departamento,
        ciudad: draft.ciudad,
        direccion: draft.address,
        referencia: draft.referencia,
      },
    }),
    700,
  );

  useEffect(() => {
    const body = JSON.parse(draftSnap) as {
      sessionId: string;
      items: typeof cart;
    };
    if (!body.sessionId || body.items.length === 0) return;
    void fetch("/api/checkout/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: draftSnap,
    }).catch(() => undefined);
  }, [draftSnap]);

  useEffect(() => {
    if (!offerCode && !cartSessionId) return;
    const params = new URLSearchParams();
    if (offerCode) params.set("code", offerCode);
    if (cartSessionId) params.set("session", cartSessionId);
    if (draft.email) params.set("email", draft.email);
    let cancelled = false;
    void fetch(`/api/checkout/offer?${params.toString()}`)
      .then(async (res) => (await res.json()) as { ok: boolean; offer?: AppliedOffer | null })
      .then((data) => {
        if (cancelled) return;
        if (data.offer) {
          setAppliedOffer(data.offer);
          if (data.offer.code !== offerCode) setOfferCode(data.offer.code);
        } else if (offerCode) {
          setAppliedOffer(null);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [offerCode, cartSessionId, draft.email, setOfferCode]);

  useEffect(() => {
    if (cart.length === 0 || checkoutTracked.current) return;
    checkoutTracked.current = true;
    track("InitiateCheckout", {
      content_ids: cart.map((line) => line.modelId),
      content_type: "product",
      value: subtotal,
      currency: "COP",
      num_items: piezas,
    });
  }, [cart, piezas, subtotal]);

  const destKey = useDebounced(
    JSON.stringify({
      departamento: draft.departamento,
      ciudad: draft.ciudad,
      direccion: draft.address,
      nombre: draft.firstName,
      telefono: draft.phone,
      subtotal,
      piezas,
    }),
    450,
  );

  useEffect(() => {
    const dest = JSON.parse(destKey) as {
      departamento: string;
      ciudad: string;
      direccion: string;
      nombre: string;
      telefono: string;
      subtotal: number;
      piezas: number;
    };
    if (!dest.departamento || !dest.ciudad || dest.direccion.trim().length < 8) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    void fetch("/api/shipping/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dest),
    })
      .then(async (res) => (await res.json()) as QuoteResponse)
      .then((data) => {
        if (cancelled) return;
        setQuote(data);
        const selected = data.seleccionada?.carrier ?? data.opciones?.[0]?.carrier ?? "";
        setCarrier(selected);
      })
      .catch(() => {
        if (!cancelled) setQuote({ ok: false, error: "No pudimos cotizar el envío." });
      });
    return () => {
      cancelled = true;
    };
  }, [destKey]);

  const cartKey = JSON.stringify(cart.map((line) => [line.key, line.qty]));
  useEffect(() => {
    pendingPay.current = null;
  }, [cartKey, destKey, carrier]);

  useEffect(() => {
    if (step === 1) void loadBoldScript().catch(() => undefined);
  }, [step]);

  const envioCop =
    quote?.opciones?.find((option) => option.carrier === carrier)?.totalPriceCop ??
    quote?.envioCop ??
    null;
  const total = subtotal + (envioCop ?? 0) - discount;

  function validateStep() {
    if (cart.length === 0) return "Añade un anillo antes de pagar.";
    if (step === 0) {
      if (!draft.firstName.trim() || !draft.email.trim() || !draft.phone.trim()) {
        return "Nombre, correo y teléfono.";
      }
      if (!draft.departamento || !draft.ciudad || draft.address.trim().length < 8) {
        return "Departamento, ciudad y una dirección completa.";
      }
      if (!quote?.ok) return quote?.error ?? "Estamos cotizando el envío.";
    }
    return "";
  }

  async function prepareCheckout() {
    const res = await fetch("/api/checkout/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart,
        customer: {
          firstName: draft.firstName,
          lastName: draft.lastName,
          email: draft.email,
          phone: draft.phone,
          documentType: draft.documentType,
          documentNumber: draft.documentNumber,
        },
        shipping: {
          departamento: draft.departamento,
          ciudad: draft.ciudad,
          direccion: draft.address,
          referencia: draft.referencia,
          carrier,
        },
        notes: draft.notes,
        attribution: currentAttribution(),
        sessionId: cartSessionId || ensureCartSession(),
        offerCode: appliedOffer?.code ?? offerCode,
      }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      error?: string;
      orderNumber?: string;
      session?: BoldCheckoutSession;
    };
    if (!data.ok || !data.session || !data.orderNumber) {
      throw new Error(data.error ?? "No pudimos iniciar el pago.");
    }
    const prepared = { orderNumber: data.orderNumber, session: data.session };
    pendingPay.current = prepared;
    return prepared;
  }

  async function pay() {
    setBusy(true);
    setError("");
    try {
      const prepared = pendingPay.current ?? (await prepareCheckout());
      await bold.pay(prepared.session);
      clearCart();
      setError("Si cierras el pago, pulsa Pagar otra vez.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "El pago no se completó.");
    } finally {
      setBusy(false);
    }
  }

  function onContinue(event: FormEvent) {
    event.preventDefault();
    const message = validateStep();
    if (message) {
      setError(message);
      return;
    }
    setError("");
    if (step < 1) {
      track(
        "Lead",
        { content_name: "Checkout", content_category: "checkout" },
        {
          email: draft.email,
          phone: draft.phone,
          firstName: draft.firstName,
        },
      );
      track("AddPaymentInfo", {
        value: total,
        currency: "COP",
        num_items: piezas,
      });
      setStep(1);
      return;
    }
    void pay();
  }

  const current = STEPS[step];

  if (cart.length === 0) {
    return (
      <div className="check-card px-6 py-10 text-center sm:px-10">
        <h1 className="title-name text-[2rem] text-[#1d1d1f]">Tu bolsa está vacía</h1>
        <p className="mt-3 text-[15px] leading-6 text-[#6e6e73]">
          Elige Pro o Ultra para reservar.
        </p>
        <Link href="/#coleccion" className="elegir-cta mt-8 inline-flex">
          Elegir un anillo
          <span aria-hidden className="elegir-cta-arrow">
            ›
          </span>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onContinue} className="w-full">
      <ol className="check-steps check-steps-2">
        {STEPS.map((item, index) => {
          const state = index === step ? "on" : index < step ? "done" : "wait";
          return (
            <li key={item.label}>
              <button
                type="button"
                onClick={() => {
                  if (index < step) setStep(index);
                }}
                className="check-step w-full"
              >
                <span className={`check-step-n check-step-n-${state}`}>{index + 1}</span>
                <span className={`check-step-l ${state === "on" ? "check-step-l-on" : ""}`}>
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 grid items-stretch gap-5 lg:grid-cols-2">
      <section className="check-card flex flex-col">
        <header className="border-b border-[rgba(22,20,31,0.06)] px-6 py-5">
          <h1 className="title-name text-[1.65rem] tracking-[-0.04em] text-[#1d1d1f]">
            {current.title}
          </h1>
          <p className="mt-1 text-[14px] leading-5 text-[#6e6e73]">{current.whisper}</p>
        </header>
        {step === 0 ? (
          <>
            <Field
              label="Nombre"
              autoComplete="given-name"
              value={draft.firstName}
              onChange={(value) => setDraft({ firstName: value })}
            />
            <Field
              label="Apellido"
              autoComplete="family-name"
              value={draft.lastName}
              onChange={(value) => setDraft({ lastName: value })}
            />
            <Field
              label="Correo"
              type="email"
              autoComplete="email"
              value={draft.email}
              onChange={(value) => setDraft({ email: value })}
            />
            <Field
              label="Teléfono"
              type="tel"
              autoComplete="tel"
              value={draft.phone}
              onChange={(value) => setDraft({ phone: value })}
            />
            <ColombiaFields
              departamento={draft.departamento}
              ciudad={draft.ciudad}
              onDepartamento={(value) => setDraft({ departamento: value, ciudad: "" })}
              onCiudad={(value) => setDraft({ ciudad: value })}
            />
            <Field
              label="Dirección"
              autoComplete="street-address"
              value={draft.address}
              onChange={(value) => setDraft({ address: value })}
            />
            <Field
              label="Apto / referencia"
              value={draft.referencia}
              onChange={(value) => setDraft({ referencia: value })}
              required={false}
            />
            <div className="check-field">
              <span>Envío</span>
              {quote?.ok && envioCop != null ? (
                quote.gratis ? (
                  <p className="text-[17px] tracking-[-0.022em] text-[#1d1d1f]">Gratis</p>
                ) : quote.opciones && quote.opciones.length > 0 ? (
                  <div className="mt-1 space-y-2">
                    {quote.opciones.map((option) => {
                      const active = option.carrier === carrier;
                      return (
                        <button
                          key={`${option.carrier}-${option.service}`}
                          type="button"
                          onClick={() => setCarrier(option.carrier)}
                          className={`check-ship ${active ? "check-ship-on" : ""}`}
                        >
                          <span>
                            <span className="block text-[15px] tracking-[-0.016em] text-[#1d1d1f]">
                              {option.carrierLabel}
                            </span>
                            {option.deliveryEstimate ? (
                              <span className="mt-0.5 block text-[12px] text-[#6e6e73]">
                                {option.deliveryEstimate}
                              </span>
                            ) : null}
                          </span>
                          <span className="text-[15px] tracking-[-0.016em] text-[#1d1d1f]">
                            {formatMoney(option.totalPriceCop)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[17px] tracking-[-0.022em] text-[#1d1d1f]">
                    {formatMoney(envioCop)}
                  </p>
                )
              ) : (
                <p className="text-[15px] leading-6 text-[#6e6e73]">
                  {quote?.error ?? "Completa el destino para ver el envío."}
                </p>
              )}
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <div className="px-5 py-5">
            <ul className="space-y-3">
              {cart.map((line) => {
                const model = products[line.modelId];
                return (
                  <li
                    key={line.key}
                    className="flex justify-between gap-4 text-[15px] tracking-[-0.016em] text-[#1d1d1f]"
                  >
                    <span>
                      {commerceLineLabel({
                        ...line,
                        name: `Mora ${model.name}`,
                        finishTitle: finishLabel(line.modelId, line.finishId),
                      })}
                    </span>
                    <span className="shrink-0">
                      {formatMoney(model.price * line.qty)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex justify-between text-[15px] text-[#6e6e73]">
              <span>Envío</span>
              <span>{envioCop === 0 ? "Gratis" : formatMoney(envioCop ?? 0)}</span>
            </div>
            {discount > 0 ? (
              <div className="mt-2 flex justify-between text-[15px] text-[#6e6e73]">
                <span>Descuento{appliedOffer ? ` · ${appliedOffer.code}` : ""}</span>
                <span>−{formatMoney(discount)}</span>
              </div>
            ) : null}
            <div className="mt-2 flex justify-between text-[17px] tracking-[-0.022em] text-[#1d1d1f]">
              <span>Total</span>
              <span>{formatMoney(total)}</span>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="px-6 pt-3 text-[13px] leading-5 text-[#6e6e73]">{error}</p>
        ) : null}

        <footer className="mt-auto flex items-center gap-4 border-t border-[rgba(22,20,31,0.06)] p-4">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="shrink-0 px-2 text-[15px] tracking-[-0.016em] text-[#6e6e73] hover:text-[#1d1d1f]"
            >
              Atrás
            </button>
          ) : null}
          <button type="submit" disabled={busy} className="elegir-cta min-w-0 flex-1">
            {busy ? "Abriendo el pago…" : current.action}
          </button>
        </footer>
      </section>

      <aside className="check-card hidden flex-col px-6 py-5 lg:flex">
        <h2 className="title-name text-[1.65rem] tracking-[-0.04em] text-[#1d1d1f]">
          Tu pedido
        </h2>
        <ul className="mt-5 flex-1 space-y-4">
          {cart.map((line) => {
            const model = products[line.modelId];
            const finish = finishes[line.finishId];
            return (
              <li key={line.key} className="flex items-start gap-3">
                <span
                  className="mt-0.5 h-8 w-8 shrink-0 rounded-full"
                  style={{ background: finish.swatch }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 text-[14px] leading-5 tracking-[-0.014em] text-[#1d1d1f]">
                  {commerceLineLabel({
                    ...line,
                    name: `Mora ${model.name}`,
                    finishTitle: finishLabel(line.modelId, line.finishId),
                  })}
                </span>
                <span className="shrink-0 text-[14px] tracking-[-0.016em] text-[#1d1d1f]">
                  {formatMoney(model.price * line.qty)}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-5 border-t border-[rgba(22,20,31,0.06)] pt-4">
          <div className="flex justify-between text-[14px] text-[#6e6e73]">
            <span>Subtotal</span>
            <span className="text-[#1d1d1f]">{formatMoney(subtotal)}</span>
          </div>
          <div className="mt-2 flex justify-between text-[14px] text-[#6e6e73]">
            <span>Envío</span>
            <span className="text-[#1d1d1f]">
              {quote?.error
                ? quote.error
                : envioCop === 0
                  ? "Gratis"
                  : envioCop == null
                    ? "Al completar el destino"
                    : formatMoney(envioCop)}
            </span>
          </div>
          {discount > 0 ? (
            <div className="mt-2 flex justify-between text-[14px] text-[#6e6e73]">
              <span>Descuento{appliedOffer ? ` · ${appliedOffer.code}` : ""}</span>
              <span className="text-[#1d1d1f]">−{formatMoney(discount)}</span>
            </div>
          ) : null}
          <div className="mt-3 flex justify-between text-[17px] tracking-[-0.022em] text-[#1d1d1f]">
            <span>Total</span>
            <span>
              {formatMoney(
                envioCop == null ? Math.max(0, subtotal - discount) : total,
              )}
            </span>
          </div>
          <p className="mt-3 text-[12px] leading-5 text-[#6e6e73]">
            Entrega el {PRESALE.deliveryLabel}
          </p>
        </div>
      </aside>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="check-field">
      <span>{label}</span>
      <input
        required={required}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
