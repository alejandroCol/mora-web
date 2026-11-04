export const LEGAL_LANG_COOKIE = "mora_legal_lang";

export type LegalLang = "es" | "en";

export function isLegalLang(value: string | undefined | null): value is LegalLang {
  return value === "es" || value === "en";
}
