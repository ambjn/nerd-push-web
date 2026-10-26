import { mockProvider, type PushProvider } from "./provider";
import { fcmProvider } from "./fcm";

/** PUSH_PROVIDER: mock (default) | fcm | disabled. Disabled leaves pending sends pending with a visible reason. */
export function selectProvider(): PushProvider | { disabled: true; reason: string } {
  const p = process.env.PUSH_PROVIDER ?? "mock";
  if (p === "mock") return mockProvider;
  if (p === "disabled") return { disabled: true, reason: "PUSH_PROVIDER=disabled" };
  if (p === "fcm") {
    if (!process.env.FCM_SERVICE_ACCOUNT_JSON) return { disabled: true, reason: "FCM_SERVICE_ACCOUNT_JSON missing" };
    return fcmProvider;
  }
  return { disabled: true, reason: `unknown PUSH_PROVIDER ${p}` };
}
