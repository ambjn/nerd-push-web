import type { FcmMessage } from "./payload";

export type Outcome = "accepted" | "proven_dead_token" | "rate_limited" | "configuration_error" | "ambiguous";
export type ProviderResult = { outcome: Outcome; providerMessageId?: string; errorCode?: string };
export interface PushProvider { readonly name: "mock" | "fcm"; send(message: FcmMessage): Promise<ProviderResult> }

/** PUSH_PROVIDER=mock (default) | fcm. Only test-send.ts calls the selected provider. */
export async function selectProvider(): Promise<PushProvider | { disabled: true; reason: string }> {
  const p = process.env.PUSH_PROVIDER ?? "mock";
  if (p === "mock") return (await import("./mock")).mockProvider;
  if (p === "fcm") return process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? (await import("./fcm")).fcmProvider : { disabled: true, reason: "FIREBASE_SERVICE_ACCOUNT_JSON missing" };
  return { disabled: true, reason: `unknown PUSH_PROVIDER ${p}` };
}
