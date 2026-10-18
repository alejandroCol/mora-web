import { readPaymentStatus } from "@/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = (
    url.searchParams.get("ref") ??
    url.searchParams.get("reference") ??
    url.searchParams.get("bold-order-id") ??
    ""
  ).trim();
  const transactionId = (url.searchParams.get("id") ?? url.searchParams.get("transactionId") ?? "").trim();
  if (!reference && !transactionId) {
    return Response.json({ ok: false, error: "Falta la referencia." }, { status: 400 });
  }

  const intent = await readPaymentStatus({ reference, transactionId });
  if (!intent) {
    return Response.json({ ok: false, error: "No encontramos ese pago." }, { status: 404 });
  }
  return Response.json({ ok: true, intent });
}
