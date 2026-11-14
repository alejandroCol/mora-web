import { createHash } from "crypto";
import type {
  AdsAudience,
  AdsAudienceKey,
  AdsAudienceKind,
  AdsAudiencesState,
  AdsForeignAudience,
} from "@/ads/types";
import { COLLECTIONS } from "@/commerce/paths";
import type { AbandonedCart, MoraOrder } from "@/commerce/types";
import type { MoraLead, WhatsAppConversation } from "@/growth/types";
import { adminDb } from "@/lib/firebaseAdmin";
import { loadGrowthSettings } from "../growthSettings";
import { normalizePhone } from "../metaCapi";
import { requireAdsManage } from "./access";
import { MetaAdsError, graphOne, graphWrite } from "./graph";

/** Qué audiencia de Meta corresponde a cada lista de Mora. Solo Admin SDK. */
const DOC = `${COLLECTIONS.settings}/adsAudiences`;

const DAY = 86_400;
/** Meta no arma una audiencia parecida con menos de 100 personas reconocidas. */
const LOOKALIKE_MIN = 100;

type Def = {
  key: AdsAudienceKey;
  kind: AdsAudienceKind;
  label: string;
  use: string;
  /** Nombre en Meta: con prefijo para distinguirlas de las que creó la agencia. */
  metaName: string;
  origin?: AdsAudienceKey;
};

const DEFS: Def[] = [
  {
    key: "customers",
    kind: "list",
    label: "Clientes",
    use: "Quienes ya pagaron. Exclúyela para no gastar en quien ya compró.",
    metaName: "Mora · Clientes",
  },
  {
    key: "interested",
    kind: "list",
    label: "Escribieron y no compraron",
    use: "Chats y contactos del CRM sin pedido. Para remarketing por WhatsApp.",
    metaName: "Mora · Escribieron y no compraron",
  },
  {
    key: "carts",
    kind: "list",
    label: "Carritos abandonados",
    use: "Dejaron sus datos en el checkout y no pagaron.",
    metaName: "Mora · Carritos abandonados",
  },
  {
    key: "web_visitors",
    kind: "web",
    label: "Visitaron la web",
    use: "Cualquiera que entró a moraring.com en los últimos 30 días.",
    metaName: "Mora · Visitaron la web 30 días",
  },
  {
    key: "web_cart",
    kind: "web",
    label: "Agregaron al carrito sin comprar",
    use: "Agregaron al carrito o empezaron el pago en 14 días y no compraron.",
    metaName: "Mora · Carrito sin compra 14 días",
  },
  {
    key: "ig_engagers",
    kind: "engagement",
    label: "Interactuaron en Instagram",
    use: "Vieron, comentaron, guardaron o escribieron a @moraringco en 90 días.",
    metaName: "Mora · Instagram 90 días",
  },
  {
    key: "like_customers",
    kind: "lookalike",
    label: "Parecidos a clientes",
    use: "El 1 % de Colombia que más se parece a quienes compraron. La mejor para buscar clientes nuevos.",
    metaName: "Mora · Parecidos a clientes 1 %",
    origin: "customers",
  },
  {
    key: "like_interested",
    kind: "lookalike",
    label: "Parecidos a quienes escriben",
    use: "El 1 % de Colombia parecido a quienes escribieron. Útil mientras hay pocos clientes.",
    metaName: "Mora · Parecidos a quienes escriben 1 %",
    origin: "interested",
  },
];

type Stored = { id?: string; syncedAt?: number; local?: number; error?: string };
type StoredDoc = { items?: Partial<Record<AdsAudienceKey, Stored>>; syncedAt?: number };

type MetaAudience = {
  id: string;
  name?: string;
  subtype?: string;
  approximate_count_lower_bound?: number;
  delivery_status?: { code?: number; description?: string };
  operation_status?: { code?: number; description?: string };
};

type Person = { email: string; phone: string; first: string; last: string; city: string; state: string };

async function connection() {
  const settings = await loadGrowthSettings();
  if (!settings.metaAdsToken || !settings.metaAdAccountId) {
    throw Object.assign(new Error("Conecta la cuenta publicitaria de Meta."), { status: 409 });
  }
  return { settings, token: settings.metaAdsToken, accountId: settings.metaAdAccountId };
}

async function loadStored(): Promise<StoredDoc> {
  const snap = await adminDb().doc(DOC).get();
  return snap.exists ? (snap.data() as StoredDoc) : {};
}

