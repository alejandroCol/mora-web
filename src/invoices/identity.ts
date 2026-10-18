const MATIAS_IDENTITY_ID: Record<string, string> = {
  CC: "1",
  NIT: "3",
  CE: "22",
  TI: "4",
  PA: "41",
  PEP: "48",
  RC: "11",
};

export function normalizeDocumentType(raw: string | undefined) {
  const t = (raw ?? "").trim().toUpperCase();
  if (!t || t === "C.C." || t === "C.C" || t.startsWith("CEDULA DE CIUDADANIA")) {
    return "CC";
  }
  if (t === "PP" || t.startsWith("PASAPORTE")) return "PA";
  if (t.startsWith("CEDULA DE EXTRANJERIA") || t === "C.E.") return "CE";
  if (t.includes("TARJETA") && t.includes("IDENT")) return "TI";
  return t.split(/[\s-–—]/)[0] ?? "CC";
}

export function matiasIdentityDocumentId(raw: string | undefined) {
  return MATIAS_IDENTITY_ID[normalizeDocumentType(raw)] ?? null;
}

export function matiasTypeOrganizationId(raw: string | undefined) {
  return normalizeDocumentType(raw) === "NIT" ? 1 : 2;
}

export function digitsOnly(value: string | undefined) {
  return (value ?? "").replace(/\D/g, "");
}
