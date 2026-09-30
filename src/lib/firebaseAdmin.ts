import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function serviceAccountFromEnv(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw?.trim()) return null;
  return JSON.parse(raw) as ServiceAccount;
}

function storageBucket() {
  return process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || undefined;
}

function getAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const account = serviceAccountFromEnv();
  const bucket = storageBucket();
  if (account) {
    return initializeApp({
      credential: cert(account),
      projectId:
        account.projectId ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: bucket,
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: bucket,
  });
}

let ignoreUndefinedApplied = false;

export function adminDb() {
  const db = getFirestore(getAdminApp());
  if (!ignoreUndefinedApplied) {
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      /* settings only once per app */
    }
    ignoreUndefinedApplied = true;
  }
  return db;
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

export function adminBucket() {
  const name = storageBucket();
  return name ? getStorage(getAdminApp()).bucket(name) : getStorage(getAdminApp()).bucket();
}
