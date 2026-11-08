/**
 * Puente con la app iOS "Super Admin Mora" (contenedor WKWebView del panel).
 *
 * Contrato, en los dos sentidos. La contraparte Swift vive en
 * `ios/Super Admin/Super Admin Mora/Super Admin Mora/Web/ShellBridge.swift`.
 *
 * Web → nativo: `window.webkit.messageHandlers.moraShell.postMessage({ type, ... })`.
 * Nativo → web: `window.dispatchEvent(new CustomEvent("mora:shell", { detail }))`.
 * Nativo inyecta `window.MoraShell` al arrancar el documento para que la web sepa
 * de forma síncrona que corre dentro de la app.
 */

export const SHELL_EVENT = "mora:shell";
const HANDLER = "moraShell";

export type ShellInfo = {
  platform: "ios";
  version: string;
  build: string;
  bundleId: string;
  model: string;
};

/** Lo que la web le dice al contenedor. */
export type ShellOutbound =
  /** Hay sesión de staff y el puente escucha: pide permiso de push y manda el token. */
  | { type: "ready" }
  /** Abre Ajustes › Notificaciones de la app. */
  | { type: "openSettings" }
  /** La persona cerró sesión: el contenedor limpia badge y deja de empujar el token. */
  | { type: "signedOut" };

export type PushStatus = "notDetermined" | "denied" | "authorized" | "provisional" | "ephemeral";

/** Lo que el contenedor le dice a la web. */
export type ShellInbound =
  | {
      type: "pushToken";
      token: string;
      env: "sandbox" | "production";
      deviceId: string;
      appVersion: string;
      bundleId: string;
      model: string;
    }
  | { type: "pushStatus"; status: PushStatus }
  /** Navegación pedida por una notificación: ruta relativa al sitio. */
  | { type: "route"; path: string };

type WebKitWindow = Window & {
  MoraShell?: ShellInfo;
  webkit?: { messageHandlers?: Record<string, { postMessage: (message: unknown) => void }> };
};

function host(): WebKitWindow | null {
  return typeof window === "undefined" ? null : (window as WebKitWindow);
}

export function shellInfo(): ShellInfo | null {
  return host()?.MoraShell ?? null;
}

export function isNativeShell(): boolean {
  const w = host();
  return Boolean(w?.MoraShell && w.webkit?.messageHandlers?.[HANDLER]);
}

export function postToShell(message: ShellOutbound): boolean {
  const handler = host()?.webkit?.messageHandlers?.[HANDLER];
  if (!handler) return false;
  try {
    handler.postMessage(message);
    return true;
  } catch {
    return false;
  }
}

export function onShellEvent(listener: (event: ShellInbound) => void): () => void {
  const w = host();
  if (!w) return () => {};
  const handle = (raw: Event) => {
    const detail = (raw as CustomEvent<unknown>).detail;
    if (detail && typeof detail === "object" && "type" in detail) listener(detail as ShellInbound);
  };
  w.addEventListener(SHELL_EVENT, handle);
  return () => w.removeEventListener(SHELL_EVENT, handle);
}

const DEVICE_KEY = "mora-admin-device";

/** Recuerda el último dispositivo registrado para poder darlo de baja al salir. */
export function rememberRegisteredDevice(deviceId: string) {
  try {
    window.localStorage.setItem(DEVICE_KEY, deviceId);
  } catch {
    /* almacenamiento bloqueado */
  }
}

export function forgetRegisteredDevice(): string | null {
  try {
    const value = window.localStorage.getItem(DEVICE_KEY);
    window.localStorage.removeItem(DEVICE_KEY);
    return value;
  } catch {
    return null;
  }
}

/**
 * Antes de cerrar sesión: borra el registro del teléfono para que los avisos de
 * esa cuenta dejen de llegar aquí. Fuera de la app no hace nada.
 */
export async function unregisterNativeDevice(
  authorizedFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
) {
  if (!isNativeShell()) return;
  const deviceId = forgetRegisteredDevice();
  if (deviceId) {
    try {
      await authorizedFetch("/api/admin/devices", {
        method: "DELETE",
        body: JSON.stringify({ deviceId }),
      });
    } catch {
      /* sin red: el token muere solo cuando APNs lo rechace */
    }
  }
  postToShell({ type: "signedOut" });
}
