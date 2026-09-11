"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useMoraStore } from "@/lib/store";

export function CheckoutForm() {
  const router = useRouter();
  const { draft, setDraft, placeOrder } = useMoraStore();
  const [step, setStep] = useState(0);
  const [noteOpen, setNoteOpen] = useState(Boolean(draft.notes));
  const [error, setError] = useState("");

  function onContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (step === 0) {
      if (!draft.firstName.trim() || !draft.email.trim() || !draft.phone.trim()) {
        setError("Nombre, correo y teléfono.");
        return;
      }
      setStep(1);
      return;
    }

    if (!draft.city.trim() || !draft.address.trim()) {
      setError("Ciudad y dirección.");
      return;
    }
    const order = placeOrder();
    router.push(`/pedido?ref=${order.id}`);
  }

  return (
    <form onSubmit={onContinue} className="mx-auto w-full max-w-[22rem] lg:mx-0">
      <div className="flex justify-center gap-8">
        {["Tú", "Envío"].map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              if (index < step) setStep(index);
            }}
            className="flex flex-col items-center gap-1.5"
          >
            <span
              className={`h-1 w-8 rounded-full ${
                index === step ? "bg-ink" : "bg-ink/12"
              }`}
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
              autoComplete="name"
              value={draft.firstName}
              onChange={(value) => setDraft({ firstName: value })}
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
        ) : (
          <>
            <Field
              label="Ciudad"
              autoComplete="address-level2"
              value={draft.city}
              onChange={(value) => setDraft({ city: value })}
            />
            <Field
              label="Dirección"
              autoComplete="street-address"
              value={draft.address}
              onChange={(value) => setDraft({ address: value })}
            />
            {noteOpen ? (
              <label className="reserve-row">
                <span>Nota</span>
                <textarea
                  rows={2}
                  value={draft.notes}
                  onChange={(event) => setDraft({ notes: event.target.value })}
                  className="reserve-input resize-none"
                />
              </label>
            ) : (
              <button
                type="button"
                onClick={() => setNoteOpen(true)}
                className="reserve-row text-left text-[13px] text-soft"
              >
                Añadir nota
              </button>
            )}
          </>
        )}
      </div>

      {error ? (
        <p className="mt-4 text-center text-[12px] text-ink/60">{error}</p>
      ) : null}

      <div className="mt-6 flex items-center justify-center gap-6 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        {step === 1 ? (
          <button
            type="button"
            onClick={() => setStep(0)}
            className="text-[13px] text-soft hover:text-ink"
          >
            Atrás
          </button>
        ) : null}
        <button
          type="submit"
          className="h-11 min-w-[10.5rem] rounded-full bg-ink px-8 text-[13px] text-white transition-opacity hover:opacity-80"
        >
          {step === 0 ? "Continuar" : "Confirmar"}
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="reserve-row">
      <span>{label}</span>
      <input
        required
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="reserve-input"
      />
    </label>
  );
}
