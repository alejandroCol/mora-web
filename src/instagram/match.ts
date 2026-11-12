import type { InstagramAutomation } from "./types";

/**
 * Deja el texto comparable: minúsculas, sin tildes, sin signos.
 * «¡INFO!!» y «infó» quedan como «info».
 */
export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * La palabra (o frase) aparece completa en el comentario. «info» coincide con
 * «quiero info» pero no con «información»: para eso se agrega como otra palabra.
 * Un emoji u otro signo como clave se busca tal cual.
 */
export function matchesKeyword(comment: string, keyword: string) {
  const needle = normalizeText(keyword);
  if (!needle) {
    const raw = keyword.trim();
    return raw !== "" && comment.includes(raw);
  }
  return ` ${normalizeText(comment)} `.includes(` ${needle} `);
}

type Rule = Pick<InstagramAutomation, "id" | "active" | "scope" | "media" | "trigger" | "keywords" | "createdAt">;

function appliesToMedia(rule: Rule, mediaIds: string[]) {
  if (rule.scope === "all") return true;
  return rule.media.some((item) => mediaIds.includes(item.id));
}

function matchesText(rule: Rule, text: string) {
  if (rule.trigger === "any") return true;
  return rule.keywords.some((keyword) => matchesKeyword(text, keyword));
}

/**
 * Regla que responde a este comentario. Gana la más específica: primero las de
 * una publicación concreta, luego las de palabra clave, y entre iguales la más antigua.
 */
export function pickAutomation<T extends Rule>(
  rules: T[],
  comment: { text: string; mediaIds: string[] },
): T | null {
  const candidates = rules.filter(
    (rule) => rule.active && appliesToMedia(rule, comment.mediaIds) && matchesText(rule, comment.text),
  );
  if (candidates.length === 0) return null;
  const rank = (rule: T) => (rule.scope === "media" ? 0 : 2) + (rule.trigger === "keywords" ? 0 : 1);
  return candidates.sort((a, b) => rank(a) - rank(b) || a.createdAt - b.createdAt)[0];
}
