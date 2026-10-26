import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  return initializeApp(json ? { credential: cert(JSON.parse(json)) } : { projectId: process.env.FIREBASE_PROJECT_ID ?? "nerd-push" });
}

/** Verifies a Firebase ID token from an Authorization: Bearer header and returns the UID, or null. */
export async function verifyFirebaseUid(authorization: string | null): Promise<string | null> {
  const token = authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  try { return (await getAuth(app()).verifyIdToken(token)).uid; } catch { return null; }
}

/** Short-lived OAuth token for direct FCM HTTP v1 calls (server only). */
export async function fcmAccessToken(): Promise<{ token: string; expiresAt: number }> {
  const cred = app().options.credential;
  if (!cred) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON missing");
  const t = await cred.getAccessToken();
  return { token: t.access_token, expiresAt: Date.now() + t.expires_in * 1000 };
}
