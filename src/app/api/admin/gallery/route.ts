import { jsonError, requirePermission } from "@/server/adminAuth";
import { isProductFinish } from "@/lib/catalog";
import {
  addGalleryImage,
  isModelId,
  listAllGalleries,
  moveGalleryImage,
  removeGalleryImage,
  setGalleryHidden,
} from "@/server/gallery";

async function galleries() {
  return listAllGalleries({ includeHidden: true });
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "gallery");
    return Response.json({ ok: true, galleries: await galleries() });
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
    };
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
