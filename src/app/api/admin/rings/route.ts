import { currentMonthKey } from "@/commerce/finance";
import type { RingsEconomicsConfig } from "@/commerce/rings";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { ringsSnapshot, updateRingsSnapshot } from "@/server/rings";

function monthFrom(request: Request, body?: { month?: unknown }) {
  const url = new URL(request.url);
  const raw = typeof body?.month === "string" ? body.month : url.searchParams.get("month");
  if (!raw || raw === "all") return "all";
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  return currentMonthKey();
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "rings");
    const snapshot = await ringsSnapshot(monthFrom(request));
    return Response.json({ ok: true, ...snapshot });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requirePermission(request, "rings");
    const body = (await request.json()) as {
      month?: unknown;
      config?: Partial<RingsEconomicsConfig>;
    };
    const snapshot = await updateRingsSnapshot(body.config ?? {}, monthFrom(request, body));
    return Response.json({ ok: true, ...snapshot });
  } catch (error) {
    return jsonError(error);
  }
}
