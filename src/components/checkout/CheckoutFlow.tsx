"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { cartCount, subtotalOf } from "@/commerce/cartMath";
import type { ShippingQuoteOption } from "@/commerce/types";
import { finishes, formatMoney, products } from "@/lib/catalog";
import { useMoraStore } from "@/lib/store";
import type { WompiWidgetConfig } from "@/commerce/wompi";
import { ColombiaFields, useDebounced } from "./ColombiaFields";
import { currentAttribution, track } from "@/growth/track";
import { useWompiWidget } from "./WompiPay";

const STEPS = ["Tú", "Destino", "Pagar"] as const;

type QuoteResponse = {
  ok: boolean;
  error?: string;
  envioCop?: number;
  fuente?: "envia" | "estatico";
  gratis?: boolean;
  seleccionada?: ShippingQuoteOption | null;
  opciones?: ShippingQuoteOption[];
};

export function CheckoutFlow() {
  const router = useRouter();
  const { cart, draft, setDraft, clearCart } = useMoraStore();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [carrier, setCarrier] = useState<string>("");
  const wompi = useWompiWidget();
  const checkoutTracked = useRef(false);

  const subtotal = subtotalOf(cart);
  const piezas = cartCount(cart);
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

  const envioCop =
    quote?.opciones?.find((option) => option.carrier === carrier)?.totalPriceCop ??
    quote?.envioCop ??
    null;
  const total = subtotal + (envioCop ?? 0);

  function validateStep() {
    if (cart.length === 0) return "Añade un anillo antes de pagar.";
    if (step === 0) {
      if (!draft.firstName.trim() || !draft.email.trim() || !draft.phone.trim()) {
        return "Nombre, correo y teléfono.";
      }
    }
    if (step === 1) {
      if (!draft.departamento || !draft.ciudad || draft.address.trim().length < 8) {
        return "Departamento, ciudad y una dirección completa.";
      }
      if (!quote?.ok) return quote?.error ?? "Estamos cotizando el envío.";
    }
    return "";
  }

  async function pay() {
    setBusy(true);
    setError("");
    try {
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
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        orderNumber?: string;
        widget?: WompiWidgetConfig;
      };
      if (!data.ok || !data.widget || !data.orderNumber) {
        throw new Error(data.error ?? "No pudimos iniciar Wompi.");
      }
      const tx = await wompi.open(data.widget);
      await fetch("/api/checkout/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: tx.id }),
      });
      clearCart();
      router.push(`/pedido/${data.orderNumber}`);
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
    if (step < 2) {
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
      }
      if (step === 1) {
        track("AddPaymentInfo", {
          value: total,
          currency: "COP",
          num_items: piezas,
        });
      }
      setStep(step + 1);
      return;
    }
    void pay();
  }

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-[22rem] text-center">
        <p className="text-[15px] text-soft">Tu bolsa está vacía.</p>
        <Link href="/#reservar" className="mt-6 inline-block text-[13px] text-ink">
          Elegir un anillo
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onContinue} className="mx-auto w-full max-w-[22rem] lg:mx-0 lg:max-w-none">
      <div className="flex justify-center gap-8">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              if (index < step) setStep(index);
            }}
            className="flex flex-col items-center gap-1.5"
          >
            <span
              className={`h-1 w-8 rounded-full ${index === step ? "bg-ink" : "bg-ink/12"}`}
            />
            <span
              className={`text-[10px] tracking-[0.12em] uppercase ${
                index === step ? "text-ink" : "text-soft/50"
              }`}
            >
              {label}
            </span>
          </button>
        ))}
      </div>

      <div className="reserve-sheet mt-6">
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
            {quote?.ok && envioCop != null ? (
              <div className="reserve-row">
                <span>Envío</span>
                {quote.gratis ? (
                  <p className="text-[15px] text-ink">Gratis</p>
                ) : quote.opciones && quote.opciones.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {quote.opciones.map((option) => {
                      const active = option.carrier === carrier;
                      return (
                        <button
                          key={`${option.carrier}-${option.service}`}
                          type="button"
                          onClick={() => setCarrier(option.carrier)}
                          className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-[13px] ${
                            active ? "bg-ink text-white" : "bg-white/70 text-ink"
                          }`}
                        >
                          <span>
                            {option.carrierLabel}
                            {option.deliveryEstimate ? (
                              <span className={active ? "block text-white/70" : "block text-soft"}>
                                {option.deliveryEstimate}
                              </span>
                            ) : null}
                          </span>
                          <span>{formatMoney(option.totalPriceCop)}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[15px] text-ink">{formatMoney(envioCop)}</p>
                )}
              </div>
            ) : (
              <p className="reserve-row text-[13px] text-soft">
                {quote?.error ?? "El precio de envío aparece al completar el destino."}
              </p>
            )}
          </>
        ) : null}

        {step === 2 ? (
          <div className="px-5 py-5">
            <p className="kicker">Resumen</p>
            <ul className="mt-3 space-y-2">
              {cart.map((line) => {
                const model = products[line.modelId];
                const finish = finishes[line.finishId];
                return (
                  <li key={line.key} className="flex justify-between text-[13px] text-ink">
                    <span>
                      {model.name} · {finish.title} · #{line.size}
                      {line.qty > 1 ? ` ×${line.qty}` : ""}
                    </span>
                    <span>{formatMoney(model.price * line.qty)}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex justify-between text-[13px] text-soft">
              <span>Envío</span>
              <span>{envioCop === 0 ? "Gratis" : formatMoney(envioCop ?? 0)}</span>
            </div>
            <div className="mt-2 flex justify-between text-[15px] text-ink">
              <span>Total</span>
              <span>{formatMoney(total)}</span>
            </div>
            <p className="mt-4 text-[12px] leading-5 text-soft">
              Pagas en Wompi, en esta misma pantalla. Tarjeta, Nequi, PSE o Bancolombia.
            </p>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 text-center text-[12px] text-ink/60">{error}</p>
      ) : null}

      <div className="mt-6 flex items-center justify-center gap-6 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="text-[13px] text-soft hover:text-ink"
          >
            Atrás
          </button>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="h-11 min-w-[10.5rem] rounded-full bg-ink px-8 text-[13px] text-white transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {busy ? "Abriendo Wompi…" : step === 0 ? "Continuar" : step === 1 ? "Revisar" : "Pagar"}
        </button>
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
    <label className="reserve-row">
      <span>{label}</span>
      <input
        required={required}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="reserve-input"
      />
    </label>
  );
}
