"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  roleHasPermission,
  type StaffPermission,
  type StaffRecord,
} from "@/commerce/roles";
import { getFirebaseAuth } from "@/lib/firebase";

type AdminAuth = {
  user: User | null;
  loading: boolean;
  me: StaffRecord | null;
  token: string | null;
  can: (permission: StaffPermission) => boolean;
  authorizedFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
};

const Ctx = createContext<AdminAuth | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<StaffRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const authorizedFetch = useCallback(
    async (input: RequestInfo, init?: RequestInit) => {
      const fresh = user ? await user.getIdToken() : token;
      return fetch(input, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
          ...(fresh ? { Authorization: `Bearer ${fresh}` } : {}),
        },
      });
    },
    [user, token],
  );

  useEffect(() => {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      if (!next) {
        setToken(null);
        setMe(null);
        setLoading(false);
        return;
      }
      void next.getIdToken().then(async (value) => {
        setToken(value);
        const res = await fetch("/api/admin/me", {
          headers: { Authorization: `Bearer ${value}` },
        });
        const data = (await res.json()) as { ok?: boolean; me?: StaffRecord };
        setMe(data.ok && data.me ? data.me : null);
        setLoading(false);
      });
    });
  }, []);

  const value = useMemo<AdminAuth>(
    () => ({
      user,
      loading,
      me,
      token,
      can: (permission) => (me ? roleHasPermission(me.role, permission) : false),
      authorizedFetch,
    }),
    [user, loading, me, token, authorizedFetch],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdminAuth");
  return ctx;
}
