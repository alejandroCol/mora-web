import { jsonError, requireStaff } from "@/server/adminAuth";
import { permissionsFor } from "@/commerce/roles";

export async function GET(request: Request) {
  try {
    const me = await requireStaff(request);
    return Response.json({
      ok: true,
      me,
      permissions: permissionsFor(me.role),
    });
  } catch (error) {
    return jsonError(error);
  }
}
