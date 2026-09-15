"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ROLE_BLURB,
  ROLE_LABEL,
  STAFF_ROLES,
  type StaffRecord,
  type StaffRole,
} from "@/commerce/roles";
import { useAdminAuth } from "./AdminAuth";

export function EquipoView() {
  const { authorizedFetch, me } = useAdminAuth();
  const [team, setTeam] = useState<StaffRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("vendedor");

  const load = useCallback(async () => {
    const res = await authorizedFetch("/api/admin/team");
    const data = (await res.json()) as { ok?: boolean; team?: StaffRecord[] };
    if (data.ok) setTeam(data.team ?? []);
  }, [authorizedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createMember() {
    setBusy(true);
    setError("");
    try {
      const res = await authorizedFetch("/api/admin/team", {
        method: "POST",
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) throw new Error(data.error);
      setOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setRole("vendedor");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear.");
    } finally {
      setBusy(false);
    }
  }

  async function patch(uid: string, body: Partial<StaffRecord> & { password?: string }) {
    setBusy(true);
    setError("");
    try {
      const res = await authorizedFetch(`/api/admin/team/${uid}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) throw new Error(data.error);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Equipo</p>
          <h1 className="mt-2 font-display text-4xl tracking-[-0.05em]">Quién entra.</h1>
          <p className="mt-2 max-w-lg text-sm leading-6 text-white/45">
            Tú registras al resto. Un vendedor ve ventas, registra cobros a mano y despacha.
            El super admin ve todo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-10 rounded-full bg-white px-5 text-[13px] text-[#0e0d14]"
        >
          Registrar persona
        </button>
      </div>

      {error ? <p className="mt-6 text-sm text-red-300">{error}</p> : null}

      <ul className="mt-10 space-y-3">
        {team.map((member) => (
          <li
            key={member.uid}
            className="rounded-[1.4rem] bg-white/[0.04] p-5 sm:flex sm:items-center sm:justify-between sm:gap-6"
          >
            <div className="min-w-0">
              <p className="text-[16px] tracking-[-0.02em]">
                {member.name || member.email}
                {member.uid === me?.uid ? (
                  <span className="ml-2 text-[11px] uppercase tracking-[0.1em] text-white/35">
                    tú
                  </span>
                ) : null}
              </p>
              <p className="mt-1 truncate text-[13px] text-white/45">{member.email}</p>
              <p className="mt-2 text-[12px] text-white/35">{ROLE_BLURB[member.role]}</p>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-0">
              <select
                value={member.role}
                disabled={busy}
                onChange={(event) =>
                  void patch(member.uid, { role: event.target.value as StaffRole })
                }
                className="h-10 rounded-full bg-white/8 px-3 text-[13px]"
              >
                {STAFF_ROLES.map((item) => (
                  <option key={item} value={item}>
                    {ROLE_LABEL[item]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const next = window.prompt("Nueva contraseña (mínimo 8 caracteres)");
                  if (next) void patch(member.uid, { password: next });
                }}
                className="h-10 rounded-full px-4 text-[12px] text-white/45 hover:text-white"
              >
                Clave
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void patch(member.uid, { active: !member.active })}
                className={`h-10 rounded-full px-4 text-[12px] ${
                  member.active ? "bg-white/8 text-white/70" : "bg-red-300/15 text-red-200"
                }`}
              >
                {member.active ? "Activo" : "Inactivo"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 sm:place-items-center sm:p-6">
          <form
            className="w-full max-w-md rounded-t-3xl bg-[#16141f] p-6 sm:rounded-3xl sm:p-8"
            onSubmit={(event) => {
              event.preventDefault();
              void createMember();
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/40">Nuevo acceso</p>
                <h2 className="mt-1 text-2xl tracking-[-0.04em]">Registrar</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-sm text-white/50">
                Cerrar
              </button>
            </div>

            <label className="mt-6 block text-[11px] uppercase tracking-[0.12em] text-white/40">
              Nombre
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 h-11 w-full rounded-2xl bg-white/8 px-3 text-[16px] normal-case tracking-normal text-white"
              />
            </label>
            <label className="mt-4 block text-[11px] uppercase tracking-[0.12em] text-white/40">
              Correo
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 h-11 w-full rounded-2xl bg-white/8 px-3 text-[16px] normal-case tracking-normal text-white"
              />
            </label>
            <label className="mt-4 block text-[11px] uppercase tracking-[0.12em] text-white/40">
              Contraseña temporal
              <input
                required
                type="text"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 h-11 w-full rounded-2xl bg-white/8 px-3 text-[16px] normal-case tracking-normal text-white"
              />
            </label>

            <div className="mt-5 flex flex-wrap gap-2">
              {STAFF_ROLES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setRole(item)}
                  className={`rounded-full px-4 py-2 text-left text-[13px] ${
                    role === item ? "bg-white text-[#16141f]" : "bg-white/8 text-white/70"
                  }`}
                >
                  <span className="block">{ROLE_LABEL[item]}</span>
                  <span className={`mt-0.5 block text-[11px] ${role === item ? "text-[#16141f]/55" : "text-white/35"}`}>
                    {ROLE_BLURB[item]}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={busy}
              className="mt-8 h-11 w-full rounded-full bg-white text-[13px] text-[#16141f] disabled:opacity-40"
            >
              {busy ? "Creando…" : "Crear acceso"}
            </button>
            {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
          </form>
        </div>
      ) : null}
    </div>
  );
}
