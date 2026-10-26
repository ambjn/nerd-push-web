export type Outcome = "accepted" | "proven_dead_token" | "rate_limited" | "configuration_error" | "ambiguous";
export type ProviderResult = { outcome: Outcome; providerMessageId?: string; errorCode?: string };
export type FcmMessage = ReturnType<typeof import("./fcm-payload").buildFcmMessage>;

export interface PushProvider {
  readonly name: "mock" | "fcm";
  send(message: FcmMessage): Promise<ProviderResult>;
}

/**
 * Mock provider for local, CI and dashboard previews. Never touches the network.
 * Token prefixes steer the outcome so the full flow can be exercised end to end.
 */
export const mockProvider: PushProvider = {
  name: "mock",
  async send(m) {
    const t = m.message.token;
    if (t.startsWith("dead-")) return { outcome: "proven_dead_token", errorCode: "UNREGISTERED" };
    if (t.startsWith("429-")) return { outcome: "rate_limited", errorCode: "QUOTA_EXCEEDED" };
    if (t.startsWith("ambiguous-")) return { outcome: "ambiguous", errorCode: "TIMEOUT" };
    if (t.startsWith("config-")) return { outcome: "configuration_error", errorCode: "SENDER_ID_MISMATCH" };
    return { outcome: "accepted", providerMessageId: `mock/${m.message.data.send_id}` };
  },
};
