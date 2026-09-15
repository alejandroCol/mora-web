import type { AttributionSnapshot } from "@/commerce/types";
import type { GrowthEventPayload, MetaStandardEvent } from "@/growth/types";
import { upsertLead } from "@/server/leads";
import { requestClient, sendMetaEvent } from "@/server/metaCapi";

const EVENTS = new Set<MetaStandardEvent>([
  "PageView",
  "ViewContent",
  "AddToCart",
  "InitiateCheckout",
  "AddPaymentInfo",
  "Lead",
  "Contact",
  "Purchase",
  "CompleteRegistration",
]);

type Body = {
  name?: MetaStandardEvent;
  data?: GrowthEventPayload;
  eventId?: string;
  attribution?: AttributionSnapshot;
  user?: { email?: string; phone?: string; firstName?: string };
  url?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as Body;
  if (!body.name || !EVENTS.has(body.name) || !body.eventId) {
    return Response.json({ ok: false }, { status: 400 });
  }

  const client = requestClient(request);
  await sendMetaEvent({
    name: body.name,
    eventId: body.eventId,
    sourceUrl: body.url,
    data: body.data,
    attribution: body.attribution,
    user: body.user,
    ...client,
  });

  if (
    (body.name === "Lead" || body.name === "Contact" || body.name === "InitiateCheckout") &&
    (body.user?.email || body.user?.phone)
  ) {
    await upsertLead({
      source: body.attribution?.fbclid ? "ad" : body.name === "Contact" ? "whatsapp" : "site",
      name: body.user.firstName,
      email: body.user.email,
      phone: body.user.phone,
      attribution: body.attribution,
      lastEvent: body.name,
      status: "interested",
    }).catch(() => undefined);
  }

  return Response.json({ ok: true });
}
