import { jsonError, requirePermission } from "@/server/adminAuth";
import {
  addGalleryImage,
  isModelId,
  listAllGalleries,
  moveGalleryImage,
  removeGalleryImage,
} from "@/server/gallery";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "gallery");
    const galleries = await listAllGalleries();
    return Response.json({ ok: true, galleries });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission(request, "gallery");
    const body = (await request.json()) as { modelId?: string; src?: string };
    if (!isModelId(body.modelId) || typeof body.src !== "string") {
      return Response.json({ ok: false, error: "Anillo e imagen." }, { status: 400 });
    }
    const image = await addGalleryImage({ modelId: body.modelId, src: body.src });
    const galleries = await listAllGalleries();
    return Response.json({ ok: true, image, galleries });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requirePermission(request, "gallery");
    const body = (await request.json()) as {
      id?: string;
      direction?: "up" | "down";
    };
    if (!body.id || (body.direction !== "up" && body.direction !== "down")) {
      return Response.json({ ok: false, error: "Imagen y dirección." }, { status: 400 });
    }
    await moveGalleryImage(body.id, body.direction);
    const galleries = await listAllGalleries();
    return Response.json({ ok: true, galleries });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requirePermission(request, "gallery");
    const body = (await request.json()) as { id?: string };
    if (!body.id) {
      return Response.json({ ok: false, error: "Imagen." }, { status: 400 });
    }
    await removeGalleryImage(body.id);
    const galleries = await listAllGalleries();
    return Response.json({ ok: true, galleries });
  } catch (error) {
    return jsonError(error);
  }
}
