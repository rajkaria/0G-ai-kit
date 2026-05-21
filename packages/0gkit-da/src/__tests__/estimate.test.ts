import { describe, it, expect } from "vitest";
import { DA } from "../da.js";
import { estimateBytes, DEFAULT_DA_RATE_WEI_PER_BYTE } from "../estimate.js";

describe("estimateBytes (pure)", () => {
  it("0 bytes → fee 0", () => {
    expect(estimateBytes(0).fee).toBe(0n);
  });

  it("1 KB → rate * 1024", () => {
    const e = estimateBytes(1024);
    expect(e.fee).toBe(DEFAULT_DA_RATE_WEI_PER_BYTE * 1024n);
  });

  it("custom rate honoured", () => {
    const e = estimateBytes(100, 7n);
    expect(e.fee).toBe(700n);
  });
});

describe("DA.estimate", () => {
  it("returns DAEstimate for a byte array", async () => {
    const da = new DA({ network: "galileo" });
    const e = await da.estimate(new Uint8Array(2048));
    expect(e.kind).toBe("da");
    expect(e.breakdown.sizeBytes).toBe(2048);
    expect(e.fee).toBeGreaterThan(0n);
  });

  it("local mode = zero fee", async () => {
    const da = new DA({}); // no encoderUrl → local mode
    const e = await da.estimate(new Uint8Array(1024));
    expect(e.fee).toBe(0n);
    expect(e.breakdown.mode).toBe("local");
  });
});

describe("DA.publish({ dryRun: true })", () => {
  it("returns DryRunResult, no fetch", async () => {
    let called = false;
    const da = new DA({
      encoderUrl: "https://example.invalid",
      fetch: (async () => {
        called = true;
        return new Response("{}");
      }) as typeof fetch,
    });
    const res = await da.publish(new Uint8Array(4), { dryRun: true });
    expect(res.dryRun).toBe(true);
    expect(res.result.daRef).toBeUndefined();
    expect(res.result.mode).toBe("live");
    expect(called).toBe(false);
  });
});
