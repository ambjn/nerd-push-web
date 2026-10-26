import { fcmAccessToken } from "@/lib/firebase";
import type { FcmMessage } from "./payload";
import type { ProviderResult, PushProvider } from "./provider";

const PROJECT = () => process.env.FIREBASE_PROJECT_ID ?? "nerd-push";
export const EXPECTED_PACKAGE = "com.ambjn.neshpushandroid";
type FcmError = { error?: { status?: string; details?: { "@type"?: string; errorCode?: string }[] } };

/** Pure classification. Only UNREGISTERED proves a dead token; INVALID_ARGUMENT is a configuration/payload error. */
export function classifyFcmResponse(status: number, body: unknown): ProviderResult {
  if (status === 200) return { outcome: "accepted", providerMessageId: ((body as { name?: string } | null)?.name ?? "").slice(0, 256) };
  const e = (body as FcmError | null)?.error;
  const fcmCode = e?.details?.find((d) => d["@type"]?.endsWith("FcmError"))?.errorCode;
  const code = (fcmCode ?? e?.status ?? `HTTP_${status}`).slice(0, 64);
  if (status === 404 && (fcmCode === "UNREGISTERED" || e?.status === "NOT_FOUND")) return { outcome: "proven_dead_token", errorCode: "UNREGISTERED" };
  if (status === 429 || fcmCode === "QUOTA_EXCEEDED") return { outcome: "rate_limited", errorCode: code };
  if (status === 400 || status === 401 || status === 403 || fcmCode === "SENDER_ID_MISMATCH" || fcmCode === "THIRD_PARTY_AUTH_ERROR") return { outcome: "configuration_error", errorCode: code };
  return { outcome: "ambiguous", errorCode: code }; // 5xx / unreadable: never retried automatically
}

let cached: { token: string; expiresAt: number } | null = null;
async function token(mint: () => Promise<{ token: string; expiresAt: number }>) {
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;
  cached = await mint();
  return cached.token;
}

/** Direct FCM HTTP v1. fetch and token minting are injectable; tests never reach Google. Nothing secret is logged or returned. */
export async function sendViaFcm(message: FcmMessage, deps: { fetchImpl?: typeof fetch; mint?: () => Promise<{ token: string; expiresAt: number }> } = {}): Promise<ProviderResult> {
  let bearer: string;
  try { bearer = await token(deps.mint ?? fcmAccessToken); } catch { return { outcome: "configuration_error", errorCode: "OAUTH_UNAVAILABLE" }; }
  const body = { ...message, message: { ...message.message, android: { ...message.message.android, restricted_package_name: EXPECTED_PACKAGE } } };
  let res: Response;
  try {
    res = await (deps.fetchImpl ?? fetch)(`https://fcm.googleapis.com/v1/projects/${PROJECT()}/messages:send`, {
      method: "POST", headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000),
    });
  } catch { return { outcome: "ambiguous", errorCode: "TRANSPORT_FAILURE" }; }
  return classifyFcmResponse(res.status, await res.json().catch(() => null));
}
export const fcmProvider: PushProvider = { name: "fcm", send: (m) => sendViaFcm(m) };