async function listMetaAudiences(accountId: string, token: string) {
  const body = await graphOne<{ data?: MetaAudience[] }>(
    `${accountId}/customaudiences`,
    {
      fields: "id,name,subtype,approximate_count_lower_bound,delivery_status,operation_status",
      limit: 200,
    },
    token,
  );
  return body.data ?? [];
}

const KIND_LABEL: Record<string, string> = {
  CUSTOM: "Lista",
  WEBSITE: "Web",
  ENGAGEMENT: "Interacción",
  LOOKALIKE: "Parecidos",
};

function merge(stored: StoredDoc, meta: MetaAudience[]): AdsAudiencesState {
  const byId = new Map(meta.map((item) => [item.id, item]));
  const byName = new Map(meta.map((item) => [item.name ?? "", item]));
  const mine = new Set<string>();

  const audiences: AdsAudience[] = DEFS.map((def) => {
    const saved = stored.items?.[def.key] ?? {};
    // Si el documento no la conoce pero en Meta existe con nuestro nombre, es la misma: no se duplica.
    const live = (saved.id ? byId.get(saved.id) : undefined) ?? byName.get(def.metaName);
    if (live) mine.add(live.id);
    return {
      key: def.key,
      kind: def.kind,
      label: def.label,
      use: def.use,
      id: live?.id ?? "",
      local: saved.local ?? 0,
      size: live?.approximate_count_lower_bound ?? 0,
      ready: live?.delivery_status?.code === 200,
      status: live ? (live.delivery_status?.description ?? live.operation_status?.description ?? "") : "",
      syncedAt: saved.syncedAt ?? 0,
      error: saved.error ?? "",
    };
  });

  const others: AdsForeignAudience[] = meta
    .filter((item) => !mine.has(item.id))
    .map((item) => ({
      id: item.id,
      name: item.name ?? item.id,
      size: item.approximate_count_lower_bound ?? 0,
      kind: KIND_LABEL[item.subtype ?? ""] ?? "Audiencia",
    }));

  return { audiences, others, syncedAt: stored.syncedAt ?? 0 };
}

/** Las audiencias de Mora con su estado en Meta, más las que creó alguien más en la cuenta. */
export async function loadAudiencesState(): Promise<AdsAudiencesState> {
  const { token, accountId } = await connection();
  const [stored, meta, local] = await Promise.all([
    loadStored(),
    listMetaAudiences(accountId, token),
    loadPeople().catch(() => null),
  ]);
  const state = merge(stored, meta);
  if (local) {
    // El tamaño local se cuenta en vivo: así se ve cuánta gente entraría antes de sincronizar.
    for (const audience of state.audiences) {
      if (audience.kind === "list") audience.local = local[audience.key as ListKey].length;
    }
  }
  return state;
}

/* ───────────── Listas de Mora ───────────── */

type ListKey = "customers" | "interested" | "carts";

function personKey(person: Person) {
  return person.phone || person.email;
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.length > 1 ? parts[parts.length - 1] : "" };
}

function isPaid(order: MoraOrder) {
  return Boolean(order.paidAt) && order.status !== "cancelled";
}

