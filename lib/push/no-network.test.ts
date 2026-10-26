import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
/** Pure modules never import the transport or call fetch; only provider.ts imports fcm.ts. */
test("no network under pure push modules", () => {
  for (const f of ["creative.ts", "routes.ts", "payload.ts", "mock.ts", "test-send.ts"]) {
    const src = readFileSync(join(import.meta.dir, f), "utf8");
    expect(src.includes('"./fcm"')).toBe(false); expect(/\bfetch\(/.test(src)).toBe(false); expect(src.includes("googleapis")).toBe(false);
  }
});
