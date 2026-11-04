import { cookies } from "next/headers";
import { LEGAL_LANG_COOKIE, isLegalLang, type LegalLang } from "./lang";

/** Query string wins, then the flag the reader already chose. */
export async function resolveLegalLang(
  query: string | undefined,
  fallback: LegalLang,
): Promise<LegalLang> {
  if (isLegalLang(query)) return query;
  const jar = await cookies();
  const saved = jar.get(LEGAL_LANG_COOKIE)?.value;
  if (isLegalLang(saved)) return saved;
  return fallback;
}
