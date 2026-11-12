import { DOCS } from "@/commerce/paths";
import type { InstagramConnectionStatus } from "@/instagram/types";
import { adminDb } from "@/lib/firebaseAdmin";
import { siteOrigin } from "@/lib/site";
import { instagramReady, loadGrowthSettings } from "../growthSettings";
import { HOURLY_CAP, countSentThisHour } from "./automations";
import { loadInstagramWebhookDebug } from "./debug";
import { discoverInstagramAccount, subscribePageToApp } from "./graph";

/**
 * Conexión de la cuenta de Instagram. Vive en `settings/growth` junto a las
 * demás llaves de Meta: ese documento solo lo leen founder y super admin.
 */
function growthDoc() {
  return adminDb().doc(DOCS.growth);
}

export function instagramWebhookUrl() {
  return `${siteOrigin()}/api/instagram/webhook`;
}

/**
 * Con un solo token (el del usuario del sistema) encuentra la Página y la cuenta,
 * guarda el token de Página y suscribe la app para que Meta empiece a avisar.
 */
export async function connectInstagram(token: string) {
  const clean = token.trim();
  if (clean.length < 40) {
    throw Object.assign(new Error("Pega el token completo."), { status: 400 });
  }
  const link = await discoverInstagramAccount(clean);
  const subscription = await subscribePageToApp(link);
  await growthDoc().set(
    {
      instagramAccessToken: link.pageToken,
      instagramPageId: link.pageId,
      instagramPageName: link.pageName,
      instagramAccountId: link.accountId,
      instagramUsername: link.username,
      instagramConnectedAt: Date.now(),
      updatedAt: Date.now(),
    },
    { merge: true },
  );
  return {
    username: link.username,
    // Conectó, pero sin suscripción Meta no manda avisos: se le dice a quien conecta.
    warning: subscription.ok
      ? ""
      : `Conectado, pero Meta no dejó suscribir la Página (${subscription.error}). Sin eso no llegan comentarios ni mensajes: revisa el permiso pages_manage_metadata del token.`,
  };
}

export async function disconnectInstagram() {
  await growthDoc().set(
    {
      instagramAccessToken: "",
      instagramPageId: "",
      instagramPageName: "",
      instagramAccountId: "",
      instagramUsername: "",
      instagramConnectedAt: 0,
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

export async function setInstagramHumanAgent(enabled: boolean) {
  await growthDoc().set({ instagramHumanAgent: enabled, updatedAt: Date.now() }, { merge: true });
}

export async function loadInstagramStatus(): Promise<InstagramConnectionStatus> {
  const [settings, debug] = await Promise.all([loadGrowthSettings(), loadInstagramWebhookDebug()]);
  const ready = instagramReady(settings);
  return {
    ready,
    username: settings.instagramUsername,
    pageName: settings.instagramPageName,
    connectedAt: settings.instagramConnectedAt,
    humanAgent: settings.instagramHumanAgent,
    hasAppSecret: Boolean(settings.whatsappAppSecret),
    hasVerifyToken: Boolean(settings.whatsappVerifyToken),
    webhook: instagramWebhookUrl(),
    debug,
    sentThisHour: ready ? await countSentThisHour().catch(() => 0) : 0,
    hourlyCap: HOURLY_CAP,
  };
}
