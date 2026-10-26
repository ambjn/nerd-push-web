import type { FcmMessage } from "./payload";

export type Outcome = "accepted" | "proven_dead_token" | "rate_limited" | "configuration_error" | "ambiguous";
export type ProviderResult = { outcome: Outcome; providerMessageId?: string; errorCode?: string };
export interface PushProvider { readonly name: "mock" | "fcm"; send(message: FcmMessage): Promise<ProviderResult> }

/** Real FCM when FIREBASE_SERVICE_ACCOUNT_JSON is set, otherwise the mock. Only test-send.ts calls the selected provider. */
export const providerName = () => (process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? "fcm" : "mock");
export async function selectProvider(): Promise<PushProvider> {
  return providerName() === "fcm" ? (await import("./fcm")).fcmProvider : (await import("./mock")).mockProvider;
}
