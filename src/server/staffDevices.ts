import { COLLECTIONS } from "@/commerce/paths";
import { adminDb } from "@/lib/firebaseAdmin";

/**
 * Teléfonos del equipo que corren la app Super Admin.
 * Un doc por dispositivo (`deviceId` estable de la app), con el `uid` de quien
 * tiene la sesión abierta en ese teléfono: si otra persona entra en el mismo
 * aparato, el doc cambia de dueño y el push sigue a la sesión activa.
 *
 * Lo consume `app-backend/src/push/staff.ts` cuando entra un mensaje de WhatsApp.
 */

export type StaffDevicePlatform = "ios";
export type StaffDeviceEnv = "sandbox" | "production";

export type StaffDeviceInput = {
  deviceId: string;
  token: string;
  platform: StaffDevicePlatform;
  env: StaffDeviceEnv;
  appVersion?: string;
  bundleId?: string;
  model?: string;
};

export type StaffDeviceRecord = StaffDeviceInput & {
  uid: string;
  updatedAt: number;
};

const DEVICE_ID = /^[A-Za-z0-9._-]{8,80}$/;
const APNS_TOKEN = /^[a-f0-9]{64,400}$/i;

function invalid(message: string) {
  return Object.assign(new Error(message), { status: 400 });
}

export function parseStaffDevice(body: unknown): StaffDeviceInput {
  const data = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const deviceId = typeof data.deviceId === "string" ? data.deviceId.trim() : "";
  const token = typeof data.token === "string" ? data.token.trim() : "";
  if (!DEVICE_ID.test(deviceId)) throw invalid("Falta el identificador del dispositivo.");
  if (!APNS_TOKEN.test(token)) throw invalid("El token de notificaciones no es válido.");
  if (data.platform !== "ios") throw invalid("Plataforma sin soporte.");
  return {
    deviceId,
    token,
    platform: "ios",
    env: data.env === "sandbox" ? "sandbox" : "production",
    appVersion: typeof data.appVersion === "string" ? data.appVersion.slice(0, 32) : undefined,
    bundleId: typeof data.bundleId === "string" ? data.bundleId.slice(0, 120) : undefined,
    model: typeof data.model === "string" ? data.model.slice(0, 64) : undefined,
  };
}

export function parseStaffDeviceId(body: unknown): string {
  const data = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const deviceId = typeof data.deviceId === "string" ? data.deviceId.trim() : "";
  if (!DEVICE_ID.test(deviceId)) throw invalid("Falta el identificador del dispositivo.");
  return deviceId;
}

function devices() {
  return adminDb().collection(COLLECTIONS.staffDevices);
}

export async function registerStaffDevice(uid: string, input: StaffDeviceInput): Promise<StaffDeviceRecord> {
  const record: StaffDeviceRecord = { ...compact(input), uid, updatedAt: Date.now() } as StaffDeviceRecord;
  await devices().doc(input.deviceId).set(record);
  return record;
}

/** Solo borra si el doc sigue siendo de quien pide: otra sesión pudo tomar el teléfono. */
export async function removeStaffDevice(uid: string, deviceId: string): Promise<boolean> {
  const ref = devices().doc(deviceId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  if (snap.data()?.uid !== uid) return false;
  await ref.delete();
  return true;
}

function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}
