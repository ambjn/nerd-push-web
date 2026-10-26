import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const projectId = process.env.FCM_PROJECT_ID ?? "nerd-push";

function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const json = process.env.FCM_SERVICE_ACCOUNT_JSON;
  // ID-token verification only needs the project ID; the service account is for FCM.
  return initializeApp(json ? { projectId, credential: cert(JSON.parse(json)) } : { projectId });
}

/** Verifies a Firebase ID token (issuer, audience, expiry, signature) and returns the UID. */
export async function verifyFirebaseUid(authorization: string | null): Promise<string | null> {
  const token = authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  try {
    const decoded = await getAuth(app()).verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

/** OAuth access token for FCM HTTP v1. Requires FCM_SERVICE_ACCOUNT_JSON. */
export async function fcmAccessToken(): Promise<string> {
  const cred = app().options.credential;
  if (!cred) throw new Error("FCM_SERVICE_ACCOUNT_JSON missing");
  return (await cred.getAccessToken()).access_token;
}
