import type { DocumentData } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/commerce/paths";
import {
  isStaffRole,
  roleHasPermission,
  type StaffPermission,
  type StaffRecord,
  type StaffRole,
} from "@/commerce/roles";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export type StaffProfile = StaffRecord;

function staffDoc(uid: string) {
  return adminDb().collection(COLLECTIONS.staff).doc(uid);
}

function asStaff(uid: string, data: DocumentData | undefined): StaffRecord {
  const role = isStaffRole(data?.role) ? data.role : "vendedor";
  return {
    uid,
    email: String(data?.email ?? "").toLowerCase(),
    name: String(data?.name ?? "").trim(),
    role,
    active: data?.active !== false,
    createdAt: Number(data?.createdAt ?? Date.now()),
    createdBy: typeof data?.createdBy === "string" ? data.createdBy : undefined,
    updatedAt: typeof data?.updatedAt === "number" ? data.updatedAt : undefined,
  };
}

function bootstrapAdminEmail() {
  return (
    process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() ||
    "superadmin@mora.com"
  );
}

function staffFromToken(uid: string, email: string): StaffRecord {
  return {
    uid,
    email,
    name: "Super admin",
    role: "superadmin",
    active: true,
    createdAt: Date.now(),
  };
}

export async function requireStaff(request: Request): Promise<StaffProfile> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    throw Object.assign(new Error("Inicia sesión."), { status: 401 });
  }

  try {
    const decoded = await adminAuth().verifyIdToken(token);
    const snap = await staffDoc(decoded.uid).get();
    const email = (decoded.email ?? "").toLowerCase();
    if (!snap.exists) {
      if (email && email === bootstrapAdminEmail()) {
        return staffFromToken(decoded.uid, email);
      }
      throw Object.assign(new Error("No tienes acceso al atelier."), { status: 403 });
    }
    const staff = asStaff(decoded.uid, snap.data());
    if (!staff.active) {
      throw Object.assign(new Error("Esta cuenta está desactivada."), { status: 403 });
    }
    if (!staff.email) staff.email = email;
    return staff;
  } catch (error) {
    if (error && typeof error === "object" && "status" in error) throw error;
    const { lookupIdToken, firestoreGet } = await import("./identityRest");
    const user = await lookupIdToken(token);
    const email = (user.email ?? "").toLowerCase();
    try {
      const data = await firestoreGet(`staff/${user.localId}`, token);
      if (data) {
        const staff = asStaff(user.localId, data);
        if (!staff.active) {
          throw Object.assign(new Error("Esta cuenta está desactivada."), { status: 403 });
        }
        return staff;
      }
    } catch (inner) {
      if (inner && typeof inner === "object" && "status" in inner && (inner as { status: number }).status === 403) {
        /* rules still closed; allow the bootstrap admin email */
      } else if (inner && typeof inner === "object" && "status" in inner) {
        throw inner;
      }
    }
    if (email && email === bootstrapAdminEmail()) {
      return staffFromToken(user.localId, email);
    }
    throw Object.assign(new Error("No tienes acceso al atelier."), { status: 403 });
  }
}

export async function requirePermission(
  request: Request,
  permission: StaffPermission,
): Promise<StaffProfile> {
  const staff = await requireStaff(request);
  if (!roleHasPermission(staff.role, permission)) {
    throw Object.assign(new Error("Este rol no puede hacer eso."), { status: 403 });
  }
  return staff;
}

export async function staffCount() {
  const snap = await adminDb().collection(COLLECTIONS.staff).limit(1).get();
  return snap.size;
}

export async function listStaff(): Promise<StaffRecord[]> {
  const snap = await adminDb().collection(COLLECTIONS.staff).get();
  return snap.docs
    .map((doc) => asStaff(doc.id, doc.data()))
    .sort((a, b) => a.createdAt - b.createdAt);
}

async function superadminCount(exceptUid?: string) {
  const team = await listStaff();
  return team.filter(
    (member) =>
      member.role === "superadmin" &&
      member.active &&
      member.uid !== exceptUid,
  ).length;
}

async function writeStaffAuth(input: {
  uid: string;
  email: string;
  role: StaffRole;
  active: boolean;
}) {
  await adminAuth().setCustomUserClaims(input.uid, {
    role: input.role,
    active: input.active,
  });
}

