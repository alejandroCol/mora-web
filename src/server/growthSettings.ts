import { COLLECTIONS } from "@/commerce/paths";
import type { GrowthSettings, PublicGrowthConfig } from "@/growth/types";
import { adminDb } from "@/lib/firebaseAdmin";

const DOC = `${COLLECTIONS.settings}/growth`;

function fromEnv(): GrowthSettings {
  return {
    metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "",
    metaCapiToken: process.env.META_CAPI_TOKEN?.trim() ?? "",
    metaCapiTestEventCode: process.env.META_CAPI_TEST_EVENT_CODE?.trim() ?? "",
    googleSiteVerification:
      process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() ?? "",
    whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() ?? "",
    whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN?.trim() ?? "",
    whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN?.trim() ?? "",
    whatsappAppSecret: process.env.WHATSAPP_APP_SECRET?.trim() ?? "",
    whatsappDisplayNumber:
      process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") ?? "",
    whatsappWelcome:
      process.env.WHATSAPP_WELCOME?.trim() ??
      "Hola, soy Mora. Dime modelo, color y talla y te ayudo a reservarlo.",
    whatsappPrefill:
      process.env.WHATSAPP_PREFILL?.trim() ??
      "Hola Mora, quiero un anillo. ¿Me orientan?",
    updatedAt: 0,
  };
}

export async function loadGrowthSettings(): Promise<GrowthSettings> {
  const fallback = fromEnv();
  try {
    const snap = await adminDb().doc(DOC).get();
    if (!snap.exists) return fallback;
    const data = snap.data() as Partial<GrowthSettings>;
    return {
      ...fallback,
      ...data,
      metaPixelId: data.metaPixelId || fallback.metaPixelId,
      metaCapiToken: data.metaCapiToken || fallback.metaCapiToken,
      whatsappPhoneNumberId:
        data.whatsappPhoneNumberId || fallback.whatsappPhoneNumberId,
      whatsappAccessToken:
        data.whatsappAccessToken || fallback.whatsappAccessToken,
      whatsappVerifyToken:
        data.whatsappVerifyToken || fallback.whatsappVerifyToken,
      whatsappDisplayNumber: (data.whatsappDisplayNumber || fallback.whatsappDisplayNumber)
        .replace(/\D/g, ""),
    };
  } catch (error) {
    console.error("[growth settings]", error);
    return fallback;
  }
}

export async function saveGrowthSettings(
  patch: Partial<GrowthSettings>,
): Promise<GrowthSettings> {
  const current = await loadGrowthSettings();
  const next: GrowthSettings = {
    ...current,
    ...cleanPatch(patch, current),
    updatedAt: Date.now(),
  };
  await adminDb().doc(DOC).set(next, { merge: true });
  return next;
}

function looksMasked(value: string | undefined) {
  return Boolean(value && (value.includes("•") || value.includes("…")));
}

function cleanPatch(
  patch: Partial<GrowthSettings>,
  current: GrowthSettings,
): Partial<GrowthSettings> {
  const next = { ...patch };
  const secrets = [
    "metaCapiToken",
    "whatsappAccessToken",
    "whatsappVerifyToken",
    "whatsappAppSecret",
  ] as const;
  for (const key of secrets) {
    const value = next[key];
    if (typeof value === "string" && looksMasked(value)) delete next[key];
    if (next[key] === "") next[key] = current[key];
  }
  if (next.whatsappDisplayNumber) {
    next.whatsappDisplayNumber = next.whatsappDisplayNumber.replace(/\D/g, "");
  }
  return next;
}

export function publicGrowthConfig(settings: GrowthSettings): PublicGrowthConfig {
  return {
    pixelId: settings.metaPixelId,
    whatsappDisplayNumber: settings.whatsappDisplayNumber,
    whatsappPrefill: settings.whatsappPrefill,
  };
}

export function maskSecret(value: string) {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return `${"•".repeat(Math.min(16, value.length - 4))}${value.slice(-4)}`;
}

export function publicAdminGrowth(settings: GrowthSettings) {
  return {
    ...settings,
    metaCapiToken: maskSecret(settings.metaCapiToken),
    whatsappAccessToken: maskSecret(settings.whatsappAccessToken),
    whatsappVerifyToken: maskSecret(settings.whatsappVerifyToken),
    whatsappAppSecret: maskSecret(settings.whatsappAppSecret),
    configured: {
      pixel: Boolean(settings.metaPixelId),
      capi: Boolean(settings.metaCapiToken && settings.metaPixelId),
      whatsapp: Boolean(
        settings.whatsappPhoneNumberId &&
          settings.whatsappAccessToken &&
          settings.whatsappDisplayNumber,
      ),
    },
  };
}
