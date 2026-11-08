/**
 * Crea las plantillas de WhatsApp de Mora en Meta y las registra en el CRM
 * (`settings/crm.templates`) para que aparezcan en el botón «Plantilla» cuando
 * la ventana de 24 h está cerrada.
 *
 * Uso (desde web/):
 *   WABA_ID=1234567890 node scripts/whatsapp-templates.mjs
 *
 * El WABA_ID es el «Identificador de la cuenta de WhatsApp Business» que
 * muestra Meta Business Suite → WhatsApp Manager (o developers.facebook.com →
 * app → WhatsApp → Configuración de la API). El token y el número salen de
 * `settings/growth`, igual que en producción.
 *
 * Es idempotente: si la plantilla ya existe en Meta, no la vuelve a crear;
 * en el CRM reemplaza la entrada del mismo nombre.
 *
 * Requiere FIREBASE_SERVICE_ACCOUNT_JSON en el entorno o en .env.local
 */
import { existsSync, readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const GRAPH = "https://graph.facebook.com/v21.0";

/**
 * Sin variables: el CRM las manda tal cual. Meta puede reclasificar la
 * categoría (allow_category_change); la que quede se guarda en el CRM porque
 * define el costo que muestra el panel.
 */
const TEMPLATES = [
  {
    name: "seguimiento_consulta",
    label: "Retomar",
    desk: "sales",
    category: "MARKETING",
    body:
      "Hola, soy del equipo de Mora. Vi tu mensaje y quedé pendiente de responderte. ¿Sigues con ganas de que te cuente del anillo?",
  },
  {
    name: "talla_pendiente",
    label: "Talla pendiente",
    desk: "sales",
    category: "MARKETING",
    body:
      "Hola, soy de Mora. Quedamos pendientes de tu talla para apartar el anillo. ¿Ya pudiste medirte? Si quieres te mando el medidor.",
  },
  {
    name: "novedad_pedido",
    label: "Pedido",
    desk: "support",
    category: "UTILITY",
    body:
      "Hola, te escribo de Mora por tu pedido. Tengo una novedad y necesito confirmar un dato contigo. ¿Me respondes por aquí cuando puedas?",
  },
];

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }
  const envPath = ".env.local";
  if (!existsSync(envPath)) throw new Error("Falta FIREBASE_SERVICE_ACCOUNT_JSON o .env.local");
  const line = readFileSync(envPath, "utf8")
    .split("\n")
    .find((row) => row.startsWith("FIREBASE_SERVICE_ACCOUNT_JSON="));
  if (!line) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON no está en .env.local");
  let value = line.slice("FIREBASE_SERVICE_ACCOUNT_JSON=".length).trim();
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    value = value.slice(1, -1);
  }
  return JSON.parse(value);
}

async function graph(token, path, init) {
  const res = await fetch(`${GRAPH}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json();
  if (data.error) {
    const err = data.error;
    throw new Error(`${err.message}${err.error_user_msg ? ` · ${err.error_user_msg}` : ""} (code ${err.code})`);
  }
  return data;
}

async function main() {
  const wabaId = (process.env.WABA_ID ?? process.argv[2] ?? "").trim();
  if (!/^\d{10,20}$/.test(wabaId)) throw new Error("Pasa el WABA_ID (solo dígitos).");

  if (!getApps().length) initializeApp({ credential: cert(loadServiceAccount()) });
  const db = getFirestore();
  const growth = (await db.doc("settings/growth").get()).data() ?? {};
  const token = growth.whatsappAccessToken;
  if (!token) throw new Error("settings/growth no tiene whatsappAccessToken.");

  const existing = await graph(token, `${wabaId}/message_templates?fields=name,status,category,language&limit=200`);
  const byName = new Map((existing.data ?? []).map((item) => [`${item.name}/${item.language}`, item]));

  const registered = [];
  for (const template of TEMPLATES) {
    const key = `${template.name}/es`;
    let remote = byName.get(key);
    if (remote) {
      console.log(`· ${template.name} ya existe (${remote.status}, ${remote.category})`);
    } else {
      const created = await graph(token, `${wabaId}/message_templates`, {
        method: "POST",
        body: JSON.stringify({
          name: template.name,
          language: "es",
          category: template.category,
          allow_category_change: true,
          components: [{ type: "BODY", text: template.body }],
        }),
      });
      remote = { status: created.status, category: created.category ?? template.category };
      console.log(`✔ ${template.name} creada (${remote.status}, ${remote.category})`);
    }
    const category = String(remote.category ?? template.category).toLowerCase();
    registered.push({
      id: template.name,
      name: template.name,
      language: "es",
      label: template.label,
      desk: template.desk,
      billingCategory: category === "utility" || category === "authentication" ? category : "marketing",
    });
  }

  const crmRef = db.doc("settings/crm");
  const current = (await crmRef.get()).data() ?? {};
  const kept = (Array.isArray(current.templates) ? current.templates : []).filter(
    (item) => !registered.some((next) => next.name === item.name && next.language === item.language),
  );
  await crmRef.set({ templates: [...kept, ...registered], updatedAt: Date.now() }, { merge: true });
  console.log(`CRM: ${registered.length} plantillas registradas en settings/crm.`);
  console.log("Meta las revisa; hasta que estén APPROVED el envío falla con un error claro del panel.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
