"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { callMoraApp, getFirebaseAuth } from "@/lib/firebase";

type TideBand = "calm" | "mid" | "high";

type Member = {
  uid: string;
  displayName: string;
  isOwner: boolean;
  stepsToday?: number;
  sleepScore?: number;
  sleepMinutes?: number;
  tideBand?: TideBand;
  lastHeartBpm?: number;
};

type CircleList = {
  circle: {
    id: string;
    name: string;
    ownerUid: string;
    sharedSteps: number;
    sharedGoal: number;
  } | null;
  members: Member[];
};

const tideLabel: Record<TideBand, string> = {
  calm: "Calma",
  mid: "Equilibrio",
  high: "Marea alta",
};

export function CirculoApp() {
  const params = useSearchParams();
  const inviteFromLink = params.get("code") ?? "";
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState(inviteFromLink);
  const [list, setList] = useState<CircleList | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(getFirebaseAuth(), (next) => {
      setUser(next);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setList(null);
      return;
    }
    void bootstrap(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const members = list?.members ?? [];
  const circle = list?.circle;
  const goal = Math.max(circle?.sharedGoal ?? 1, 1);
  const progress = Math.min((circle?.sharedSteps ?? 0) / goal, 1);

  const subtitle = useMemo(() => {
    if (!circle) return "Pasos cerca. Sin ranking que duela.";
    return `${circle.sharedSteps.toLocaleString("es-CO")} / ${goal.toLocaleString("es-CO")} pasos juntos`;
  }, [circle, goal]);

  async function bootstrap(current: User) {
    setBusy(true);
    setMessage("");
    try {
      const ensured = await callMoraApp<{ joinedCircle?: boolean }>("ensureUser", {
        displayName: current.displayName || current.email || "Tú",
      });
      if (ensured.joinedCircle) {
        setMessage("Invitación aceptada. Ya estás cerca.");
      }
      const data = await callMoraApp<CircleList>("listCircle");
      setList(data);
      if (inviteFromLink && !data.circle) {
        setInvite(inviteFromLink);
      }
    } catch (error) {
      setMessage(humanError(error));
    } finally {
      setBusy(false);
    }
  }

  async function enterGoogle() {
    setBusy(true);
    setMessage("");
    try {
      await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
    } catch (error) {
      setMessage(humanError(error));
      setBusy(false);
    }
  }

  async function enterEmail(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
    } catch (error) {
      setMessage(humanError(error));
      setBusy(false);
    }
  }

  async function makeCircle() {
    setBusy(true);
    try {
      await callMoraApp("createCircle", { name: "Casa" });
      if (user) await bootstrap(user);
    } catch (error) {
      setMessage(humanError(error));
      setBusy(false);
    }
  }

  async function joinCircle() {
    setBusy(true);
    try {
      await callMoraApp("acceptInvite", { code: invite.trim().toUpperCase() });
      if (user) await bootstrap(user);
    } catch (error) {
      setMessage(humanError(error));
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-6">
        <p className="text-soft">Cargando…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 px-6 py-12">
      <header className="flex items-center gap-3">
        <BrandLogo variant="mark" className="h-10 w-10" />
        <div>
          <p className="font-display text-2xl">Círculo</p>
          <p className="text-sm text-soft">{subtitle}</p>
        </div>
      </header>

      {!user ? (
        <section className="space-y-4 rounded-3xl bg-paper p-6 shadow-sm">
          <p className="text-soft">
            Entra para ver a los tuyos. Wellness, no diagnóstico.
          </p>
          <button
            type="button"
            onClick={() => void enterGoogle()}
            disabled={busy}
            className="w-full rounded-2xl bg-ink px-4 py-3 text-paper disabled:opacity-60"
          >
            Continuar con Google
          </button>
          <form onSubmit={(event) => void enterEmail(event)} className="space-y-3">
            <input
              type="email"
              required
              placeholder="Correo"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-line bg-dawn px-4 py-3"
            />
            <input
              type="password"
              required
              placeholder="Contraseña"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-line bg-dawn px-4 py-3"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl border border-line px-4 py-3 disabled:opacity-60"
            >
              Entrar con correo
            </button>
          </form>
        </section>
      ) : !circle ? (
        <section className="space-y-4 rounded-3xl bg-paper p-6 shadow-sm">
          <p className="text-soft">Aún no hay casa. Crea un Círculo o entra con un código.</p>
          <button
            type="button"
            onClick={() => void makeCircle()}
            disabled={busy}
            className="w-full rounded-2xl bg-ink px-4 py-3 text-paper disabled:opacity-60"
          >
            Crear Círculo
          </button>
          <div className="flex gap-2">
            <input
              value={invite}
              onChange={(event) => setInvite(event.target.value.toUpperCase())}
              placeholder="ABC123"
              className="flex-1 rounded-2xl border border-line bg-dawn px-4 py-3 tracking-widest"
            />
            <button
              type="button"
              onClick={() => void joinCircle()}
              disabled={busy || invite.trim().length < 6}
              className="rounded-2xl border border-line px-4 py-3 disabled:opacity-60"
            >
              Unirme
            </button>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="rounded-3xl bg-paper p-6 shadow-sm">
            <p className="font-display text-xl">{circle.name}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-lilac">
              <div className="h-full bg-bloom" style={{ width: `${progress * 100}%` }} />
            </div>
            <p className="mt-2 text-sm text-soft">{subtitle}</p>
          </div>
          <ul className="space-y-3">
            {members.map((member) => (
              <li
                key={member.uid}
                className="flex items-center justify-between rounded-3xl bg-paper px-5 py-4 shadow-sm"
              >
                <div>
                  <p className="font-medium">{member.displayName}</p>
                  <p className="text-sm text-soft">
                    {member.isOwner ? "Tú" : "Cerca"}
                    {member.tideBand ? ` · ${tideLabel[member.tideBand]}` : ""}
                    {member.sleepScore != null ? ` · noche ${member.sleepScore}` : ""}
                  </p>
                </div>
                <p className="font-display text-xl tabular-nums">
                  {member.stepsToday != null ? member.stepsToday.toLocaleString("es-CO") : "—"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {message ? <p className="text-sm text-soft">{message}</p> : null}

      {user ? (
        <button
          type="button"
          onClick={() => void signOut(getFirebaseAuth())}
          className="text-sm text-soft underline-offset-4 hover:underline"
        >
          Salir
        </button>
      ) : null}
    </main>
  );
}

function humanError(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message: string }).message);
    if (message.includes("unauthenticated")) return "Entra de nuevo.";
    if (message.includes("already-exists")) return "Ya estás en un Círculo.";
    return message.replace(/^Firebase:\s*/i, "").split("(")[0].trim();
  }
  return "No se pudo.";
}
