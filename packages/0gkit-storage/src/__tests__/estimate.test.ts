import { describe, it, expect } from "vitest";
import { Storage } from "../storage.js";
import { SEGMENT_SIZE_BYTES, estimateBytes } from "../estimate.js";

const KB = 1024;

const fakeSdk = {
  MemData: class {
    constructor(public readonly data: number[]) {}
    async merkleTree() {
      const root = { rootHash: () => "0xabc" };
      return [root, null] as const;
    }
  },
  Indexer: class {
    constructor(public readonly url: string) {}
    async upload(): Promise<readonly [unknown, Error | null]> {
      throw new Error("dry-run should not call indexer.upload");
    }
    async downloadToBlob(): Promise<readonly [Blob | null, Error | null]> {
      throw new Error("not used");
    }
    async peekHeader(): Promise<readonly [unknown, Error | null]> {
      throw new Error("not used");
    }
  },
};

describe("estimateBytes (pure)", () => {
  it("0 bytes → 0 segments", () => {
    const e = estimateBytes(0);
    expect(e.sizeBytes).toBe(0);
    expect(e.segments).toBe(0);
  });

  it("partial segment counts as 1", () => {
    const e = estimateBytes(1);
    expect(e.segments).toBe(1);
  });

  it("exact segment boundary", () => {
    const e = estimateBytes(SEGMENT_SIZE_BYTES);
    expect(e.segments).toBe(1);
  });

  it("just-over boundary rounds up", () => {
    const e = estimateBytes(SEGMENT_SIZE_BYTES + 1);
    expect(e.segments).toBe(2);
  });

  it("1 MiB → 4 segments", () => {
    const e = estimateBytes(1024 * KB);
    expect(e.segments).toBe(4);
  });
});

describe("Storage.estimate", () => {
  it("returns a typed StorageEstimate", async () => {
    const s = new Storage({
      network: "galileo",
      loadSdk: async () => fakeSdk,
    });
    const data = new Uint8Array(2 * KB);
    const e = await s.estimate(data);
    expect(e.kind).toBe("storage");
    expect(e.breakdown.sizeBytes).toBe(2 * KB);
    expect(e.breakdown.segments).toBe(1);
    expect(e.gas).toBeGreaterThan(0n);
    expect(e.fee).toBeGreaterThanOrEqual(0n);
  });
});

describe("Storage.upload({ dryRun: true })", () => {
  it("returns DryRunResult with no txHash", async () => {
    const s = new Storage({
      network: "galileo",
      privateKey: "0x" + "11".repeat(32),
      loadSdk: async () => fakeSdk,
    });
    const data = new Uint8Array(64);
    const res = await s.upload(data, { dryRun: true });
    expect(res.dryRun).toBe(true);
    expect(res.estimate.kind).toBe("storage");
    expect(res.result.tx.txHash).toBeUndefined();
    expect(res.result.root).toMatch(/^0x[0-9a-f]+$/);
  });
});
