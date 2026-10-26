import { expect, test } from "bun:test";
import { classifyFcmResponse, sendViaFcm } from "./fcm";
import { buildFcmMessage } from "./payload";

const err = (code?: string, st?: string) => ({ error: { status: st, details: code ? [{ "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError", errorCode: code }] : [] } });
test("classification contract", () => {
  expect(classifyFcmResponse(200, { name: "projects/x/messages/1" })).toEqual({ outcome: "accepted", providerMessageId: "projects/x/messages/1" });
  expect(classifyFcmResponse(404, err("UNREGISTERED", "NOT_FOUND"))).toMatchObject({ outcome: "proven_dead_token" });
  expect(classifyFcmResponse(429, err("QUOTA_EXCEEDED"))).toMatchObject({ outcome: "rate_limited" });
  expect(classifyFcmResponse(400, err("INVALID_ARGUMENT"))).toMatchObject({ outcome: "configuration_error" });
  expect(classifyFcmResponse(403, err("SENDER_ID_MISMATCH"))).toMatchObject({ outcome: "configuration_error" });
  expect(classifyFcmResponse(503, err("UNAVAILABLE"))).toMatchObject({ outcome: "ambiguous" });
});
test("stubbed transport: project and package pinned, no secret leaks, timeout ambiguous, token cached", async () => {
  const m = buildFcmMessage("secret-device-token", { eventId: "e", targetUserId: "u", title: "t", body: "b", notificationType: "nerdpush_transactional", route: "home" });
  let seen = ""; let mints = 0;
  const mint = async () => { mints++; return { token: "oauth-secret", expiresAt: Date.now() + 3600_000 }; };
  const ok200 = (async (url: string, init: RequestInit) => { seen = url + String(init.body); return new Response(JSON.stringify({ name: "n1" }), { status: 200 }); }) as unknown as typeof fetch;
  const r = await sendViaFcm(m, { mint, fetchImpl: ok200 }); await sendViaFcm(m, { mint, fetchImpl: ok200 });
  expect(r.outcome).toBe("accepted"); expect(mints).toBe(1);
  expect(seen).toContain("/projects/nerd-push/messages:send"); expect(seen).toContain('"restricted_package_name":"com.ambjn.neshpushandroid"');
  expect(JSON.stringify(r)).not.toMatch(/secret-device-token|oauth-secret/);
  expect(await sendViaFcm(m, { mint, fetchImpl: (async () => { throw new Error("timeout"); }) as unknown as typeof fetch })).toEqual({ outcome: "ambiguous", errorCode: "TRANSPORT_FAILURE" });
});
