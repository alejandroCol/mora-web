import { jsonError, requireStaff } from "@/server/adminAuth";
import {
  parseStaffDevice,
  parseStaffDeviceId,
  registerStaffDevice,
  removeStaffDevice,
} from "@/server/staffDevices";

/**
 * Registro del teléfono de la app Super Admin para recibir avisos de la bandeja.
 * Lo llama la web desde dentro de la app (puente `MoraShell`), con la sesión del staff.
 */

export async function POST(request: Request) {
  try {
    const me = await requireStaff(request);
    const device = parseStaffDevice(await request.json());
    const record = await registerStaffDevice(me.uid, device);
    return Response.json({ ok: true, device: { deviceId: record.deviceId, env: record.env, updatedAt: record.updatedAt } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const me = await requireStaff(request);
    const deviceId = parseStaffDeviceId(await request.json());
    const removed = await removeStaffDevice(me.uid, deviceId);
    return Response.json({ ok: true, removed });
  } catch (error) {
    return jsonError(error);
  }
}
