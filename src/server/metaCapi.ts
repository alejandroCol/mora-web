import { createHash } from "crypto";
import type {
  AttributionSnapshot,
  GrowthEventPayload,
  MetaStandardEvent,
} from "@/growth/types";
import { loadGrowthSettings } from "./growthSettings";

type UserHints = {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  country?: string;
};

type CapiInput = {
  name: MetaStandardEvent;
  eventId: string;
  sourceUrl?: string;
  data?: GrowthEventPayload;
  attribution?: AttributionSnapshot;
  user?: UserHints;
  ip?: string;
  userAgent?: string;
  actionSource?: "website" | "system_generated" | "business_messaging";
};

function sha256(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("57") && digits.length >= 12) return digits;
  if (digits.length === 10) return `57${digits}`;
  return digits;
}

function hashedUser(user: UserHints | undefined, attribution?: AttributionSnapshot) {
  const email = user?.email?.trim().toLowerCase();
  const phone = user?.phone ? normalizePhone(user.phone) : "";
  return {
    em: email ? [sha256(email)] : undefined,
    ph: phone ? [sha256(phone)] : undefined,
    fn: user?.firstName?.trim() ? [sha256(user.firstName)] : undefined,
    ln: user?.lastName?.trim() ? [sha256(user.lastName)] : undefined,
    ct: user?.city?.trim() ? [sha256(user.city)] : undefined,
    st: user?.state?.trim() ? [sha256(user.state)] : undefined,
    country: user?.country ? [sha256(user.country)] : [sha256("co")],
    fbp: attribution?.fbp,
    fbc: attribution?.fbc,
  };
}

export async function sendMetaEvent(input: CapiInput) {
  const settings = await loadGrowthSettings();
  if (!settings.metaPixelId || !settings.metaCapiToken) return { ok: false as const };

  const event = {
    event_name: input.name,
    event_time: Math.floor(Date.now() / 1000),
    event_id: input.eventId,
    event_source_url: input.sourceUrl,
    action_source: input.actionSource ?? "website",
    user_data: {
      ...hashedUser(input.user, input.attribution),
      client_ip_address: input.ip,
      client_user_agent: input.userAgent,
    },
    custom_data: {
      currency: input.data?.currency ?? "COP",
      ...input.data,
    },
  };

  const body: Record<string, unknown> = {
    data: [event],
    access_token: settings.metaCapiToken,
  };
  if (settings.metaCapiTestEventCode) {
    body.test_event_code = settings.metaCapiTestEventCode;
  }

  const url = `https://graph.facebook.com/v21.0/${settings.metaPixelId}/events`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[meta capi]", res.status, text);
      return { ok: false as const };
    }
    return { ok: true as const };
  } catch (error) {
    console.error("[meta capi]", error);
    return { ok: false as const };
  }
}

export function requestClient(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  return {
    ip: forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined,
    userAgent: request.headers.get("user-agent") || undefined,
  };
}
