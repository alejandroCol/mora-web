import type { ExpenseCategory } from "@/commerce/finance";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { createExpense, financeSnapshot } from "@/server/finance";

export async function POST(request: Request) {
  try {
    const actor = await requirePermission(request, "budget");
    const body = (await request.json()) as {
      date?: string;
      category?: ExpenseCategory;
      title?: string;
      vendor?: string;
      amountCop?: number;
      notes?: string;
      attachmentIds?: string[];
      relatedOrderId?: string;
    };
    await createExpense(body, actor.uid);
    return Response.json({ ok: true, ...(await financeSnapshot()) });
  } catch (error) {
    return jsonError(error);
  }
}
