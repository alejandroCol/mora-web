"use client";

import Link from "next/link";
import {
  type FormEvent,
  type InputHTMLAttributes,
  useEffect,
  useRef,
  useState,
} from "react";
import { cartCount, discountOf, subtotalOf } from "@/commerce/cartMath";
import type { CartLine, ShippingQuoteOption } from "@/commerce/types";
import { formatoDepartamentoEtiqueta } from "@/lib/colombiaGeo";
import { cartCountLabel, cartHasRing, isRingLine, lineUnitPrice } from "@/commerce/lines";
import { formatMoney, isModelId, products } from "@/lib/catalog";
import { useSales } from "@/components/sales/SalesProvider";
import { useMoraStore } from "@/lib/store";
import type { AddiCheckoutSession, BoldCheckoutSession, CheckoutPayMethod } from "@/payments/types";
import { addiAmountAllowed, checkoutPrefersAddi } from "@/payments/public";
import { loadPayMethods } from "@/payments/methodsClient";
import { CaseOffer, noteCaseOfferPay } from "@/components/cart/CaseOffer";
import { CartLineVisual } from "@/components/cart/CartLineVisual";
import { FreeShipping } from "@/components/product/FreeShipping";
import { AddiMark } from "@/components/payments/AddiMark";
import { ColombiaFields, useDebounced } from "./ColombiaFields";
import { currentAttribution, track } from "@/growth/track";
import { insightFunnel, insightProductCheckout } from "@/insights/client";
import { PaymentAwaiting } from "@/components/payments/PaymentAwaiting";
import {
  clearPendingPay,
  readPendingPay,
  writePendingPay,
  type PendingPay,
} from "@/components/payments/pendingPay";
import { loadBoldScript, useBoldCheckout } from "@/components/payments/useBoldCheckout";

type PreparedPay =
  | { method: "bold"; orderNumber: string; session: BoldCheckoutSession }
  | { method: "addi"; orderNumber: string; session: AddiCheckoutSession };

type GatewayAvailability = {
  bold: boolean;
  addi: boolean;
  minCop: number;
  maxCop: number;
};

const CHECKOUT_STEP_KEY = "mora-checkout-step";

const STEPS = [
  {
    label: "Tú",
    title: "Tus datos",
    whisper: "Para el pedido y avisarte cuando salga.",
    action: "Continuar",
  },
  {
    label: "Envío",
    title: "A dónde llega",
    whisper: "Cotizamos el envío al instante en Colombia.",
    action: "Continuar",
  },
  {
    label: "Pagar",
    title: "Revisa y paga",
    whisper: "Un último vistazo antes de pagar.",
    action: "Pagar",
  },
] as const;

