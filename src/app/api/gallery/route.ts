import { isProductFinish } from "@/lib/catalog";
import { isModelId, listAllGalleries, listGallery } from "@/server/gallery";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const model = params.get("model");
  const finish = params.get("finish");
  if (model) {
    if (!isModelId(model)) {
      return Response.json({ ok: false, error: "Anillo inválido." }, { status: 400 });
    }
    if (finish && !isProductFinish(model, finish)) {
      return Response.json({ ok: false, error: "Color inválido." }, { status: 400 });
    }
    const images = await listGallery(model, {
      finishId: finish && isProductFinish(model, finish) ? finish : undefined,
    });
    return Response.json({ ok: true, images });
  }
  const galleries = await listAllGalleries();
  return Response.json({ ok: true, galleries });
}
