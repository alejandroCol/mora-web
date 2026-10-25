export const MIN_FOLLOWERS = 20_000;
export const MAX_FOLLOWERS = 500_000_000;
export const MAX_SHOTS = 4;

export const NETWORKS = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "otra", label: "Otra" },
] as const;

export type NetworkId = (typeof NETWORKS)[number]["id"];

export const CREATOR_COPY = {
  name: "Escribe tu nombre.",
  email: "Revisa el correo.",
  phone: "Revisa el WhatsApp.",
  network: "Elige una red.",
  networkName: "Cuéntanos cuál red.",
  handle: "Escribe tu usuario, sin espacios.",
  followersMissing: "Escribe cuántos seguidores tienes.",
  followers: "Para esta primicia hacen falta más de 20 mil seguidores.",
  followersHigh: "Revisa esa cifra de seguidores.",
  audience: "Cuéntanos a quién le hablas, en una frase.",
  shots: "Adjunta al menos un pantallazo de las estadísticas.",
} as const;

export function isNetworkId(value: string): value is NetworkId {
  return NETWORKS.some((item) => item.id === value);
}

export function networkLabel(id: NetworkId, custom = "") {
  if (id === "otra") return custom.trim() || "Otra";
  return NETWORKS.find((item) => item.id === id)?.label ?? id;
}

export function cleanName(value: string) {
  const name = value.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 80) return null;
  if (!/\p{L}/u.test(name)) return null;
  return name;
}

export function cleanEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 120) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function cleanPhone(value: string) {
  const trimmed = value.trim();
  const plus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return plus ? `+${digits}` : digits;
}

export function cleanHandle(value: string) {
  let raw = value.trim();
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const parts = url.pathname.split("/").filter(Boolean);
      raw = decodeURIComponent(parts[parts.length - 1] ?? "");
    } catch {
      return null;
    }
  }
  raw = raw.replace(/^@+/, "").replace(/\s+/g, "").replace(/\/+$/, "");
  if (!/^[\p{L}\p{N}._]{2,40}$/u.test(raw)) return null;
  return raw;
}

export function cleanNetworkName(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length < 2 || text.length > 32) return null;
  return text;
}

export function cleanAudience(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length < 8 || text.length > 280) return null;
  return text;
}

export function parseFollowers(value: string) {
  const raw = value.trim().toLowerCase().replace(/\s/g, "");
  if (!raw) return null;
  const thousands = raw.match(/^(\d+(?:[.,]\d{1,2})?)k$/);
  if (thousands) {
    const n = Number(thousands[1].replace(",", ".")) * 1000;
    if (!Number.isFinite(n)) return null;
    return Math.round(n);
  }
  const digits = raw.replace(/\D/g, "");
  if (!digits || digits.length > 9) return null;
  const n = Number(digits);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function formatFollowers(value: number) {
  return new Intl.NumberFormat("es-CO").format(value);
}

export type CreatorFields = {
  name: string;
  email: string;
  phone: string;
  network: NetworkId;
  networkName: string;
  handle: string;
  followers: number;
  secondaryNetwork: NetworkId | "";
  secondaryName: string;
  secondaryHandle: string;
  audience: string;
};

export type FieldIssue = { field: string; text: string };

export type CreatorRecordView = {
  id: string;
  name: string;
  email: string;
  phone: string;
  network: string;
  followers: number;
  secondary: string;
  audience: string;
  createdAt: string;
  shotCount: number;
};

export function parseCreatorFields(input: {
  name: string;
  email: string;
  phone: string;
  network: string;
  networkName: string;
  handle: string;
  followers: string;
  secondaryNetwork: string;
  secondaryName: string;
  secondaryHandle: string;
  audience: string;
}): { ok: true; value: CreatorFields } | { ok: false; issue: FieldIssue } {
  const name = cleanName(input.name);
  if (!name) return { ok: false, issue: { field: "name", text: CREATOR_COPY.name } };

  const email = cleanEmail(input.email);
  if (!email) return { ok: false, issue: { field: "email", text: CREATOR_COPY.email } };

  const phone = cleanPhone(input.phone);
  if (!phone) return { ok: false, issue: { field: "phone", text: CREATOR_COPY.phone } };

  if (!isNetworkId(input.network)) {
    return { ok: false, issue: { field: "network", text: CREATOR_COPY.network } };
  }

  const networkName =
    input.network === "otra" ? cleanNetworkName(input.networkName) : "";
  if (input.network === "otra" && !networkName) {
    return { ok: false, issue: { field: "networkName", text: CREATOR_COPY.networkName } };
  }

  const handle = cleanHandle(input.handle);
  if (!handle) return { ok: false, issue: { field: "handle", text: CREATOR_COPY.handle } };

  const followers = parseFollowers(input.followers);
  if (followers == null) {
    return { ok: false, issue: { field: "followers", text: CREATOR_COPY.followersMissing } };
  }
  if (followers < MIN_FOLLOWERS) {
    return { ok: false, issue: { field: "followers", text: CREATOR_COPY.followers } };
  }
  if (followers > MAX_FOLLOWERS) {
    return { ok: false, issue: { field: "followers", text: CREATOR_COPY.followersHigh } };
  }

  const wantsSecondary =
    input.secondaryNetwork.trim() !== "" || input.secondaryHandle.trim() !== "";
  let secondaryNetwork: NetworkId | "" = "";
  let secondaryName = "";
  let secondaryHandle = "";
  if (wantsSecondary) {
    if (!isNetworkId(input.secondaryNetwork)) {
      return { ok: false, issue: { field: "secondaryNetwork", text: CREATOR_COPY.network } };
    }
    if (input.secondaryNetwork === input.network) {
      return {
        ok: false,
        issue: { field: "secondaryNetwork", text: "Elige una red distinta." },
      };
    }
    secondaryName =
      input.secondaryNetwork === "otra" ? cleanNetworkName(input.secondaryName) ?? "" : "";
    if (input.secondaryNetwork === "otra" && !secondaryName) {
      return {
        ok: false,
        issue: { field: "secondaryName", text: CREATOR_COPY.networkName },
      };
    }
    const second = cleanHandle(input.secondaryHandle);
    if (!second) {
      return { ok: false, issue: { field: "secondaryHandle", text: CREATOR_COPY.handle } };
    }
    secondaryNetwork = input.secondaryNetwork;
    secondaryHandle = second;
  }

  const audience = cleanAudience(input.audience);
  if (!audience) {
    return { ok: false, issue: { field: "audience", text: CREATOR_COPY.audience } };
  }

  return {
    ok: true,
    value: {
      name,
      email,
      phone,
      network: input.network,
      networkName: networkName || "",
      handle,
      followers,
      secondaryNetwork,
      secondaryName,
      secondaryHandle,
      audience,
    },
  };
}