export async function bootstrapStaff(input: {
  email: string;
  password: string;
  secret: string;
  name?: string;
}) {
  const expected = process.env.ADMIN_SETUP_SECRET?.trim();
  if (!expected || input.secret !== expected) {
    throw Object.assign(new Error("Secreto inválido."), { status: 403 });
  }

  try {
    const count = await staffCount();
    if (count > 0) {
      throw Object.assign(
        new Error("El atelier ya tiene un acceso. Entra y crea al resto del equipo."),
        { status: 409 },
      );
    }
  } catch (error) {
    if (error && typeof error === "object" && "status" in error) throw error;
  }

  const email = input.email.trim().toLowerCase();
  const { signUpAuthUser, firestoreSet } = await import("./identityRest");
  const user = await signUpAuthUser({
    email,
    password: input.password,
    displayName: input.name?.trim() || "Atelier",
  });
  const now = Date.now();
  const record: StaffRecord = {
    uid: user.uid,
    email,
    name: input.name?.trim() || "Atelier",
    role: "superadmin",
    active: true,
    createdAt: now,
  };
  try {
    await writeStaffAuth({ uid: user.uid, email, role: "superadmin", active: true });
    await staffDoc(user.uid).set(record);
  } catch {
    try {
      await firestoreSet(`staff/${user.uid}`, user.idToken, record);
    } catch {
      /* requireStaff also accepts the bootstrap admin email */
    }
  }
  return record;
}

export async function createStaffMember(input: {
  email: string;
  password: string;
  name: string;
  role: StaffRole;
  createdBy: string;
}): Promise<StaffRecord> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) {
    throw Object.assign(new Error("Correo inválido."), { status: 400 });
  }
  if (input.password.trim().length < 8) {
    throw Object.assign(new Error("La contraseña debe tener al menos 8 caracteres."), {
      status: 400,
    });
  }
  if (!isStaffRole(input.role)) {
    throw Object.assign(new Error("Rol inválido."), { status: 400 });
  }

  const auth = adminAuth();
  let uid: string;
  try {
    const created = await auth.createUser({
      email,
      password: input.password,
      displayName: input.name.trim() || email,
      emailVerified: true,
    });
    uid = created.uid;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "auth/email-already-exists") throw error;
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    const already = await staffDoc(uid).get();
    if (already.exists && (already.data() as { active?: boolean }).active !== false) {
      throw Object.assign(new Error("Ese correo ya está en el equipo."), { status: 409 });
    }
    await auth.updateUser(uid, {
      password: input.password,
      displayName: input.name.trim() || email,
      disabled: false,
    });
  }

  const now = Date.now();
  const record: StaffRecord = {
    uid,
    email,
    name: input.name.trim() || email.split("@")[0] || "Equipo",
    role: input.role,
    active: true,
    createdAt: now,
    createdBy: input.createdBy,
    updatedAt: now,
  };
  await writeStaffAuth({ uid, email, role: input.role, active: true });
  await staffDoc(uid).set(record, { merge: true });
  return record;
}

export async function updateStaffMember(input: {
  uid: string;
  actorUid: string;
  role?: StaffRole;
  active?: boolean;
  name?: string;
  password?: string;
}): Promise<StaffRecord> {
  const ref = staffDoc(input.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    throw Object.assign(new Error("Usuario no encontrado."), { status: 404 });
  }
  const current = asStaff(input.uid, snap.data());

  if (input.uid === input.actorUid && input.active === false) {
    throw Object.assign(new Error("No puedes desactivar tu propia cuenta."), { status: 400 });
  }

  const nextRole = input.role ?? current.role;
  const nextActive = input.active ?? current.active;

  if (current.role === "superadmin" && (nextRole !== "superadmin" || nextActive === false)) {
    const remaining = await superadminCount(input.uid);
    if (remaining < 1) {
      throw Object.assign(new Error("Debe quedar al menos un super admin activo."), {
        status: 400,
      });
    }
  }

  if (input.password?.trim()) {
    if (input.password.trim().length < 8) {
      throw Object.assign(new Error("La contraseña debe tener al menos 8 caracteres."), {
        status: 400,
      });
    }
    await adminAuth().updateUser(input.uid, { password: input.password.trim() });
  }

  const next: StaffRecord = {
    ...current,
    role: nextRole,
    active: nextActive,
    name: input.name?.trim() || current.name,
    updatedAt: Date.now(),
  };

  await adminAuth().updateUser(input.uid, {
    displayName: next.name,
    disabled: !next.active,
  });
  await writeStaffAuth({
    uid: next.uid,
    email: next.email,
    role: next.role,
    active: next.active,
  });
  await ref.set(next, { merge: true });
  return next;
}

export function jsonError(error: unknown) {
  const message = error instanceof Error ? error.message : "Error inesperado.";
  const status =
    typeof error === "object" && error && "status" in error
      ? Number((error as { status?: number }).status) || 400
      : 400;
  return Response.json({ ok: false, error: message }, { status });
}
