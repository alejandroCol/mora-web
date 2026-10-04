/**
 * Importa votos archivados a Firestore (encuestaVotes).
 *
 * Uso (desde web/):
 *   node scripts/import-encuesta-votes.mjs ruta/al/respaldo.json
 *
 * Formato del JSON:
 *   { "votes": [ { "id": "...", "gender": "mujer"|"hombre", "picks": ["blanco","lila","oro"], "at": "ISO" } ] }
 *
 * Requiere FIREBASE_SERVICE_ACCOUNT_JSON en el entorno o en .env.local
 */
import { readFileSync, existsSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const RING_IDS = new Set(["blanco", "lila", "plata", "oro", "brillo", "mate"]);
const GENDERS = new Set(["mujer", "hombre"]);

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }
  const envPath = ".env.local";
  if (!existsSync(envPath)) {
    throw new Error("Falta FIREBASE_SERVICE_ACCOUNT_JSON o .env.local");
  }
  const line = readFileSync(envPath, "utf8")
    .split("\n")
    .find((row) => row.startsWith("FIREBASE_SERVICE_ACCOUNT_JSON="));
  if (!line) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON no está en .env.local");
  const raw = line.slice("FIREBASE_SERVICE_ACCOUNT_JSON=".length).trim();
  const json = raw.startsWith("'") || raw.startsWith('"') ? JSON.parse(raw) : JSON.parse(raw);
  return json;
}

function isVote(v) {
  return (
    v &&
    typeof v.id === "string" &&
    GENDERS.has(v.gender) &&
    Array.isArray(v.picks) &&
    v.picks.length === 3 &&
    v.picks.every((id) => RING_IDS.has(id)) &&
    new Set(v.picks).size === 3
  );
}

function app() {
  const existing = getApps()[0];
  if (existing) return existing;
  const account = loadServiceAccount();
  return initializeApp({
    credential: cert(account),
    projectId: account.project_id ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const file = process.argv[2];
if (!file) {
  console.error("Uso: node scripts/import-encuesta-votes.mjs <archivo.json>");
  process.exit(1);
}

const payload = JSON.parse(readFileSync(file, "utf8"));
const votes = Array.isArray(payload) ? payload : payload.votes;
if (!Array.isArray(votes)) {
  console.error("El JSON debe ser { votes: [...] } o un array.");
  process.exit(1);
}

const valid = votes.filter(isVote);
const invalid = votes.length - valid.length;
if (invalid) console.warn(`Se omitieron ${invalid} filas inválidas.`);

const db = getFirestore(app());
let written = 0;
let skipped = 0;

for (const vote of valid) {
  const ref = db.collection("encuestaVotes").doc(vote.id);
  const snap = await ref.get();
  if (snap.exists) {
    skipped += 1;
    continue;
  }
  await ref.set({
    gender: vote.gender,
    picks: vote.picks,
    at: typeof vote.at === "string" ? vote.at : new Date().toISOString(),
  });
  written += 1;
}

console.log(`Listo: ${written} importados, ${skipped} ya existían (no se sobrescribieron).`);
