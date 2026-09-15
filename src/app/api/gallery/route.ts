import { isModelId, listAllGalleries, listGallery } from "@/server/gallery";

export async function GET(request: Request) {
  const model = new URL(request.url).searchParams.get("model");
  if (model) {
    if (!isModelId(model)) {
      return Response.json({ ok: false, error: "Anillo inválido." }, { status: 400 });
    }
    const images = await listGallery(model);
    return Response.json({ ok: true, images });
  }
  const galleries = await listAllGalleries();
  return Response.json({ ok: true, galleries });
}
