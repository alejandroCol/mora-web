import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { COLLECTIONS } from "@/commerce/paths";
import {
  formatFollowers,
  isNetworkId,
  networkLabel,
  parseCreatorFields,
  type CreatorFields,
  type CreatorRecordView,
  type FieldIssue,
} from "@/lib/creatorApplication";
import { adminBucket, adminDb } from "@/lib/firebaseAdmin";
import { sendCreatorInterestEmail, sendCreatorStaffEmail } from "@/server/email";

const FILE = path.join(process.cwd(), "data", "creadores.json");
const SHOT_DIR = path.join(process.cwd(), "data", "creadores");
const MAX_SHOT_BYTES = 1_600_000;
const CLOUD_TIMEOUT_MS = 6_000;

function withTimeout<T>(task: Promise<T>, ms = CLOUD_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    task.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export type ShotUpload = {
  filename: string;
  mime: string;
  buffer: Buffer;
};

type StoredShot = {
  filename: string;
  mime: string;
  storagePath?: string;
  localPath?: string;
};

type StoredApplication = CreatorFields & {
  id: string;
  createdAt: string;
  status: "new";
  shots: StoredShot[];
};

function col() {
  return adminDb().collection(COLLECTIONS.creatorApplications);
}

function isLocalHost() {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return site.includes("localhost") || site.includes("127.0.0.1");
}

function sniffImage(buffer: Buffer) {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

function extension(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  return "webp";
}

export async function buffersFromFiles(files: File[]): Promise<ShotUpload[] | FieldIssue> {
  if (files.length > 4) {
    return { field: "shots", text: "Máximo 4 pantallazos." };
  }
  const shots: ShotUpload[] = [];
  for (const file of files) {
    if (file.size <= 0 || file.size > MAX_SHOT_BYTES) {
      return {
        field: "shots",
        text: "Cada pantallazo tiene que ser una imagen liviana. Prueba otra captura.",
      };
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = sniffImage(buffer);
    if (!mime) {
      return { field: "shots", text: "Adjunta la captura en JPG, PNG o WebP." };
    }
    const index = shots.length + 1;
    shots.push({
      filename: `estadisticas-${index}.${extension(mime)}`,
      mime,
      buffer,
    });
  }
  if (shots.length < 1) {
    return { field: "shots", text: "Adjunta al menos un pantallazo de tus estadísticas." };
  }
  return shots;
}

function textField(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export function fieldsFromForm(form: FormData) {
  return parseCreatorFields({
    name: textField(form, "name"),
    email: textField(form, "email"),
    phone: textField(form, "phone"),
    network: textField(form, "network"),
    networkName: textField(form, "networkName"),
    handle: textField(form, "handle"),
    followers: textField(form, "followers"),
    secondaryNetwork: textField(form, "secondaryNetwork"),
    secondaryName: textField(form, "secondaryName"),
    secondaryHandle: textField(form, "secondaryHandle"),
    audience: textField(form, "audience"),
  });
}

async function recentDuplicate(email: string) {
  if (isLocalHost()) return false;
  const since = Date.now() - 14 * 24 * 60 * 60 * 1000;
  try {
    const snap = await withTimeout(col().where("email", "==", email).limit(8).get(), 4_000);
    return snap.docs.some((doc) => {
      const at = Date.parse(String(doc.get("createdAt") ?? ""));
      return Number.isFinite(at) && at >= since;
    });
  } catch (error) {
    console.error("[creadores] no se pudo revisar duplicados", error);
    return false;
  }
}

async function storeShot(id: string, shot: ShotUpload, index: number): Promise<StoredShot> {
  const ext = extension(shot.mime);
  const filename = `estadisticas-${index}.${ext}`;
  const storagePath = `creators/${id}/${filename}`;
  try {
    await withTimeout(
      adminBucket()
        .file(storagePath)
        .save(shot.buffer, {
          contentType: shot.mime,
          resumable: false,
          metadata: { cacheControl: "private, max-age=0" },
        }),
    );
    return { filename, mime: shot.mime, storagePath };
  } catch (error) {
    console.error("[creadores] storage", error);
    const dir = path.join(SHOT_DIR, id);
    await mkdir(dir, { recursive: true });
    const localPath = path.join(dir, filename);
    await writeFile(localPath, shot.buffer);
    return { filename, mime: shot.mime, localPath: path.relative(process.cwd(), localPath) };
  }
}

async function readFileLog(): Promise<StoredApplication[]> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as { applications?: StoredApplication[] };
    return Array.isArray(parsed.applications) ? parsed.applications : [];
  } catch {
    return [];
  }
}

async function writeFileLog(applications: StoredApplication[]) {
  await mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify({ applications }, null, 2));
  await rename(tmp, FILE);
}

async function persist(record: StoredApplication) {
  try {
    await withTimeout(col().doc(record.id).set(record));
    return;
  } catch (error) {
    console.error("[creadores] firestore", error);
  }
  const current = await readFileLog();
  current.push(record);
  await writeFileLog(current);
}

function staffSummary(record: StoredApplication) {
  const primary = `${networkLabel(record.network, record.networkName)} · @${record.handle}`;
  const secondary = record.secondaryNetwork
    ? `${networkLabel(record.secondaryNetwork, record.secondaryName)} · @${record.secondaryHandle}`
    : "";
  return { primary, secondary };
}

export async function submitCreatorApplication(fields: CreatorFields, shots: ShotUpload[]) {
  if (await recentDuplicate(fields.email)) {
    return { ok: true as const, already: true, emailSent: false };
  }

  const id = randomUUID();
  const storedShots: StoredShot[] = [];
  for (let index = 0; index < shots.length; index += 1) {
    storedShots.push(await storeShot(id, shots[index], index + 1));
  }

  const record: StoredApplication = {
    ...fields,
    id,
    createdAt: new Date().toISOString(),
    status: "new",
    shots: storedShots,
  };
  await persist(record);

  const { primary, secondary } = staffSummary(record);
  let emailSent = false;
  try {
    emailSent = await withTimeout(
      Promise.all([
        sendCreatorInterestEmail({ name: record.name, email: record.email }),
        sendCreatorStaffEmail({
          name: record.name,
          email: record.email,
          phone: record.phone,
          network: primary,
          secondary,
          followersLabel: formatFollowers(record.followers),
          audience: record.audience,
          shots: shots.map((shot) => ({ filename: shot.filename, content: shot.buffer })),
        }),
      ]).then(([creatorEmail]) => creatorEmail.ok),
      8_000,
    );
  } catch (error) {
    console.error("[creadores] correo", error);
  }

  console.info("[creadores] guardada", id);
  return { ok: true as const, already: false, emailSent };
}

function viewFrom(record: StoredApplication): CreatorRecordView {
  const network = isNetworkId(record.network)
    ? `${networkLabel(record.network, record.networkName)} · @${record.handle}`
    : `@${record.handle}`;
  const secondary =
    record.secondaryNetwork && isNetworkId(record.secondaryNetwork)
      ? `${networkLabel(record.secondaryNetwork, record.secondaryName)} · @${record.secondaryHandle}`
      : "";
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    phone: record.phone,
    network,
    followers: Number(record.followers) || 0,
    secondary,
    audience: record.audience,
    createdAt: record.createdAt,
    shotCount: Array.isArray(record.shots) ? record.shots.length : 0,
  };
}