type QuoteResponse = {
  ok: boolean;
  error?: string;
  envioCop?: number;
  fuente?: "heka" | "envia" | "estatico";
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
  const sales = useSales();
  const {
    cart,
    draft,
    setDraft,
    clearCart,
    closeCart,
    cartSessionId,
    offerCode,
    ensureCartSession,
    setOfferCode,
  } = useMoraStore();
  const [step, setStep] = useState(0);
  const [stepReady, setStepReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [carrier, setCarrier] = useState<string>("");
  const [appliedOffer, setAppliedOffer] = useState<AppliedOffer | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<CheckoutPayMethod>("bold");
  const [gateways, setGateways] = useState<GatewayAvailability>({
    bold: true,
    addi: false,
    minCop: 50_000,
    maxCop: 3_000_000,
  });
  const bold = useBoldCheckout();
  const checkoutTracked = useRef(false);
  const pendingPay = useRef<PreparedPay | null>(null);
  const [awaiting, setAwaiting] = useState<PendingPay | null>(() => {
    const pending = readPendingPay();
    if (pending && useMoraStore.getState().cart.length > 0) {
      clearPendingPay();
      return null;
    }
    return pending;
  });

  const subtotal = subtotalOf(cart);
  const piezas = cartCount(cart);
  const freeShip = cartHasRing(cart);
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
    insightFunnel("checkout");
    for (const line of cart) {
      const name = isModelId(line.modelId)
        ? products[line.modelId].name
        : "Case";
      insightProductCheckout(line.modelId, name);
    }
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
      conAnillo: freeShip,
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
      conAnillo: boolean;
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
  }, [cartKey, destKey, carrier, payMethod]);

  useEffect(() => {
    const hinted = checkoutPrefersAddi(window.location.search);
    let cancelled = false;
    void loadPayMethods().then((next) => {
      if (cancelled) return;
      setGateways(next);
      if ((hinted || !next.bold) && next.addi) setPayMethod("addi");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const saved = Number(sessionStorage.getItem(CHECKOUT_STEP_KEY));
    if (saved === 1 || saved === 2) setStep(saved);
    setStepReady(true);
  }, []);

  useEffect(() => {
    if (!stepReady) return;
    sessionStorage.setItem(CHECKOUT_STEP_KEY, String(step));
  }, [step, stepReady]);

  useEffect(() => {
    if (step === 2 && payMethod === "bold") void loadBoldScript().catch(() => undefined);
  }, [step, payMethod]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const envioCop = freeShip
    ? 0
    : (quote?.opciones?.find((option) => option.carrier === carrier)?.totalPriceCop ??
      quote?.envioCop ??
      null);
  const quoteError = freeShip ? undefined : quote?.error;
  const total = subtotal + (envioCop ?? 0) - discount;
  const shownTotal = envioCop == null ? Math.max(0, subtotal - discount) : total;
  const addiReady =
    gateways.addi &&
    (cart.some((line) => isRingLine(line)) ||
      addiAmountAllowed(shownTotal, gateways.minCop, gateways.maxCop));

  useEffect(() => {
    if (payMethod !== "addi" || addiReady || !gateways.bold) return;
    setPayMethod("bold");
  }, [payMethod, addiReady, gateways.bold]);

  function goTo(index: number) {
    if (index < step) {
      setError("");
      setStep(index);
    }
  }

  function validateStep() {
    if (cart.length === 0) return "Añade un anillo antes de pagar.";
    if (step === 0) {
      if (!draft.firstName.trim() || !draft.email.trim() || !draft.phone.trim()) {
        return "Nombre, correo y teléfono.";
      }
      if (!draft.documentNumber?.replace(/\D/g, "")) {
        return "Cédula o NIT para la factura.";
      }
    }
    if (step === 1) {
      if (!draft.departamento || !draft.ciudad || draft.address.trim().length < 8) {
        return "Departamento, ciudad y una dirección completa.";
      }
      if (!freeShip && !quote?.ok) return quote?.error ?? "Estamos cotizando el envío.";
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
        method: payMethod,
      }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      error?: string;
      method?: CheckoutPayMethod;
      orderNumber?: string;
      session?: BoldCheckoutSession | AddiCheckoutSession;
      redirectUrl?: string;
      reference?: string;
    };
    if (!data.ok || !data.orderNumber) {
      throw new Error(data.error ?? "No pudimos iniciar el pago.");
    }
    if (payMethod === "addi") {
      const redirectUrl =
        data.redirectUrl ??
        (data.session && "redirectUrl" in data.session ? data.session.redirectUrl : "");
      if (!redirectUrl) throw new Error(data.error ?? "Addi no abrió las cuotas.");
      const prepared: PreparedPay = {
        method: "addi",
        orderNumber: data.orderNumber,
        session: {
          reference: data.reference ?? data.session?.reference ?? "",
          amountCop: shownTotal,
          currency: "COP",
          purpose: "order",
          redirectPath: `/pedido/${data.orderNumber}`,
          redirectUrl,
          metadata: {},
        },
      };
      pendingPay.current = prepared;
      return prepared;
    }
    if (!data.session || !("checkout" in data.session)) {
      throw new Error(data.error ?? "No pudimos iniciar el pago.");
    }
    const prepared: PreparedPay = {
      method: "bold",
      orderNumber: data.orderNumber,
      session: data.session,
    };
    pendingPay.current = prepared;
    return prepared;
  }

  async function pay() {
    setBusy(true);
    setError("");
    try {
      const prepared = pendingPay.current ?? (await prepareCheckout());
      if (prepared.method === "addi") {
        clearCart();
        window.location.assign(prepared.session.redirectUrl);
        return;
      }
      await bold.pay(prepared.session);
      const next: PendingPay = {
        orderNumber: prepared.orderNumber,
        reference: prepared.session.reference,
        session: prepared.session,
      };
      writePendingPay(next);
      setAwaiting(next);
      closeCart();
      clearCart();
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
    if (step === 0) {
      track(
        "Lead",
        { content_name: "Checkout", content_category: "checkout" },
        {
          email: draft.email,
          phone: draft.phone,
          firstName: draft.firstName,
        },
      );
      insightFunnel("info");
      setStep(1);
      return;
    }
    if (step === 1) {
      track("AddPaymentInfo", {
        value: total,
        currency: "COP",
        num_items: piezas,
      });
      insightFunnel("shipping");
      setStep(2);
      return;
    }
    insightFunnel("pay");
    noteCaseOfferPay();
    void pay();
  }

  const current = STEPS[step];
  const fullName = [draft.firstName, draft.lastName].filter(Boolean).join(" ");
  const payNote = payMethod === "addi" && addiReady ? sales.payNoteAddi : sales.payNote;
  const viaAddi = step === 2 && payMethod === "addi" && addiReady;

  if (awaiting) {
    return <PaymentAwaiting pending={awaiting} onPending={setAwaiting} />;
  }

  if (cart.length === 0) {
    return (
      <div className="check-card px-6 py-10 text-center sm:px-10">
        <h1 className="title-name text-[2rem] text-[#1d1d1f]">Tu bolsa está vacía</h1>
        <p className="mt-3 text-[15px] leading-6 text-[#6e6e73]">
          {sales.emptyCart}
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
    <form onSubmit={onContinue} className="check-flow">
      <div className="check-top sm:pt-3">
        <Link
          href="/#coleccion"
          className="text-[13px] tracking-[-0.01em] text-[#6e6e73] hover:text-[#1d1d1f]"
        >
          ← Seguir eligiendo
        </Link>
        <button
          type="button"
          className="check-bag-toggle lg:hidden"
          onClick={() => setBagOpen((open) => !open)}
          aria-expanded={bagOpen}
        >
          <span>
            {cartCountLabel(piezas, cart)}
          </span>
          <span className="check-bag-toggle-sum">
            {formatMoney(shownTotal)}
            <span aria-hidden className="check-bag-caret">
              {bagOpen ? "⌃" : "⌄"}
            </span>
          </span>
        </button>
      </div>

      {bagOpen ? (
        <div className="check-card check-bag-panel lg:hidden">
          <OrderLines cart={cart} />
          <Totals
            subtotal={subtotal}
            envioCop={envioCop}
            quoteError={quoteError}
            discount={discount}
            offerCode={appliedOffer?.code}
            total={shownTotal}
          />
        </div>
      ) : null}

      <ol className="check-steps">
        {STEPS.map((item, index) => {
          const state = index === step ? "on" : index < step ? "done" : "wait";
          return (
            <li key={item.label} className="check-step-item">
              {index > 0 ? (
                <span
                  className={`check-step-rail ${index <= step ? "check-step-rail-on" : ""}`}
                  aria-hidden
                />
              ) : null}
              <button
                type="button"
                onClick={() => goTo(index)}
                className="check-step w-full"
                aria-current={state === "on" ? "step" : undefined}
              >
                <span className={`check-step-n check-step-n-${state}`}>
                  {state === "done" ? "✓" : index + 1}
                </span>
                <span className={`check-step-l ${state === "on" ? "check-step-l-on" : ""}`}>
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 grid items-start gap-5 lg:mt-6 lg:grid-cols-2">
        <section className="check-card">
          <header className="px-5 pb-1 pt-5 sm:px-6 sm:pt-6">
            <h1 className="title-name text-[1.55rem] tracking-[-0.04em] text-[#1d1d1f] sm:text-[1.65rem]">
              {current.title}
            </h1>
            <p className="mt-1 text-[13px] leading-5 text-[#6e6e73] sm:text-[14px]">
              {step === 1 && freeShip ? "El envío va por nuestra cuenta." : current.whisper}
            </p>
          </header>

          {step === 0 ? (
            <>
              <div className="check-pair">
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
              </div>
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
                inputMode="tel"
                value={draft.phone}
                onChange={(value) => setDraft({ phone: value })}
              />
              <div className="check-pair">
                <label className="check-field">
                  <span>Documento</span>
                  <select
                    required
                    value={draft.documentType ?? "CC"}
                    onChange={(event) => setDraft({ documentType: event.target.value })}
                    className="appearance-none bg-transparent"
                  >
                    <option value="CC">Cédula</option>
                    <option value="CE">Cédula extranjería</option>
                    <option value="NIT">NIT</option>
                    <option value="TI">Tarjeta de identidad</option>
                    <option value="PA">Pasaporte</option>
                  </select>
                </label>
                <Field
                  label="Número"
                  autoComplete="off"
                  inputMode="numeric"
                  value={draft.documentNumber ?? ""}
                  onChange={(value) => setDraft({ documentNumber: value })}
                />
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
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
                {freeShip ? (
                  <FreeShipping detail="a toda Colombia" className="mt-1.5 self-start" />
                ) : quote?.ok && envioCop != null ? (
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

          {step === 2 ? (
            <div>
              <button type="button" className="check-recap" onClick={() => goTo(0)}>
                <span>
                  <span className="check-recap-k">Tú</span>
                  <span className="check-recap-v">{fullName || "Nombre"}</span>
                  <span className="check-recap-s">
                    {draft.email}
                    {draft.documentNumber
                      ? ` · ${draft.documentType ?? "CC"} ${draft.documentNumber}`
                      : ""}
                  </span>
                </span>
                <span className="check-recap-edit">Editar</span>
              </button>
              <button type="button" className="check-recap" onClick={() => goTo(1)}>
                <span>
                  <span className="check-recap-k">Envío</span>
                  <span className="check-recap-v">
                    {draft.ciudad
                      ? draft.ciudad === draft.departamento
                        ? formatoDepartamentoEtiqueta(draft.ciudad)
                        : `${formatoDepartamentoEtiqueta(draft.ciudad)}, ${formatoDepartamentoEtiqueta(draft.departamento)}`
                      : "Destino"}
                  </span>
                  <span className="check-recap-s">{draft.address}</span>
                </span>
                <span className="check-recap-edit">Editar</span>
              </button>
              <div className="px-5 py-4 sm:px-6">
                <OrderLines cart={cart} />
                <Totals
                  subtotal={subtotal}
                  envioCop={envioCop}
                  quoteError={quoteError}
                  discount={discount}
                  offerCode={appliedOffer?.code}
                  total={shownTotal}
                />
                {addiReady ? (
                  <div className="mt-5">
                    <p className="text-[12px] tracking-[-0.01em] text-[#6e6e73]">Pago</p>
                    <div className="mt-2 space-y-2">
                      {gateways.bold ? (
                        <button
                          type="button"
                          onClick={() => setPayMethod("bold")}
                          className={`check-ship ${payMethod === "bold" ? "check-ship-on" : ""}`}
                        >
                          <span>
                            <span className="block text-[15px] tracking-[-0.016em] text-[#1d1d1f]">
                              Pagar ahora
                            </span>
                            <span className="mt-0.5 block text-[12px] text-[#6e6e73]">
                              Tarjeta, Nequi, PSE o Bancolombia
                            </span>
                          </span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setPayMethod("addi")}
                        className={`check-ship ${payMethod === "addi" ? "check-ship-on" : ""}`}
                      >
                        <span>
                          <span className="block text-[15px] tracking-[-0.016em] text-[#1d1d1f]">
                            Pagar con Addi
                          </span>
                          <span className="mt-0.5 block text-[12px] text-[#6e6e73]">
                            En cuotas, con cédula. Sin tarjeta de crédito.
                          </span>
                        </span>
                        <AddiMark />
                      </button>
                    </div>
                  </div>
                ) : null}
                {payNote ? (
                  <p className="mt-4 text-[12px] leading-5 text-[#6e6e73]">{payNote}</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        <div className="hidden lg:sticky lg:top-24 lg:flex lg:flex-col lg:gap-4">
          <aside className="check-card flex flex-col px-6 py-5">
            <h2 className="title-name text-[1.65rem] tracking-[-0.04em] text-[#1d1d1f]">
              Tu pedido
            </h2>
            <div className="mt-5 flex-1">
              <OrderLines cart={cart} />
            </div>
            <Totals
              subtotal={subtotal}
              envioCop={envioCop}
              quoteError={quoteError}
              discount={discount}
              offerCode={appliedOffer?.code}
              total={shownTotal}
            />
            {sales.orderNote ? (
              <p className="mt-3 text-[12px] leading-5 text-[#6e6e73]">{sales.orderNote}</p>
            ) : null}
          </aside>
          {step === 2 ? (
            <CheckoutDock
              className="check-dock check-dock-aside"
              error={error}
              busy={busy}
              addi={viaAddi}
              busyLabel={payMethod === "addi" ? "Abriendo Addi…" : "Abriendo el pago…"}
              action={viaAddi ? "Continuar con Addi" : current.action}
              total={shownTotal}
              onBack={() => goTo(step - 1)}
            />
          ) : null}
        </div>
      </div>

      {step === 2 ? <CaseOffer /> : null}

      <CheckoutDock
        className={`check-dock ${step === 2 ? "lg:hidden" : ""}`}
        error={error}
        busy={busy}
        addi={viaAddi}
        busyLabel={payMethod === "addi" ? "Abriendo Addi…" : "Abriendo el pago…"}
        action={viaAddi ? "Continuar con Addi" : current.action}
        total={shownTotal}
        onBack={step > 0 ? () => goTo(step - 1) : undefined}
      />
    </form>
  );
}

function CheckoutDock({
  className,
  error,
  busy,
  addi,
  busyLabel,
  action,
  total,
  onBack,
}: {
  className: string;
  error: string;
  busy: boolean;
  addi: boolean;
  busyLabel: string;
  action: string;
  total: number;
  onBack?: () => void;
}) {
  return (
    <div className={className}>
      {error ? <p className="check-dock-error">{error}</p> : null}
      <div className="flex items-center gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 px-2 text-[15px] tracking-[-0.016em] text-[#6e6e73] hover:text-[#1d1d1f]"
          >
            Atrás
          </button>
        ) : null}
        <button type="submit" disabled={busy} className="elegir-cta min-w-0 flex-1">
          {busy ? busyLabel : action}
          {busy ? null : <span className="elegir-cta-note">{formatMoney(total)}</span>}
          {busy || !addi ? null : <AddiMark className="addi-mark-on-dark" />}
        </button>
      </div>
    </div>
  );
}

function OrderLines({ cart }: { cart: CartLine[] }) {
  return (
    <ul className="space-y-4">
      {cart.map((line) => {
        return (
          <li key={line.key}>
            <CartLineVisual
              line={line}
              price={formatMoney(lineUnitPrice(line) * line.qty)}
              compact
            />
          </li>
        );
      })}
    </ul>
  );
}

function Totals({
  subtotal,
  envioCop,
  quoteError,
  discount,
  offerCode,
  total,
}: {
  subtotal: number;
  envioCop: number | null;
  quoteError?: string;
  discount: number;
  offerCode?: string;
  total: number;
}) {
  return (
    <div className="check-totals mt-4 border-t border-[rgba(22,20,31,0.06)] pt-4">
      <div className="flex justify-between text-[14px] text-[#6e6e73]">
        <span>Subtotal</span>
        <span className="text-[#1d1d1f]">{formatMoney(subtotal)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-[14px] text-[#6e6e73]">
        <span>Envío</span>
        <span className="text-[#1d1d1f]">
          {quoteError
            ? quoteError
            : envioCop === 0
              ? <span className="ship-free ship-free-sm">Gratis</span>
              : envioCop == null
                ? "Al completar el destino"
                : formatMoney(envioCop)}
        </span>
      </div>
      {discount > 0 ? (
        <div className="mt-2 flex justify-between text-[14px] text-[#6e6e73]">
          <span>Descuento{offerCode ? ` · ${offerCode}` : ""}</span>
          <span className="text-[#1d1d1f]">−{formatMoney(discount)}</span>
        </div>
      ) : null}
      <div className="mt-3 flex justify-between text-[17px] tracking-[-0.022em] text-[#1d1d1f]">
        <span>Total</span>
        <span>{formatMoney(total)}</span>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  required = true,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="check-field">
      <span>{label}</span>
      <input
        required={required}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
