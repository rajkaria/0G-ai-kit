import { describe, expect, it, vi } from "vitest";
import { mockStorageClient } from "@foundryprotocol/0gkit-testing";
import { runStorageFlow } from "../storage-flow.js";
import type { Estimate } from "@foundryprotocol/0gkit-core";

const FAKE_ESTIMATE_FMT = (_e: Estimate) => "estimate: (fake)";

describe("runStorageFlow", () => {
  it("uploads when the root is new", async () => {
    const storage = mockStorageClient();
    const result = await runStorageFlow(
      { bytes: new Uint8Array([1, 2, 3]), label: "fixture.bin" },
      { storage, log: () => undefined, formatEstimate: FAKE_ESTIMATE_FMT }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dedup).toBe(false);
    expect(result.root).toMatch(/^0x[0-9a-f]+$/);
    expect(typeof result.txHash).toBe("string");
    expect(typeof result.latencyMs).toBe("number");
  });

  it("returns dedup=true when the predicted root already exists upstream", async () => {
    const bytes = new Uint8Array([7, 8, 9]);
    const storage = mockStorageClient();
    await storage.upload(bytes);

    const result = await runStorageFlow(
      { bytes, label: "fixture.bin" },
      { storage, log: () => undefined, formatEstimate: FAKE_ESTIMATE_FMT }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dedup).toBe(true);
    expect(result.txHash).toBe("");
    expect(result.latencyMs).toBe(0);
  });

  it("reports a failure if the downloaded bytes do not match", async () => {
    const storage = mockStorageClient();
    vi.spyOn(storage, "download").mockResolvedValue(new Uint8Array([0xff]));

    const result = await runStorageFlow(
      { bytes: new Uint8Array([1, 2, 3]), label: "fixture.bin" },
      { storage, log: () => undefined, formatEstimate: FAKE_ESTIMATE_FMT }
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/did not match/);
  });

  it("invokes formatEstimate on the dry-run estimate", async () => {
    const storage = mockStorageClient();
    const fmt = vi.fn(() => "fmt-out");
    await runStorageFlow(
      { bytes: new Uint8Array([1, 2]), label: "fixture.bin" },
      { storage, log: () => undefined, formatEstimate: fmt }
    );
    expect(fmt).toHaveBeenCalledTimes(1);
  });

  it("logs the predicted root before broadcasting", async () => {
    const storage = mockStorageClient();
    const lines: string[] = [];
    const result = await runStorageFlow(
      { bytes: new Uint8Array([1]), label: "fixture.bin" },
      { storage, log: (m) => lines.push(m), formatEstimate: FAKE_ESTIMATE_FMT }
    );
    expect(result.ok).toBe(true);
    expect(lines.some((l) => l.includes("predicted root"))).toBe(true);
    expect(lines.some((l) => l.startsWith("Uploading"))).toBe(true);
  });

  it("propagates the read-byte count via the initial log line", async () => {
    const storage = mockStorageClient();
    const lines: string[] = [];
    await runStorageFlow(
      { bytes: new Uint8Array([1, 2, 3, 4, 5]), label: "five.bin" },
      { storage, log: (m) => lines.push(m), formatEstimate: FAKE_ESTIMATE_FMT }
    );
    expect(lines[0]).toBe("Read 5 bytes from five.bin");
  });
});
