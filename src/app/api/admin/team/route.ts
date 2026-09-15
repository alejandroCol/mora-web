import { isStaffRole, type StaffRole } from "@/commerce/roles";
import {
  createStaffMember,
  jsonError,
  listStaff,
  requirePermission,
} from "@/server/adminAuth";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "team");
    const team = await listStaff();
    return Response.json({ ok: true, team });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(request, "team");
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      name?: string;
      role?: StaffRole;
    };
    if (!body.email?.trim() || !body.password || !body.name?.trim()) {
      return Response.json(
        { ok: false, error: "Nombre, correo y contraseña." },
        { status: 400 },
      );
    }
    if (!isStaffRole(body.role)) {
      return Response.json({ ok: false, error: "Elige un rol." }, { status: 400 });
    }
    const member = await createStaffMember({
      email: body.email,
      password: body.password,
      name: body.name,
      role: body.role,
      createdBy: actor.uid,
    });
    return Response.json({ ok: true, member });
  } catch (error) {
    return jsonError(error);
  }
}