/** Quién va en cada lista. Quien ya compró sale de las otras dos. */
async function loadPeople(): Promise<Record<ListKey, Person[]>> {
  const db = adminDb();
  const [orders, chats, leads, carts] = await Promise.all([
    db.collection(COLLECTIONS.orders).where("paidAt", ">", 0).get(),
    db.collection(COLLECTIONS.whatsappConversations).get(),
    db.collection(COLLECTIONS.leads).get(),
    db.collection(COLLECTIONS.abandonedCarts).get(),
  ]);

  const customers = new Map<string, Person>();
  const bought = new Set<string>();
  for (const doc of orders.docs) {
    const order = doc.data() as MoraOrder;
    if (!isPaid(order)) continue;
    const person: Person = {
      email: order.customer?.email?.trim().toLowerCase() ?? "",
      phone: normalizePhone(order.customer?.phone ?? ""),
      first: order.customer?.firstName ?? "",
      last: order.customer?.lastName ?? "",
      city: order.shipping?.ciudad ?? "",
      state: order.shipping?.departamento ?? "",
    };
    const key = personKey(person);
    if (!key) continue;
    customers.set(key, person);
    if (person.phone) bought.add(person.phone);
    if (person.email) bought.add(person.email);
  }
  const isCustomer = (person: Person) => bought.has(person.phone) || bought.has(person.email);

  const interested = new Map<string, Person>();
  for (const doc of chats.docs) {
    const chat = doc.data() as WhatsAppConversation;
    if (chat.desk === "creators" || chat.status === "sold" || chat.status === "closed") continue;
    const name = splitName(chat.name ?? "");
    const person: Person = {
      email: chat.email?.trim().toLowerCase() ?? "",
      phone: normalizePhone(chat.phone ?? ""),
      first: name.first,
      last: name.last,
      city: chat.city ?? "",
      state: "",
    };
    const key = personKey(person);
    if (key && !isCustomer(person)) interested.set(key, person);
  }
  for (const doc of leads.docs) {
    const lead = doc.data() as MoraLead;
    if (lead.status === "sold" || lead.status === "closed") continue;
    const name = splitName(lead.name ?? "");
    const person: Person = {
      email: lead.email?.trim().toLowerCase() ?? "",
      phone: normalizePhone(lead.phone ?? ""),
      first: name.first,
      last: name.last,
      city: "",
      state: "",
    };
    const key = personKey(person);
    if (key && !isCustomer(person) && !interested.has(key)) interested.set(key, person);
  }

  const abandoned = new Map<string, Person>();
  for (const doc of carts.docs) {
    const cart = doc.data() as AbandonedCart;
    if (cart.status === "recovered") continue;
    const person: Person = {
      email: cart.customer?.email?.trim().toLowerCase() ?? "",
      phone: normalizePhone(cart.customer?.phone ?? ""),
      first: cart.customer?.firstName ?? "",
      last: cart.customer?.lastName ?? "",
      city: cart.shipping?.ciudad ?? "",
      state: cart.shipping?.departamento ?? "",
    };
    const key = personKey(person);
    if (key && !isCustomer(person)) abandoned.set(key, person);
  }

  return {
    customers: [...customers.values()],
    interested: [...interested.values()],
    carts: [...abandoned.values()],
  };
}

/* ───────────── Subida a Meta (solo huellas SHA-256) ───────────── */

const SCHEMA = ["EMAIL", "PHONE", "FN", "LN", "CT", "ST", "COUNTRY"];

function sha(value: string) {
  return value ? createHash("sha256").update(value).digest("hex") : "";
}

/** Nombres: minúsculas y sin puntuación (Meta acepta letras con tilde en UTF-8). */
function cleanName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}]/gu, "");
}

/** Ciudad y departamento: solo a–z, sin tildes ni espacios. */
function cleanPlace(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z]/g, "");
}

/** A Meta nunca le llega un dato legible: cada campo viaja como su huella. */
function hashedRow(person: Person) {
  return [
    sha(person.email),
    sha(person.phone),
    sha(cleanName(person.first)),
    sha(cleanName(person.last)),
    sha(cleanPlace(person.city)),
    sha(cleanPlace(person.state)),
    sha("co"),
  ];
}

const BATCH = 5_000;

/**
 * Deja la audiencia en Meta igual a la lista de Mora (quien compró o salió, se va).
 * Si Meta no acepta reemplazar, al menos agrega a los nuevos.
 */
async function uploadPeople(audienceId: string, people: Person[], token: string) {
  const rows = people.map(hashedRow);
  const sessionId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  try {
    for (let i = 0, seq = 1; i < rows.length; i += BATCH, seq += 1) {
      await graphWrite(
        "POST",
        `${audienceId}/usersreplace`,
        {
          session: {
            session_id: sessionId,
            batch_seq: seq,
            last_batch_flag: i + BATCH >= rows.length,
            estimated_num_total: rows.length,
          },
          payload: { schema: SCHEMA, data: rows.slice(i, i + BATCH) },
        },
        token,
      );
    }
  } catch (error) {
    if (!(error instanceof MetaAdsError)) throw error;
    for (let i = 0; i < rows.length; i += BATCH) {
      await graphWrite(
        "POST",
        `${audienceId}/users`,
        { payload: { schema: SCHEMA, data: rows.slice(i, i + BATCH) } },
        token,
      ).catch(() => {
        // El error que explica el problema es el primero.
        throw error;
      });
    }
  }
}

function rule(source: { id: string; type: string }, seconds: number, filter: { field: string; value: string }) {
  return {
    event_sources: [source],
    retention_seconds: seconds,
    filter: {
      operator: "and",
      filters: [{ field: filter.field, operator: filter.field === "url" ? "i_contains" : "eq", value: filter.value }],
    },
  };
}

