import { DOCS } from "@/commerce/paths";
import { products, type ModelId } from "@/lib/catalog";
import { adminDb } from "@/lib/firebaseAdmin";

const MAX_CHARS = 400;

export function defaultDescription(modelId: ModelId) {
  return products[modelId].promise;
}

export async function getProductDescriptions(): Promise<Record<ModelId, string>> {
  const fallback = {
    aero: defaultDescription("aero"),
    titan: defaultDescription("titan"),
  };
  try {
    const data = (await adminDb().doc(DOCS.productCopy).get()).data() ?? {};
    return {
      aero:
        typeof data.aero === "string" && data.aero.trim()
          ? data.aero.trim()
          : fallback.aero,
      titan:
        typeof data.titan === "string" && data.titan.trim()
          ? data.titan.trim()
          : fallback.titan,
    };
  } catch {
    return fallback;
  }
}

export async function setProductDescription(modelId: ModelId, description: string) {
  const text = description.trim().slice(0, MAX_CHARS);
  await adminDb()
    .doc(DOCS.productCopy)
    .set({ [modelId]: text, updatedAt: Date.now() }, { merge: true });
  return text;
}
