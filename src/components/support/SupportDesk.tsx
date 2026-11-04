"use client";

import { useState, type FormEvent } from "react";
import { WhatsAppLink } from "@/components/growth/WhatsAppLink";
import { SUPPORT_TOPICS } from "@/lib/supportTopics";

export function SupportDesk() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<(typeof SUPPORT_TOPICS)[number]["id"]>("app");
  const [message, setMessage] = useState("");
  const [trap, setTrap] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, topic, message, company: trap }),
      });
      const data = (await res.json()) as { ok?: boolean; ticket?: string; error?: string };
      if (!data.ok || !data.ticket) {
        setError(data.error ?? "No se pudo enviar.");
        return;
      }
      setTicket(data.ticket);
    } catch {
      setError("No se pudo enviar. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  if (ticket) {
    return (
      <div className="reserve-sheet px-6 py-8 text-center sm:px-8">
        <p className="kicker">Ticket {ticket}</p>
        <h2 className="mt-3 font-display text-[1.7rem] tracking-[-0.04em] text-ink">Ya te leímos.</h2>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-soft">
          Te escribimos a {email}. Si tarda, WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="reserve-sheet">
      <div className="reserve-row">
        <span>Nombre</span>
        <input
          className="reserve-input"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Cómo te llamas"
          required
        />
      </div>
      <div className="reserve-row">
        <span>Correo</span>
        <input
          className="reserve-input"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          required
        />
      </div>
      <div className="reserve-row">
        <span>Sobre</span>
        <select
          className="reserve-input bg-transparent"
          name="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value as typeof topic)}
        >
          {SUPPORT_TOPICS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div className="reserve-row">
        <span>Tu nota</span>
        <textarea
          className="reserve-input min-h-28 resize-y py-1"
          name="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Qué pasó. Sin prisa."
          required
          minLength={8}
          maxLength={2000}
        />
      </div>
      <label className="absolute left-[-200vw] opacity-0" aria-hidden>
        Empresa
        <input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
      </label>
      {error ? <p className="px-5 pb-1 text-[13px] text-[#9a4a58]">{error}</p> : null}
      <div className="px-5 pb-5 pt-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center rounded-full bg-[#6f61b8] px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-[#5e52a4] disabled:opacity-50"
        >
          {busy ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </form>
  );
}

export function SupportWhatsApp() {
  return (
    <p className="text-center text-[12px] tracking-[-0.01em] text-[#86868b]">
      ¿Aún no te hemos escrito?{" "}
      <WhatsAppLink
        className="text-[#6a6580] underline decoration-[#c9c4e6] underline-offset-2 transition hover:text-ink"
        prefill="Hola Mora, escribí por soporte y aún no me han respondido."
      >
        WhatsApp
      </WhatsAppLink>
    </p>
  );
}
