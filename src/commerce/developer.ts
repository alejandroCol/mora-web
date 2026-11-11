/**
 * Developer (solo founder): feature flags de las apps y códigos que regalan un espíritu.
 * Las apps no leen Firestore: piden la Function `appConfig` (repo `mora-backend`, `src/flags.ts` y
 * `src/spirits/codes.ts`), que evalúa estas mismas formas. Si cambias una forma aquí, cámbiala allá.
 */

/** Apagada para todos, encendida solo para probadores, o encendida para todos. */
export type FlagStage = "off" | "testers" | "on";

export const FLAG_STAGES: FlagStage[] = ["off", "testers", "on"];

export const FLAG_STAGE_LABEL: Record<FlagStage, string> = {
  off: "Apagada",
  testers: "Probadores",
  on: "Todos",
};

export type FeatureFlagRecord = {
  key: string;
  stage: FlagStage;
  /** Correos (o uids) que la ven en la etapa `testers`. En minúsculas. */
  testers: string[];
  note?: string;
  updatedAt: number;
  updatedBy?: string;
  /** La app la conoce (está en `KNOWN_FLAGS`). Las demás son claves sueltas, aún sin código. */
  known: boolean;
};

/** Flags que las apps ya saben leer. Una nueva: aquí, en `FLAG_DEFAULTS` del backend y en `MoraFlag` de las apps. */
export const KNOWN_FLAGS: { key: string; label: string; blurb: string }[] = [
  {
    key: "legendary_spirits",
    label: "Espíritus legendarios",
    blurb: "Vínculo muestra «Cambiar mi espíritu»: la persona canjea un código y recibe un espíritu legendario sin perder nivel ni progreso.",
  },
];

const FLAG_KEY = /^[a-z][a-z0-9_]{1,39}$/;
export const FLAG_TESTERS_MAX = 200;

export function isFlagKey(value: unknown): value is string {
  return typeof value === "string" && FLAG_KEY.test(value);
}

export function normalizeFlagKey(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 40);
}

/** Correos o uids, uno por línea o separados por coma. Sin repetidos. */
export function cleanTesters(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[\s,;]+/) : [];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const value = item.trim().toLowerCase();
    if (value && value.length <= 120 && !out.includes(value)) out.push(value);
  }
  return out.slice(0, FLAG_TESTERS_MAX);
}

/** Espíritus que solo llegan por código. `lineage` es el id que entienden las apps y el backend. */
export const GIFT_SPIRITS: { lineage: string; name: string; blurb: string }[] = [
  { lineage: "cocker", name: "Mimi", blurb: "Cocker spaniel de orejas de seda. Legendaria." },
];

export function giftSpiritName(lineage: string) {
  return GIFT_SPIRITS.find((spirit) => spirit.lineage === lineage)?.name ?? lineage;
}

export type SpiritCodeRecord = {
  code: string;
  lineage: string;
  active: boolean;
  /** Tope de personas distintas. `null` = sin tope. */
  maxUses: number | null;
  uses: number;
  /** Epoch ms. `null` = no vence. */
  expiresAt: number | null;
  note?: string;
  createdAt: number;
  createdBy?: string;
  updatedAt: number;
};

export type SpiritCodeStatus = "active" | "paused" | "expired" | "exhausted";

export const SPIRIT_CODE_STATUS_LABEL: Record<SpiritCodeStatus, string> = {
  active: "Activo",
  paused: "En pausa",
  expired: "Vencido",
  exhausted: "Agotado",
};

/** Igual que en la app: mayúsculas, solo letras y números. `" co-cker "` es `COCKER`. */
export function normalizeSpiritCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 24);
}

export function isSpiritCodeFormat(code: string) {
  return /^[A-Z0-9]{3,24}$/.test(code);
}

export function spiritCodeStatus(code: SpiritCodeRecord, now = Date.now()): SpiritCodeStatus {
  if (!code.active) return "paused";
  if (code.expiresAt != null && now >= code.expiresAt) return "expired";
  if (code.maxUses != null && code.uses >= code.maxUses) return "exhausted";
  return "active";
}
