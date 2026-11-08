"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  isNativeShell,
  onShellEvent,
  postToShell,
  rememberRegisteredDevice,
  type PushStatus,
} from "@/lib/nativeShell";
import { useAdminAuth } from "./AdminAuth";

/**
 * Lado web del contenedor iOS. Se monta solo con sesión de staff:
 * avisa al contenedor que puede pedir permiso de notificaciones, registra el
 * token APNs contra `/api/admin/devices` y atiende la navegación que llega
 * desde una notificación tocada.
 */
export function NativeShellBridge() {
  const { me, authorizedFetch } = useAdminAuth();
  const router = useRouter();
  const [status, setStatus] = useState<PushStatus | null>(null);
  // `window.MoraShell` lo inyecta la app antes de cualquier script: es estable, basta leerlo una vez.
  const native = useSyncExternalStore(subscribeNever, isNativeShell, () => false);
  const registered = useRef<string | null>(null);

  useEffect(() => {
    if (!native || !me) return;
    const uid = me.uid;
    const off = onShellEvent((event) => {
      if (event.type === "pushStatus") {
        setStatus(event.status);
        return;
      }
      if (event.type === "route") {
        if (event.path.startsWith("/superadmin")) router.push(event.path);
        return;
      }
      if (event.type === "pushToken") {
        const key = `${uid}:${event.deviceId}:${event.token}`;
        if (registered.current === key) return;
        registered.current = key;
        void authorizedFetch("/api/admin/devices", {
          method: "POST",
          body: JSON.stringify({
            deviceId: event.deviceId,
            token: event.token,
            platform: "ios",
            env: event.env,
            appVersion: event.appVersion,
            bundleId: event.bundleId,
            model: event.model,
          }),
        })
          .then((res) => {
            if (res.ok) rememberRegisteredDevice(event.deviceId);
            else registered.current = null;
          })
          .catch(() => {
            registered.current = null;
          });
      }
    });
    postToShell({ type: "ready" });
    return off;
  }, [native, me, authorizedFetch, router]);

  if (!native || status !== "denied") return null;

  return (
    <div
      role="status"
      className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 lg:mx-6"
    >
      <span className="min-w-0 flex-1">
        Las notificaciones están apagadas. No te enterarás de los mensajes nuevos hasta activarlas.
      </span>
      <button
        type="button"
        className="shrink-0 rounded-full bg-amber-900 px-3 py-1.5 text-xs font-medium text-white"
        onClick={() => postToShell({ type: "openSettings" })}
      >
        Activar
      </button>
    </div>
  );
}

function subscribeNever() {
  return () => {};
}
