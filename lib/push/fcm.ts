import { fcmAccessToken } from "@/lib/firebase";
import type { FcmMessage, ProviderResult, PushProvider } from "./provider";

const PROJECT = () => process.env.FCM_PROJECT_ID ?? "nerd-push";
const EXPECTED_PACKAGE = "com.ambjn.neshpushandroid";

type FcmError = { error?: { status?: string; message?: string; details?: { "@type"?: string; errorCode?: string }[] } };

/**
 * Pure classification of an FCM HTTP v1 response. Exported for stubbed-HTTP tests.
 * Only UNREGISTERED proves a dead token; INVALID_ARGUMENT is a configuration/payload error, not a dead token.
 */
export function classifyFcmResponse(status: number, body: unknown): ProviderResult {
  if (status === 200) {
    const name = (body as { name?: string } | null)?.name ?? "";
    return { outcome: "accepted", providerMessageId: name.slice(0, 256) };
  }
  const e = (body as FcmError | null)?.error;
  const fcmCode = e?.details?.find((d) => d["@type"]?.endsWith("FcmError"))?.errorCode;
  const code = (fcmCode ?? e?.status ?? `HTTP_${status}`).slice(0, 64);
  if (status === 404 && (fcmCode === "UNREGISTERED" || e?.status === "NOT_FOUND")) return { outcome: "proven_dead_token", errorCode: "UNREGISTERED" };
  if (status === 429 || fcmCode === "QUOTA_EXCEEDED") return { outcome: "rate_limited", errorCode: code };
  if (status === 400 || status === 401 || status === 403 || fcmCode === "SENDER_ID_MISMATCH" || fcmCode === "THIRD_PARTY_AUTH_ERROR") {
    return { outcome: "configuration_error", errorCode: code };
  }
  return { outcome: "ambiguous", errorCode: code }; // 5xx and anything unclear: never retried automatically
}

/** Real transport. `fetchImpl` is injectable so tests never reach the network. */
export async function sendViaFcm(message: FcmMessage, deps: { fetchImpl?: typeof fetch; accessToken?: () => Promise<string> } = {}): Promise<ProviderResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  let token: string;
  try { token = await (deps.accessToken ?? fcmAccessToken)(); }
  catch { return { outcome: "configuration_error", errorCode: "OAUTH_UNAVAILABLE" }; }
  const body = { ...message, message: { ...message.message, android: { ...message.message.android, restricted_package_name: EXPECTED_PACKAGE } } };
  let res: Response;
  try {
    res = await fetchImpl(`https://fcm.googleapis.com/v1/projects/${PROJECT()}/messages:send`, {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Timeout or transport failure after the request may have left the process: ambiguous, do not repeat.
    return { outcome: "ambiguous", errorCode: "TRANSPORT_FAILURE" };
  }
  const json = await res.json().catch(() => null);
  return classifyFcmResponse(res.status, json); // raw body, token and OAuth header are never logged or stored
}

export const fcmProvider: PushProvider = { name: "fcm", send: (m) => sendViaFcm(m) };
