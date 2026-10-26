import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from "jose";

const PROJECT_ID = () => process.env.FIREBASE_PROJECT_ID ?? "nerd-push";
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

/** Verifies a Firebase ID token (RS256 signature, issuer, audience, expiry) and returns its UID, or null. */
export async function verifyFirebaseUid(authorization: string | null): Promise<string | null> {
  const token = authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: `https://securetoken.google.com/${PROJECT_ID()}`, audience: PROJECT_ID(), algorithms: ["RS256"] });
    return typeof payload.sub === "string" && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Short-lived OAuth access token for FCM HTTP v1, minted from FIREBASE_SERVICE_ACCOUNT_JSON (server only). */
export async function fcmAccessToken(): Promise<{ token: string; expiresAt: number }> {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON missing");
  const sa = JSON.parse(json) as { client_email: string; private_key: string; token_uri?: string };
  const key = await importPKCS8(sa.private_key, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" }).setIssuer(sa.client_email).setAudience(sa.token_uri ?? "https://oauth2.googleapis.com/token")
    .setIssuedAt().setExpirationTime("1h").sign(key);
  const res = await fetch(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`oauth_${res.status}`);
  const t = (await res.json()) as { access_token: string; expires_in: number };
  return { token: t.access_token, expiresAt: Date.now() + t.expires_in * 1000 };
}
