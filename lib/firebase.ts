import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";

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

/** Sends one notification to one device token. Returns the FCM message name. */
export function sendPush(token: string, title: string, body: string): Promise<string> {
  return getMessaging(app()).send({ token, notification: { title, body }, android: { priority: "high" } });
}
