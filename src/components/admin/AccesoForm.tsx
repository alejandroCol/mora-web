"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { getFirebaseAuth } from "@/lib/firebase";

export function AccesoForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/admin/bootstrap")
      .then((res) => res.json())
      .then((data: { needsSetup?: boolean }) => setNeedsSetup(Boolean(data.needsSetup)));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (needsSetup) {
        const res = await fetch("/api/admin/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, secret, name }),
        });
        const data = (await res.json()) as { ok: boolean; error?: string };
        if (!data.ok) throw new Error(data.error);
      }
      const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      await cred.user.getIdToken(true);
      router.replace("/superadmin/ventas");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-[#0e0d14] px-6 text-[#f4f1ea]">
      <form onSubmit={onSubmit} className="w-full max-w-sm">
        <BrandLogo variant="wordmark" className="h-8 w-auto object-contain" />
        <p className="mt-8 text-[11px] uppercase tracking-[0.18em] text-white/35">Acceso</p>
        <h1 className="mt-3 font-display text-4xl tracking-[-0.05em]">Atelier.</h1>
        <p className="mt-3 text-sm text-white/45">
          {needsSetup
            ? "Primera vez: regístrate como super admin con el secreto de instalación. Después podrás crear vendedores desde Equipo."
            : "El super admin crea al resto del equipo. Entra con tu correo."}
        </p>
        {needsSetup ? (
          <label className="mt-8 block text-[11px] uppercase tracking-[0.12em] text-white/40">
            Tu nombre
            <input
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 h-12 w-full rounded-2xl bg-white/8 px-4 text-[16px] normal-case tracking-normal text-white"
            />
          </label>
        ) : null}
        <label className={`${needsSetup ? "mt-4" : "mt-8"} block text-[11px] uppercase tracking-[0.12em] text-white/40`}>
          Correo
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 h-12 w-full rounded-2xl bg-white/8 px-4 text-[16px] normal-case tracking-normal text-white"
          />
        </label>
        <label className="mt-4 block text-[11px] uppercase tracking-[0.12em] text-white/40">
          Contraseña
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 h-12 w-full rounded-2xl bg-white/8 px-4 text-[16px] normal-case tracking-normal text-white"
          />
        </label>
        {needsSetup ? (
          <label className="mt-4 block text-[11px] uppercase tracking-[0.12em] text-white/40">
            Secreto de instalación
            <input
              type="password"
              required
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              className="mt-2 h-12 w-full rounded-2xl bg-white/8 px-4 text-[16px] normal-case tracking-normal text-white"
            />
          </label>
        ) : null}
        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-8 h-12 w-full rounded-full bg-white text-[14px] text-[#0e0d14] disabled:opacity-50"
        >
          {busy ? "Entrando…" : needsSetup ? "Activar atelier" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
