import { bootstrapStaff, jsonError, staffCount } from "@/server/adminAuth";

export async function GET() {
  try {
    const count = await staffCount();
    return Response.json({ ok: true, needsSetup: count === 0 });
  } catch {
    return Response.json({ ok: true, needsSetup: true, offline: true });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      secret?: string;
      name?: string;
    };
    if (!body.email?.trim() || !body.password || !body.secret) {
      return Response.json(
        { ok: false, error: "Correo, contraseña y secreto." },
        { status: 400 },
      );
    }
    const staff = await bootstrapStaff({
      email: body.email,
      password: body.password,
      secret: body.secret,
      name: body.name,
    });
    return Response.json({ ok: true, staff });
  } catch (error) {
    return jsonError(error);
  }
}
