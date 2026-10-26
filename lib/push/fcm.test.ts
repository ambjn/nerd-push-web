import { expect, test } from "bun:test";
import { classifyFcmResponse, sendViaFcm } from "./fcm";
import { buildFcmMessage } from "./fcm-payload";

const fcmErr = (status: number, code?: string, st?: string) => ({ error: { status: st, details: code ? [{ "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError", errorCode: code }] : [] } });

test("classification follows the v1 rules", () => {
  expect(classifyFcmResponse(200, { name: "projects/x/messages/1" })).toEqual({ outcome: "accepted", providerMessageId: "projects/x/messages/1" });
  expect(classifyFcmResponse(404, fcmErr(404, "UNREGISTERED", "NOT_FOUND"))).toMatchObject({ outcome: "proven_dead_token" });
  expect(classifyFcmResponse(429, fcmErr(429, "QUOTA_EXCEEDED"))).toMatchObject({ outcome: "rate_limited" });
  expect(classifyFcmResponse(400, fcmErr(400, "INVALID_ARGUMENT"))).toMatchObject({ outcome: "configuration_error" }); // not a dead token
  expect(classifyFcmResponse(403, fcmErr(403, "SENDER_ID_MISMATCH"))).toMatchObject({ outcome: "configuration_error" });
  expect(classifyFcmResponse(503, fcmErr(503, "UNAVAILABLE"))).toMatchObject({ outcome: "ambiguous" });
});

test("transport never leaks the token or OAuth header into the result and treats a timeout as ambiguous", async () => {
  const m = buildFcmMessage("secret-device-token", "s1", { title: "t", body: "b", route_key: "home" });
  let seen: { url: string; body: string } | null = null;
  const ok = await sendViaFcm(m, {
    accessToken: async () => "oauth-secret",
    fetchImpl: (async (url: string, init: RequestInit) => { seen = { url, body: String(init.body) }; return new Response(JSON.stringify({ name: "n1" }), { status: 200 }); }) as unknown as typeof fetch,
  });
  expect(ok.outcome).toBe("accepted");
  expect(seen!.url).toContain("/projects/nerd-push/messages:send");
  expect(seen!.body).toContain('"restricted_package_name":"com.ambjn.neshpushandroid"');
  expect(JSON.stringify(ok)).not.toContain("secret-device-token");
  expect(JSON.stringify(ok)).not.toContain("oauth-secret");
  const timeout = await sendViaFcm(m, { accessToken: async () => "x", fetchImpl: (async () => { throw new Error("timeout"); }) as unknown as typeof fetch });
  expect(timeout).toEqual({ outcome: "ambiguous", errorCode: "TRANSPORT_FAILURE" });
  const noAuth = await sendViaFcm(m, { accessToken: async () => { throw new Error("no sa"); } });
  expect(noAuth.outcome).toBe("configuration_error");
});
