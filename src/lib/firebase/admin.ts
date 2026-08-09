import "server-only";

import {
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function serviceAccount(): ServiceAccount | null {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (encoded) {
    try {
      const parsed = JSON.parse(encoded) as ServiceAccount;
      if (parsed.projectId && parsed.clientEmail && parsed.privateKey) return parsed;
    } catch {
      console.error("[firebase-admin] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  return projectId && clientEmail && privateKey ? { projectId, clientEmail, privateKey } : null;
}

export function firebaseAdminConfigured(): boolean {
  return Boolean(serviceAccount() || process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

export function getAdminApp(): App | null {
  if (getApps().length) return getApp();
  const account = serviceAccount();
  if (!account && !process.env.GOOGLE_APPLICATION_CREDENTIALS) return null;
  return initializeApp({
    credential: account ? cert(account) : applicationDefault(),
    projectId: account?.projectId ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

export function getAdminServices() {
  const app = getAdminApp();
  if (!app) return null;
  return {
    auth: getAuth(app),
    db: getFirestore(app),
    messaging: getMessaging(app),
  };
}

export async function verifyUserRequest(request: Request): Promise<DecodedIdToken | null> {
  const services = getAdminServices();
  const authorization = request.headers.get("authorization") ?? "";
  if (!services || !authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  if (!token) return null;
  try {
    return await services.auth.verifyIdToken(token, true);
  } catch {
    return null;
  }
}
