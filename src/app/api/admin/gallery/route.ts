import { jsonError, requirePermission } from "@/server/adminAuth";
import { isProductFinish } from "@/lib/catalog";
import {
  addGalleryImage,
  isModelId,
  listAllGalleries,
  moveGalleryImage,
  removeGalleryImage,
  reorderGallery,
  setGalleryHidden,
} from "@/server/gallery";
import { getProductDescriptions, setProductDescription } from "@/server/productCopy";

async function galleries() {
  return listAllGalleries({ includeHidden: true });
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "gallery");
    const [rows, descriptions] = await Promise.all([galleries(), getProductDescriptions()]);
    return Response.json({ ok: true, galleries: rows, descriptions });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission(request, "gallery");
    const type = request.headers.get("content-type") ?? "";
    let modelId = "";
    let finishId = "";
    let src: string | undefined;
    let buffer: Buffer | undefined;
    let mime: string | undefined;

    if (type.includes("multipart/form-data")) {
      const form = await request.formData();
      modelId = String(form.get("modelId") ?? "");
      finishId = String(form.get("finishId") ?? "");
      const file = form.get("file");
      if (file instanceof File && file.size > 0) {
        buffer = Buffer.from(await file.arrayBuffer());
        mime = file.type || "image/jpeg";
      }
    } else {
      const body = (await request.json()) as {
        modelId?: string;
        finishId?: string;
        src?: string;
      };
      modelId = body.modelId ?? "";
      finishId = body.finishId ?? "";
      src = typeof body.src === "string" ? body.src : undefined;
    }

    if (!isModelId(modelId) || !isProductFinish(modelId, finishId) || (!buffer && !src)) {
      return Response.json({ ok: false, error: "Anillo, color e imagen." }, { status: 400 });
    }
    const image = await addGalleryImage({ modelId, finishId, src, buffer, mime });
    return Response.json({ ok: true, image, galleries: await galleries() });
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
      hidden?: boolean;
      modelId?: string;
      finishId?: string;
      order?: string[];
      description?: string;
    };
    if (
      isModelId(body.modelId) &&
      isProductFinish(body.modelId, body.finishId) &&
      Array.isArray(body.order)
    ) {
      const order = body.order.filter((id): id is string => typeof id === "string" && id.length > 0);
      await reorderGallery(body.modelId, body.finishId, order);
      return Response.json({ ok: true, galleries: await galleries() });
    }
    if (isModelId(body.modelId) && typeof body.description === "string") {
      const description = await setProductDescription(body.modelId, body.description);
      return Response.json({
        ok: true,
        galleries: await galleries(),
        descriptions: await getProductDescriptions(),
        description,
      });
    }
    if (!body.id) {
      return Response.json({ ok: false, error: "Imagen." }, { status: 400 });
    }
    if (typeof body.hidden === "boolean") {
      await setGalleryHidden(body.id, body.hidden);
      return Response.json({ ok: true, galleries: await galleries() });
    }
    if (body.direction !== "up" && body.direction !== "down") {
      return Response.json({ ok: false, error: "Imagen y dirección." }, { status: 400 });
    }
    await moveGalleryImage(body.id, body.direction);
    return Response.json({ ok: true, galleries: await galleries() });
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
    return Response.json({ ok: true, galleries: await galleries() });
  } catch (error) {
    return jsonError(error);
  }
}
