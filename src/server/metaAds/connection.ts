import type { AdAccountOption, AdsConnection } from "@/ads/types";
import { DOCS } from "@/commerce/paths";
import { adminDb } from "@/lib/firebaseAdmin";
import { loadGrowthSettings } from "../growthSettings";
import { MetaAdsError, listAdAccounts } from "./graph";

export function adsConnection(settings: Awaited<ReturnType<typeof loadGrowthSettings>>): AdsConnection {
  return {
    connected: Boolean(settings.metaAdsToken && settings.metaAdAccountId),
    accountId: settings.metaAdAccountId,
    accountName: settings.metaAdAccountName,
    currency: settings.metaAdsCurrency || "COP",
    connectedAt: settings.metaAdsConnectedAt,
  };
}

export async function loadAdsConnection() {
  return adsConnection(await loadGrowthSettings());
}

function friendly(error: unknown): never {
  if (error instanceof MetaAdsError) {
    // 200 / 10: el token no tiene `ads_read` o el usuario no tiene la cuenta asignada. 190: token inválido.
    const message =
      error.code === 190
        ? "Meta no reconoce ese token. Genéralo de nuevo y pégalo completo."
        : error.code === 200 || error.code === 10 || error.code === 100
          ? "Al token le falta el permiso ads_read o la cuenta publicitaria no está asignada a ese usuario."
          : `Meta: ${error.message}`;
    throw Object.assign(new Error(message), { status: 400 });
  }
  throw error;
}

/**
 * Con el token pegado (o el de WhatsApp si viene vacío) busca las cuentas
 * publicitarias. Si hay una sola, o llega `accountId`, la deja conectada.
 * Si hay varias, devuelve la lista para que se elija.
 */
export async function connectMetaAds(input: { token?: string; accountId?: string }) {
  const settings = await loadGrowthSettings();
  const pasted = input.token?.trim() ?? "";
  const token = pasted || settings.metaAdsToken || settings.whatsappAccessToken;
  if (!token) {
    throw Object.assign(new Error("Pega el token con permiso ads_read."), { status: 400 });
  }
  if (pasted && pasted.length < 40) {
    throw Object.assign(new Error("Pega el token completo."), { status: 400 });
  }

  let accounts: AdAccountOption[];
  try {
    accounts = await listAdAccounts(token);
  } catch (error) {
    friendly(error);
  }
  if (accounts.length === 0) {
    throw Object.assign(
      new Error("El token funciona, pero no ve ninguna cuenta publicitaria. Asígnala al usuario del sistema."),
      { status: 400 },
    );
  }

  const chosen = input.accountId
    ? accounts.find((account) => account.id === input.accountId)
    : accounts.length === 1
      ? accounts[0]
      : undefined;
  if (!chosen) return { connected: false as const, accounts };

  await adminDb()
    .doc(DOCS.growth)
    .set(
      {
        metaAdsToken: token,
        metaAdAccountId: chosen.id,
        metaAdAccountName: chosen.name,
        metaAdsCurrency: chosen.currency,
        metaAdsConnectedAt: Date.now(),
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  return { connected: true as const, accounts };
}

export async function disconnectMetaAds() {
  await adminDb().doc(DOCS.growth).set(
    {
      metaAdsToken: "",
      metaAdAccountId: "",
      metaAdAccountName: "",
      metaAdsCurrency: "",
      metaAdsConnectedAt: 0,
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}
