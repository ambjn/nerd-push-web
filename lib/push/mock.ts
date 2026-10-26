import type { PushProvider } from "./provider";

/** Default provider outside a reviewed canary. No network. Token prefixes steer the outcome in tests. */
export const mockProvider: PushProvider = {
  name: "mock",
  async send(m) {
    const t = m.message.token;
    if (t.startsWith("dead-")) return { outcome: "proven_dead_token", errorCode: "UNREGISTERED" };
    if (t.startsWith("429-")) return { outcome: "rate_limited", errorCode: "QUOTA_EXCEEDED" };
    if (t.startsWith("ambiguous-")) return { outcome: "ambiguous", errorCode: "TIMEOUT" };
    if (t.startsWith("config-")) return { outcome: "configuration_error", errorCode: "SENDER_ID_MISMATCH" };
    return { outcome: "accepted", providerMessageId: `projects/mock/messages/${m.message.data.event_id}` };
  },
};
