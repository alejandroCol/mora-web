"use client";

import { useEffect, useRef, useState } from "react";
import { isTerminalIntentStatus } from "@/payments/status";
import type { PaymentIntentStatus, PaymentProvider } from "@/payments/types";

export type WatchedIntent = {
  reference: string;
  status: PaymentIntentStatus;
  purpose: string;
  provider?: PaymentProvider;
  redirectPath: string;
  metadata: Record<string, string>;
};

const POLL_MS = 2500;
const POLL_FOR_MS = 90_000;

export function usePaymentWatch(reference: string | null) {
  const [status, setStatus] = useState<PaymentIntentStatus | "waiting">("waiting");
  const [intent, setIntent] = useState<WatchedIntent | null>(null);
  const [error, setError] = useState("");
  const [timedOut, setTimedOut] = useState(false);
  const synced = useRef(false);

  useEffect(() => {
    if (!reference) return;
    const ref = reference;

    let cancelled = false;
    const started = Date.now();
    synced.current = false;
    setTimedOut(false);
    setError("");
    setStatus("waiting");

    async function syncOnce() {
      if (synced.current) return;
      const res = await fetch("/api/payments/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: ref }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        intent?: WatchedIntent | null;
      };
      if (cancelled) return;
      synced.current = data.ok;
      if (data.intent) {
        setIntent(data.intent);
        setStatus(data.intent.status);
      }
    }

    async function poll() {
      const res = await fetch(`/api/payments/status?ref=${encodeURIComponent(ref)}`);
      const data = (await res.json()) as {
        ok: boolean;
        intent?: WatchedIntent;
        error?: string;
      };
      if (cancelled) return true;
      if (data.ok && data.intent) {
        setError("");
        setIntent(data.intent);
        setStatus(data.intent.status);
        if (isTerminalIntentStatus(data.intent.status)) return true;
      } else if (res.status === 404) {
        setError(data.error ?? "No encontramos ese pago.");
        return true;
      }
      if (Date.now() - started > POLL_FOR_MS) {
        setTimedOut(true);
        return true;
      }
      return false;
    }

    void (async () => {
      try {
        await syncOnce();
      } catch {
        // El comprobante de Bold a veces tarda. Seguimos escuchando el estado.
      }
      let stop = false;
      while (!cancelled && !stop) {
        try {
          stop = await poll();
        } catch {
          stop = Date.now() - started > POLL_FOR_MS;
          if (stop) setTimedOut(true);
        }
        if (!stop) await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reference]);

  return { status, intent, error, timedOut };
}
