import type { LoanDraft } from "@/commerce/finance";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { createLoan, financeSnapshot } from "@/server/finance";

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(request, "budget");
    const body = (await request.json()) as LoanDraft;
    await createLoan(body, actor.uid);
    return Response.json({ ok: true, ...(await financeSnapshot()) });
  } catch (error) {
    return jsonError(error);
  }
}
