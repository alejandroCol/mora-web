import { WINDOW_MS } from "@/crm/labels";
import {
  CTWA_FREE_WINDOW_MS,
  SERVICE_FREE_MESSAGES_PER_MONTH,
  SERVICE_FREE_TIER_START_MS,
  WHATSAPP_COP_PER_USD,
  WHATSAPP_MARKET,
  WHATSAPP_PRICING_DOC,
  WHATSAPP_RATES_USD,
  monthRangeBogota,
  type WhatsAppBillCategory,
} from "@/crm/whatsappPricing";
import type { CrmTemplate, WhatsAppConversation, WhatsAppMessage, WhatsAppUsageReport } from "@/growth/types";
import { listConversations } from "./whatsapp";
import { adminDb } from "@/lib/firebaseAdmin";
import { COLLECTIONS } from "@/commerce/paths";

function messagesCol(conversationId: string) {
  return adminDb()
    .collection(COLLECTIONS.whatsappConversations)
    .doc(conversationId)
    .collection("messages");
}

function isDelivered(msg: WhatsAppMessage) {
  const status = (msg.status ?? "sent").toLowerCase();
  return status !== "failed" && status !== "deleted" && status !== "warning";
}

function templateCategory(
  msg: WhatsAppMessage,
  templates: CrmTemplate[],
): WhatsAppBillCategory {
  if (msg.billingCategory === "marketing" || msg.billingCategory === "utility" || msg.billingCategory === "authentication") {
    return msg.billingCategory;
  }
  const name = msg.templateName ?? msg.text.replace(/^Plantilla\s+/i, "").trim();
  const hit = templates.find((t) => t.name === name);
  if (hit?.billingCategory) return hit.billingCategory;
  return "marketing";
}

function ctwaFreeUntil(conversation: WhatsAppConversation, firstInboundAt: number) {
  if (!conversation.referral && conversation.source !== "ad") return 0;
  const anchor =
    firstInboundAt ||
    conversation.lastInboundAt ||
    (conversation.referral ? conversation.lastAt : 0);
  return anchor > 0 ? anchor + CTWA_FREE_WINDOW_MS : 0;
}

function classifyOutbound(
  msg: WhatsAppMessage,
  conversation: WhatsAppConversation,
  lastInboundBefore: number | null,
  firstInboundAt: number,
  templates: CrmTemplate[],
): WhatsAppBillCategory {
  if (msg.type === "template") return templateCategory(msg, templates);

  const ctwaUntil = ctwaFreeUntil(conversation, firstInboundAt);
  if (ctwaUntil > 0 && msg.at <= ctwaUntil) return "free_ctwa";

  if (lastInboundBefore && msg.at - lastInboundBefore <= WINDOW_MS) return "service";

  return "utility";
}

export async function loadWhatsAppUsage(templates: CrmTemplate[] = []): Promise<WhatsAppUsageReport> {
  const month = monthRangeBogota();
  const conversations = await listConversations(400);

  type Billable = { at: number; category: WhatsAppBillCategory };
  const billable: Billable[] = [];
  let inbound = 0;

  for (const conversation of conversations) {
    const lookbackStart = month.start - CTWA_FREE_WINDOW_MS;
    const snap = await messagesCol(conversation.id)
      .where("at", ">=", lookbackStart)
      .orderBy("at", "asc")
      .limit(400)
      .get();

    const thread = snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<WhatsAppMessage, "id">),
    }));

    let lastInbound: number | null = null;
    let firstInbound: number | null = null;

    for (const msg of thread) {
      if (msg.direction === "in") {
        inbound += msg.at >= month.start && msg.at < month.end ? 1 : 0;
        lastInbound = msg.at;
        if (!firstInbound) firstInbound = msg.at;
        continue;
      }
      if (msg.direction !== "out") continue;
      if (msg.at < month.start || msg.at >= month.end) continue;
      if (!isDelivered(msg)) continue;

      const category = classifyOutbound(
        msg,
        conversation,
        lastInbound,
        firstInbound ?? conversation.lastInboundAt ?? 0,
        templates,
      );
      billable.push({ at: msg.at, category });
    }
  }

  billable.sort((a, b) => a.at - b.at);

  const serviceFreeActive = month.end > SERVICE_FREE_TIER_START_MS;
  let serviceFreeUsed = 0;

  const byCategory: WhatsAppUsageReport["byCategory"] = {
    marketing: { count: 0, unitUsd: WHATSAPP_RATES_USD.marketing, subtotalUsd: 0 },
    utility: { count: 0, unitUsd: WHATSAPP_RATES_USD.utility, subtotalUsd: 0 },
    authentication: { count: 0, unitUsd: WHATSAPP_RATES_USD.authentication, subtotalUsd: 0 },
    service: { count: 0, unitUsd: WHATSAPP_RATES_USD.service, subtotalUsd: 0 },
    free_service_tier: { count: 0, unitUsd: 0, subtotalUsd: 0 },
    free_ctwa: { count: 0, unitUsd: 0, subtotalUsd: 0 },
  };

  let estimatedUsd = 0;

  for (const item of billable) {
    if (item.category === "free_ctwa") {
      byCategory.free_ctwa.count += 1;
      continue;
    }

    if (item.category === "service") {
      if (serviceFreeActive && serviceFreeUsed < SERVICE_FREE_MESSAGES_PER_MONTH) {
        serviceFreeUsed += 1;
        byCategory.free_service_tier.count += 1;
        continue;
      }
      byCategory.service.count += 1;
      byCategory.service.subtotalUsd += WHATSAPP_RATES_USD.service;
      estimatedUsd += WHATSAPP_RATES_USD.service;
      continue;
    }

    const row = byCategory[item.category];
    if (!row) continue;
    row.count += 1;
    row.subtotalUsd += row.unitUsd;
    estimatedUsd += row.unitUsd;
  }

  const outboundDelivered = billable.length;

  return {
    monthKey: month.key,
    monthLabel: month.label,
    timezone: "America/Bogota",
    updatedAt: Date.now(),
    source: "firestore_estimate",
    policyNote:
      "Estimación según mensajes guardados en Mora y tarifas Meta Colombia. Meta cobra al entregar; la factura oficial está en Business Manager.",
    totals: {
      inbound,
      outboundDelivered,
      estimatedUsd,
      estimatedCop: Math.round(estimatedUsd * WHATSAPP_COP_PER_USD),
    },
    freeAllowance: {
      servicePerMonth: SERVICE_FREE_MESSAGES_PER_MONTH,
      serviceUsed: serviceFreeUsed,
      serviceRemaining: Math.max(0, SERVICE_FREE_MESSAGES_PER_MONTH - serviceFreeUsed),
      serviceBillingEffectiveFrom: "2026-10-01",
    },
    byCategory,
    rates: {
      market: WHATSAPP_MARKET,
      copPerUsd: WHATSAPP_COP_PER_USD,
      effectiveQuarter: "2026-Q4",
    },
    docUrl: WHATSAPP_PRICING_DOC,
  };
}
