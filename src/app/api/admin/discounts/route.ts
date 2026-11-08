import type { CartOfferKind } from "@/commerce/types";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { createDiscountCode, listDiscountCodes } from "@/server/discountCodes";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "discounts");
    const codes = await listDiscountCodes();
    return Response.json({ ok: true, codes });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const staff = await requirePermission(request, "discounts");
    const body = (await request.json()) as {
      code?: string;
      kind?: CartOfferKind;
      value?: unknown;
      maxUses?: unknown;
      note?: unknown;
    };
    if (!body.code?.trim()) {
      return Response.json({ ok: false, error: "Escribe el código." }, { status: 400 });
    }
    const created = await createDiscountCode({
      code: body.code,
      kind: body.kind === "amount" ? "amount" : "percent",
      value: body.value,
      maxUses: body.maxUses,
      note: body.note,
      createdBy: staff.uid,
    });
    const codes = await listDiscountCodes();
    return Response.json({ ok: true, code: created, codes });
  } catch (error) {
    return jsonError(error);
  }
}
