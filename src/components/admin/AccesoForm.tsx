"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { getFirebaseAuth } from "@/lib/firebase";

export function AccesoForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
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
    <div className="admin-app grid min-h-dvh place-items-center px-5">
      <form onSubmit={onSubmit} className="w-full max-w-[26rem]">
        <BrandLogo variant="wordmark" className="h-8 w-auto object-contain" />
        <h1 className="mt-8 text-[2rem] font-semibold tracking-[-0.03em]">Entra</h1>
        <div className="admin-sheet mt-8">
          <label className="admin-field">
            <span>Correo</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="admin-input"
            />
          </label>
          <label className="admin-field">
            <span>Contraseña</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="admin-input"
            />
          </label>
        </div>
        {error ? <p className="mt-4 text-sm text-[color:var(--admin-danger)]">{error}</p> : null}
        <button type="submit" disabled={busy} className="admin-cta mt-6">
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
