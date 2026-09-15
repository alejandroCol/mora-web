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

function serviceAccountFromEnv(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw?.trim()) return null;
  return JSON.parse(raw) as ServiceAccount;
}

function getAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const account = serviceAccountFromEnv();
  if (account) {
    return initializeApp({
      credential: cert(account),
      projectId:
        account.projectId ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

export function adminDb() {
  return getFirestore(getAdminApp());
}

export function adminAuth() {
  return getAuth(getAdminApp());
}
