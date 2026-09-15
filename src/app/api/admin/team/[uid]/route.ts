import { isStaffRole, type StaffRole } from "@/commerce/roles";
import {
  jsonError,
  requirePermission,
  updateStaffMember,
} from "@/server/adminAuth";

type Ctx = { params: Promise<{ uid: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const actor = await requirePermission(request, "team");
    const { uid } = await ctx.params;
    const body = (await request.json()) as {
      role?: StaffRole;
      active?: boolean;
      name?: string;
      password?: string;
    };
    if (body.role !== undefined && !isStaffRole(body.role)) {
      return Response.json({ ok: false, error: "Rol inválido." }, { status: 400 });
    }
    const member = await updateStaffMember({
      uid,
      actorUid: actor.uid,
      role: body.role,
      active: body.active,
      name: body.name,
      password: body.password,
    });
    return Response.json({ ok: true, member });
  } catch (error) {
    return jsonError(error);
  }
}