function createBody(def: Def, ids: { pixel: string; instagram: string; origin: string }): Record<string, unknown> | string {
  const base = { name: def.metaName, description: `${def.label}. La mantiene Mora: no la edites a mano.` };
  if (def.kind === "list") {
    return { ...base, subtype: "CUSTOM", customer_file_source: "USER_PROVIDED_ONLY" };
  }
  if (def.kind === "lookalike") {
    if (!ids.origin) return "Primero tiene que existir la lista de la que sale.";
    return {
      name: def.metaName,
      subtype: "LOOKALIKE",
      origin_audience_id: ids.origin,
      lookalike_spec: JSON.stringify({ ratio: 0.01, country: "CO" }),
    };
  }
  if (def.kind === "engagement") {
    if (!ids.instagram) return "Conecta Instagram en Automatizaciones.";
    const source = { id: ids.instagram, type: "ig_business" };
    return {
      ...base,
      prefill: true,
      rule: JSON.stringify({
        inclusions: { operator: "or", rules: [rule(source, 90 * DAY, { field: "event", value: "ig_business_profile_all" })] },
      }),
    };
  }
  if (!ids.pixel) return "Falta el id del Pixel en Crecimiento.";
  const pixel = { id: ids.pixel, type: "pixel" };
  if (def.key === "web_visitors") {
    return {
      ...base,
      prefill: true,
      rule: JSON.stringify({
        inclusions: { operator: "or", rules: [rule(pixel, 30 * DAY, { field: "url", value: "" })] },
      }),
    };
  }
  return {
    ...base,
    prefill: true,
    rule: JSON.stringify({
      inclusions: {
        operator: "or",
        rules: [
          rule(pixel, 14 * DAY, { field: "event", value: "AddToCart" }),
          rule(pixel, 14 * DAY, { field: "event", value: "InitiateCheckout" }),
        ],
      },
      exclusions: { operator: "or", rules: [rule(pixel, 14 * DAY, { field: "event", value: "Purchase" })] },
    }),
  };
}

function plain(error: unknown) {
  if (error instanceof MetaAdsError) return `Meta: ${error.message}`;
  return error instanceof Error ? error.message : "No se pudo sincronizar.";
}

/**
 * Crea en Meta las audiencias que falten y deja las listas al día.
 * Cada una va por separado: si una falla, las demás siguen y el motivo queda guardado.
 */
export async function syncAudiences(): Promise<AdsAudiencesState> {
  await requireAdsManage();
  const { settings, token, accountId } = await connection();
  const [stored, meta, people] = await Promise.all([loadStored(), listMetaAudiences(accountId, token), loadPeople()]);
  const current = merge(stored, meta);
  const ids = new Map<AdsAudienceKey, string>(current.audiences.map((item) => [item.key, item.id]));
  const items: Partial<Record<AdsAudienceKey, Stored>> = { ...(stored.items ?? {}) };
  const now = Date.now();

  for (const def of DEFS) {
    const local = def.kind === "list" ? people[def.key as ListKey] : [];
    const entry: Stored = { id: ids.get(def.key) ?? "", syncedAt: now, local: local.length, error: "" };
    try {
      if (def.kind === "list" && local.length === 0 && !entry.id) {
        entry.error = "Aún no hay nadie para esta lista.";
      } else if (def.kind === "lookalike" && !entry.id && people[def.origin as ListKey].length < LOOKALIKE_MIN) {
        const source = DEFS.find((item) => item.key === def.origin)?.label ?? "";
        entry.error = `Meta pide al menos ${LOOKALIKE_MIN} personas en «${source}» para buscar parecidos. Hoy hay ${people[def.origin as ListKey].length}.`;
      } else {
        if (!entry.id) {
          const body = createBody(def, {
            pixel: settings.metaPixelId,
            instagram: settings.instagramAccountId,
            origin: def.origin ? (ids.get(def.origin) ?? "") : "",
          });
          if (typeof body === "string") {
            entry.error = body;
          } else {
            const created = await graphWrite<{ id: string }>("POST", `${accountId}/customaudiences`, body, token);
            entry.id = created.id;
            ids.set(def.key, created.id);
          }
        }
        if (entry.id && def.kind === "list" && local.length > 0) await uploadPeople(entry.id, local, token);
      }
    } catch (error) {
      entry.error = plain(error);
    }
    items[def.key] = entry;
  }

  await adminDb().doc(DOC).set({ items, syncedAt: now }, { merge: true });
  return loadAudiencesState();
}
