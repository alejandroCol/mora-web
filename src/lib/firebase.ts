import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getFunctions, httpsCallable, type Functions } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export function getFirebaseDb(): Firestore {
  return getFirestore(getFirebaseApp());
}

export function getFirebaseFunctions(): Functions {
  return getFunctions(getFirebaseApp(), "us-central1");
}

let appCheckStarted = false;

/**
 * App Check para las callables de Mora (`/circulo`). Solo en el navegador y solo si hay clave de
 * reCAPTCHA Enterprise; sin clave no hace nada y las llamadas salen como siempre. Se enciende al
 * primer llamado, así la tienda no carga reCAPTCHA.
 */
function startAppCheck() {
  if (appCheckStarted || typeof window === "undefined") return;
  const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_KEY;
  if (!siteKey) return;
  appCheckStarted = true;
  try {
    initializeAppCheck(getFirebaseApp(), {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (error) {
    console.warn("[app check]", error);
  }
}

export async function callMoraApp<T>(name: string, data: Record<string, unknown> = {}) {
  startAppCheck();
  const fn = httpsCallable<Record<string, unknown>, T>(getFirebaseFunctions(), name);
  const res = await fn(data);
  return res.data;
}
