"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { finishes, formatMoney, products } from "@/lib/catalog";
import { selectionLabel, useMoraStore } from "@/lib/store";

export function CheckoutForm() {
  const router = useRouter();
  const { selection, draft, setDraft, placeOrder } = useMoraStore();
  const [error, setError] = useState("");
  const model = products[selection.modelId];
  const finish = finishes[selection.finishId];

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !draft.firstName ||
      !draft.lastName ||
      !draft.email ||
      !draft.phone ||
      !draft.city ||
      !draft.address
    ) {
      setError("Completa los campos para reservar tu anillo.");
      return;
    }
    const order = placeOrder();
    router.push(`/pedido?ref=${order.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-16 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-8">
        <div>
          <p className="text-[13px] text-soft">Destino</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field
              label="Nombre"
              value={draft.firstName}
              onChange={(value) => setDraft({ firstName: value })}
            />
            <Field
              label="Apellido"
              value={draft.lastName}
              onChange={(value) => setDraft({ lastName: value })}
            />
            <Field
              label="Correo"
              type="email"
              value={draft.email}
              onChange={(value) => setDraft({ email: value })}
            />
            <Field
              label="Teléfono"
              value={draft.phone}
              onChange={(value) => setDraft({ phone: value })}
            />
            <Field
              label="Ciudad"
              value={draft.city}
              onChange={(value) => setDraft({ city: value })}
            />
            <Field
              label="Dirección"
              className="sm:col-span-2"
              value={draft.address}
              onChange={(value) => setDraft({ address: value })}
            />
            <label className="sm:col-span-2">
              <span className="text-[13px] text-soft">Nota</span>
              <textarea
                rows={3}
                value={draft.notes}
                onChange={(event) => setDraft({ notes: event.target.value })}
                className="mt-2 w-full resize-none border-b border-line bg-transparent py-3 text-sm outline-none focus:border-ink/40"
              />
            </label>
          </div>
        </div>
        {error ? <p className="text-sm text-ink/70">{error}</p> : null}
        <button
          type="submit"
          className="h-12 rounded-full bg-ink px-8 text-[14px] text-white transition-opacity hover:opacity-80"
        >
          Confirmar reserva
        </button>
      </div>

      <aside className="h-fit rounded-[1.75rem] border border-line bg-white/70 p-7">
        <p className="kicker">Tu anillo</p>
        <p className="title-name mt-4 text-[2.4rem] text-ink">{model.name}</p>
        <dl className="mt-6 space-y-3 text-sm text-soft">
          <Row label="Acabado" value={finish.title} />
          <Row label="Talla" value={`#${selection.size}`} />
          <Row label="Envío" value="Incluido" />
        </dl>
        <div className="mt-8 flex items-end justify-between border-t border-line pt-5">
          <span className="text-[13px] text-soft">Total</span>
          <span className="text-ink">{formatMoney(model.price)}</span>
        </div>
        <p className="mt-6 text-xs leading-5 text-soft">
          {selectionLabel(selection)}. Pago contra confirmación del atelier.
        </p>
      </aside>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="text-[13px] text-soft">{label}</span>
      <input
        required
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full border-b border-line bg-transparent py-3 text-sm outline-none focus:border-ink/40"
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
