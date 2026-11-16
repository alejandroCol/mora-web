import type { CrmQuickReplyMedia } from "@/growth/types";
import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError, requirePermission } from "@/server/adminAuth";
import { storeReplyMedia } from "@/server/crmReplyMedia";
import { finishVideoUpload, isUploadId } from "@/server/crmVideo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * El resultado queda en Firestore: si Safari se va a segundo plano mientras se convierte,
 * iOS corta la conexión («Load failed») aunque el servidor termine. Al volver, el navegador lo consulta aquí.
 */
type Job = { status: "working" | "done" | "error"; media?: CrmQuickReplyMedia; error?: string; at: number };

function jobRef(id: string) {
  return adminDb().collection("crmVideoJobs").doc(id);
}

function reply(job: Job | undefined) {
  if (!job) return Response.json({ ok: false, error: "No encontré ese video. Vuelve a subirlo." }, { status: 404 });
  if (job.status === "done") return Response.json({ ok: true, media: job.media });
  if (job.status === "error") return Response.json({ ok: false, error: job.error }, { status: 400 });
  return Response.json({ ok: true, pending: true }, { status: 202 });
}

/** Cierra la subida por partes: convierte a MP4 para WhatsApp y lo guarda como adjunto. */
export async function POST(request: Request) {
  try {
    await requirePermission(request, "whatsapp");
    const body = (await request.json().catch(() => ({}))) as { id?: string; parts?: number; name?: string };
    const id = String(body.id ?? "");
    if (!isUploadId(id)) return Response.json({ ok: false, error: "Subida inválida." }, { status: 400 });
    const ref = jobRef(id);
    const claimed = await ref.create({ status: "working", at: Date.now() } satisfies Job).then(
      () => true,
      () => false,
    );
    if (!claimed) return reply((await ref.get()).data() as Job | undefined);
    try {
      const bytes = await finishVideoUpload(id, Number(body.parts));
      const base = String(body.name ?? "video").replace(/\.[^.]+$/, "").slice(0, 100) || "video";
      const media = await storeReplyMedia({ bytes, mimeType: "video/mp4", name: `${base}.mp4` });
      await ref.set({ status: "done", media, at: Date.now() } satisfies Job);
      return Response.json({ ok: true, media });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo convertir el video.";
      await ref.set({ status: "error", error: message, at: Date.now() } satisfies Job).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    return jsonError(error);
  }
}

/** Estado de una conversión, para cuando la respuesta del POST no llegó al navegador. */
export async function GET(request: Request) {
  try {
    await requirePermission(request, "whatsapp");
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!isUploadId(id)) return Response.json({ ok: false, error: "Subida inválida." }, { status: 400 });
    return reply((await jobRef(id).get()).data() as Job | undefined);
  } catch (error) {
    return jsonError(error);
  }
}