function recordFromData(id: string, data: Record<string, unknown> | undefined): StoredApplication | null {
  if (!data || typeof data.name !== "string" || typeof data.email !== "string") return null;
  const shots = Array.isArray(data.shots) ? (data.shots as StoredShot[]) : [];
  return {
    id,
    name: data.name,
    email: data.email,
    phone: typeof data.phone === "string" ? data.phone : "",
    network: isNetworkId(String(data.network ?? "")) ? (data.network as StoredApplication["network"]) : "instagram",
    networkName: typeof data.networkName === "string" ? data.networkName : "",
    handle: typeof data.handle === "string" ? data.handle : "",
    followers: Number(data.followers) || 0,
    secondaryNetwork: isNetworkId(String(data.secondaryNetwork ?? ""))
      ? (data.secondaryNetwork as StoredApplication["secondaryNetwork"])
      : "",
    secondaryName: typeof data.secondaryName === "string" ? data.secondaryName : "",
    secondaryHandle: typeof data.secondaryHandle === "string" ? data.secondaryHandle : "",
    audience: typeof data.audience === "string" ? data.audience : "",
    createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
    status: "new",
    shots,
  };
}

export async function listCreatorApplications(limit = 120): Promise<CreatorRecordView[]> {
  const merged = new Map<string, StoredApplication>();
  for (const item of await readFileLog()) merged.set(item.id, item);
  try {
    const snap = await withTimeout(col().limit(limit).get(), 4_000);
    for (const doc of snap.docs) {
      const record = recordFromData(doc.id, doc.data() as Record<string, unknown>);
      if (record) merged.set(record.id, record);
    }
  } catch (error) {
    console.error("[creadores] listado", error);
  }
  return [...merged.values()]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit)
    .map(viewFrom);
}

export async function readCreatorShot(id: string, index: number) {
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(id) || !Number.isInteger(index) || index < 1 || index > 4) {
    return null;
  }
  let record: StoredApplication | null = null;
  try {
    const snap = await withTimeout(col().doc(id).get(), 4_000);
    if (snap.exists) record = recordFromData(snap.id, snap.data() as Record<string, unknown>);
  } catch (error) {
    console.error("[creadores] foto", error);
  }
  if (!record) {
    record = (await readFileLog()).find((item) => item.id === id) ?? null;
  }
  const shot = record?.shots[index - 1];
  if (!shot) return null;
  if (shot.storagePath) {
    const [buffer] = await withTimeout(adminBucket().file(shot.storagePath).download(), 6_000);
    return { buffer, mime: shot.mime || "image/webp" };
  }
  if (!shot.localPath) return null;
  const root = path.resolve(SHOT_DIR);
  const resolved = path.resolve(process.cwd(), shot.localPath);
  if (!resolved.startsWith(`${root}${path.sep}`)) return null;
  const buffer = await readFile(resolved);
  return { buffer, mime: shot.mime || "image/webp" };
}
