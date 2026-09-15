type LookupUser = {
  localId: string;
  email?: string;
  disabled?: boolean;
};

function projectId() {
  return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
}

function apiKey() {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  if (!key) throw new Error("Falta NEXT_PUBLIC_FIREBASE_API_KEY");
  return key;
}

export async function lookupIdToken(idToken: string): Promise<LookupUser> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );
  const body = (await res.json()) as { users?: LookupUser[]; error?: { message?: string } };
  const user = body.users?.[0];
  if (!res.ok || !user?.localId) {
    throw Object.assign(new Error(body.error?.message ?? "Sesión inválida."), { status: 401 });
  }
  if (user.disabled) {
    throw Object.assign(new Error("Esta cuenta está desactivada."), { status: 403 });
  }
  return user;
}

export async function signUpAuthUser(input: {
  email: string;
  password: string;
  displayName?: string;
}) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        displayName: input.displayName,
        returnSecureToken: true,
      }),
    },
  );
  const body = (await res.json()) as {
    localId?: string;
    idToken?: string;
    email?: string;
    error?: { message?: string };
  };
  if (!res.ok || !body.localId || !body.idToken) {
    if (body.error?.message === "EMAIL_EXISTS") {
      return signInAuthUser(input);
    }
    throw Object.assign(new Error(body.error?.message ?? "No pudimos crear el usuario."), {
      status: 400,
    });
  }
  return { uid: body.localId, idToken: body.idToken, email: body.email ?? input.email };
}

export async function signInAuthUser(input: { email: string; password: string }) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        returnSecureToken: true,
      }),
    },
  );
  const body = (await res.json()) as {
    localId?: string;
    idToken?: string;
    email?: string;
    error?: { message?: string };
  };
  if (!res.ok || !body.localId || !body.idToken) {
    throw Object.assign(new Error(body.error?.message ?? "No pudimos entrar."), { status: 400 });
  }
  return { uid: body.localId, idToken: body.idToken, email: body.email ?? input.email };
}

function firestoreDocUrl(path: string) {
  return `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents/${path}`;
}

export function staffToFirestoreFields(data: Record<string, unknown>) {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (typeof value === "string") fields[key] = { stringValue: value };
    else if (typeof value === "number") fields[key] = { integerValue: String(Math.round(value)) };
    else if (typeof value === "boolean") fields[key] = { booleanValue: value };
  }
  return fields;
}

export function firestoreFieldsToObject(fields?: Record<string, { stringValue?: string; integerValue?: string; booleanValue?: boolean }>) {
  const out: Record<string, unknown> = {};
  if (!fields) return out;
  for (const [key, value] of Object.entries(fields)) {
    if (value.stringValue !== undefined) out[key] = value.stringValue;
    else if (value.integerValue !== undefined) out[key] = Number(value.integerValue);
    else if (value.booleanValue !== undefined) out[key] = value.booleanValue;
  }
  return out;
}

export async function firestoreGet(path: string, idToken: string) {
  const res = await fetch(firestoreDocUrl(path), {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 404) return null;
  const body = (await res.json()) as {
    fields?: Record<string, { stringValue?: string; integerValue?: string; booleanValue?: boolean }>;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw Object.assign(new Error(body.error?.message ?? "No pudimos leer Firestore."), {
      status: res.status,
    });
  }
  return firestoreFieldsToObject(body.fields);
}

export async function firestoreSet(path: string, idToken: string, data: Record<string, unknown>) {
  const res = await fetch(`${firestoreDocUrl(path)}?currentDocument.exists=false`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: staffToFirestoreFields(data) }),
  });
  if (res.status === 409) {
    return firestoreMerge(path, idToken, data);
  }
  const body = (await res.json()) as { error?: { message?: string } };
  if (!res.ok) {
    throw Object.assign(new Error(body.error?.message ?? "No pudimos guardar en Firestore."), {
      status: res.status,
    });
  }
}

export async function firestoreMerge(path: string, idToken: string, data: Record<string, unknown>) {
  const masks = Object.keys(data)
    .filter((key) => data[key] !== undefined)
    .map((key) => `updateMask.fieldPaths=${encodeURIComponent(key)}`)
    .join("&");
  const res = await fetch(`${firestoreDocUrl(path)}?${masks}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: staffToFirestoreFields(data) }),
  });
  const body = (await res.json()) as { error?: { message?: string } };
  if (!res.ok) {
    throw Object.assign(new Error(body.error?.message ?? "No pudimos guardar en Firestore."), {
      status: res.status,
    });
  }
}
