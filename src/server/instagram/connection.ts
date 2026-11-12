import { DOCS } from "@/commerce/paths";
import type { InstagramConnectionStatus } from "@/instagram/types";
import { adminDb } from "@/lib/firebaseAdmin";
import { siteOrigin } from "@/lib/site";
import { instagramReady, loadGrowthSettings } from "../growthSettings";
import { HOURLY_CAP, countSentThisHour } from "./automations";
import { loadInstagramWebhookDebug, recordInstagramWebhook } from "./debug";
import {
  InstagramApiError,
  discoverInstagramAccount,
  fetchTokenAppId,
  registerInstagramAppWebhook,
  subscribePageToApp,
} from "./graph";

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
  // De paso deja el webhook registrado en la app de Meta: así no hay que buscarlo en su panel.
  const webhookError = await registerInstagramWebhook(link.pageToken).then(
    () => "",
    (error: unknown) => (error instanceof Error ? error.message : "Meta no registró el webhook."),
  );
  // Conectó, pero sin estas dos cosas Meta no manda avisos: se le dice a quien conecta.
  const pageWarning = !subscription.ok
    ? `Meta no dejó suscribir la Página (${subscription.error}). Revisa el permiso pages_manage_metadata del token.`
    : !subscription.fields.includes("messages")
      ? "Los comentarios llegan, pero los mensajes directos no: al token le falta el permiso pages_messaging."
      : "";
  const warnings = [pageWarning, webhookError].filter(Boolean);
  return {
    username: link.username,
    warning: warnings.length > 0 ? `Conectado, pero falta algo. ${warnings.join(" ")}` : "",
  };
}

/**
 * Registra el webhook de Instagram en la app de Meta con las llaves de Campañas.
 * Es el mismo paso del panel de Meta («Webhooks › Instagram»), hecho por API.
 */
export async function registerInstagramWebhook(token?: string) {
  const settings = await loadGrowthSettings();
  const accessToken = token || settings.instagramAccessToken;
  if (!accessToken) {
    throw Object.assign(new Error("Conecta Instagram antes de registrar el webhook."), { status: 400 });
  }
  if (!settings.whatsappAppSecret || !settings.whatsappVerifyToken) {
    throw Object.assign(
      new Error("Para registrar el webhook faltan el App secret o el verify token en Campañas."),
      { status: 400 },
    );
  }
  const callbackUrl = instagramWebhookUrl();
  if (!callbackUrl.startsWith("https://") || /\/\/(localhost|127\.|\[::1\])/.test(callbackUrl)) {
    throw Object.assign(
      new Error("El webhook solo se registra desde el sitio publicado: Meta no puede llamar a este equipo."),
      { status: 400 },
    );
  }

  try {
    const appId = await fetchTokenAppId(accessToken);
    const fields = await registerInstagramAppWebhook({
      appId,
      appSecret: settings.whatsappAppSecret,
      callbackUrl,
      verifyToken: settings.whatsappVerifyToken,
    });
    await recordInstagramWebhook({ registeredAt: Date.now(), registeredFields: fields });
    return fields;
  } catch (error) {
    if (!(error instanceof InstagramApiError)) throw error;
    // 190 y 101: Meta no reconoce el par app + secreto. 2200: llamó a la URL y no le respondimos bien.
    const hint =
      error.code === 190 || error.code === 101
        ? " El App secret de Campañas no es el de la app de Meta de este token."
        : error.code === 2200
          ? " Meta llamó a la URL y no pudo verificarla."
          : "";
    const detail = error.message.replace(/\.+$/, "");
    throw Object.assign(new Error(`Meta no registró el webhook: ${detail}.${hint}`), { status: 400 });
  }
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
