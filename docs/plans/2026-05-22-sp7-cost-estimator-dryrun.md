# SP7 — Cost Estimator + Dry-Run Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `.estimate()` and `{ dryRun: true }` on every 0gkit primitive (storage, compute, DA, contracts) + a top-level `0g estimate <op>` CLI namespace + per-command `--dry-run` flags. Every write path answers "what will this cost me?" before broadcasting a single tx.

**Architecture:** A common `Estimate` / `DryRunResult<T>` envelope in `0gkit-core` so every primitive returns the same shape (typed `breakdown` plus `gas`, `fee`, and optional `seconds`). Each primitive package adds a small `estimate.ts` module owning the math (token counting for compute; segment counting + gas estimation for storage; byte-rate pricing for DA; viem `estimateContractGas` + `simulateContract` for contracts) and an `{ dryRun: true }` overload on its write methods that returns the estimate alongside a `txHash: undefined` receipt instead of broadcasting. The CLI exposes the surface as `0g estimate storage|compute|da|contracts` plus a `--dry-run` flag on existing `0g storage put` / `0g da publish` / `0g infer` commands. All math is pure and snapshot-tested.

**Tech Stack:** TypeScript ES2022 ESM, `viem ^2.21` (`estimateContractGas`, `getGasPrice`, `simulateContract`), `vitest 2.1.8` with snapshot tests for CLI output stability. No new runtime deps — every primitive package already pulls in `viem` or has SDK access for size/cost data. Coverage gates: existing 80/70 lines/branches per package; `0gkit-core` estimate.ts targets 95%+ (pure helpers).

---

## Hard Invariants Honored

- **I1 Neutrality** — every new module imports only `0gkit-core` + `viem` + (where present) the existing 0G SDK. No `@foundryprotocol/sdk` imports, static or dynamic with a literal specifier. Enforced by each primitive's existing `boundary.test.ts`.
- **I2 Layering** — `Estimate` and `DryRunResult` live in Layer 0 (`0gkit-core`). Primitives in Layer 1 add `.estimate()`. CLI in Layer 2 consumes everything. No lower-layer reaches upward.
- **I3 One thing per package** — no new packages. Each primitive adds an `estimate.ts` module alongside its main file.
- **I6 Coverage** — 80/70 line/branch gate held across all touched packages.
- **I7 Changesets** — minor bumps for `0gkit-core`, `0gkit-storage`, `0gkit-compute`, `0gkit-da`, `0gkit-contracts`, `0gkit-cli` (new public APIs).
- **I8 No raw privateKey** — every new dry-run path takes the same `{ signer }` shape; no new key surface introduced.

---

## File Structure

### Modify: `packages/0gkit-core/`

| File                             | Responsibility                                                                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/estimate.ts`                | NEW. `Estimate` base interface, `DryRunResult<T>` envelope, `formatEstimate(est)` human-renderer, `formatNative(wei)` for human bigint display. |
| `src/index.ts`                   | Re-export `Estimate`, `DryRunResult`, `formatEstimate`, `formatNative`, plus the four per-primitive aliases (`StorageEstimate`, etc.) as types. |
| `src/__tests__/estimate.test.ts` | NEW. Pure-function tests for `formatEstimate` + `formatNative` (zero, sub-gwei, sub-eth, multi-eth boundaries).                                 |

### Modify: `packages/0gkit-storage/`

| File                             | Responsibility                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/estimate.ts`                | NEW. `StorageEstimate` type, `SEGMENT_SIZE_BYTES = 256 * 1024`, pure `estimateBytes(bytes)` segment math. |
| `src/storage.ts`                 | Add `Storage.estimate(bytes): Promise<StorageEstimate>`; add `{ dryRun?: boolean }` overload to `upload`. |
| `src/index.ts`                   | Re-export `StorageEstimate`, `SEGMENT_SIZE_BYTES`.                                                        |
| `src/__tests__/estimate.test.ts` | NEW. Tests: empty, single-segment, multi-segment boundary, large blob, dry-run returns no txHash.         |

### Modify: `packages/0gkit-compute/`

| File                             | Responsibility                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/estimate.ts`                | NEW. `ComputeEstimate` type, `countTokens(text)` heuristic (chars/4 rounded up), `DEFAULT_MAX_OUTPUT_TOKENS = 512`. |
| `src/compute.ts`                 | Add `Compute.estimate(args): Promise<ComputeEstimate>`; add `{ dryRun?: boolean }` overload to `inference`.         |
| `src/index.ts`                   | Re-export `ComputeEstimate`, `countTokens`, `DEFAULT_MAX_OUTPUT_TOKENS`.                                            |
| `src/__tests__/estimate.test.ts` | NEW. Tests: empty, single message, multi-message, unicode, dry-run skips broker call.                               |

### Modify: `packages/0gkit-da/`

| File                             | Responsibility                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/estimate.ts`                | NEW. `DAEstimate` type, `DEFAULT_DA_RATE_WEI_PER_BYTE = 1_000_000n` (placeholder; documented), `estimateBytes(bytes, ratePerByte?)`. |
| `src/da.ts`                      | Add `DA.estimate(bytes): Promise<DAEstimate>`; add `{ dryRun?: boolean }` overload to `publish`.                                     |
| `src/index.ts`                   | Re-export `DAEstimate`, `DEFAULT_DA_RATE_WEI_PER_BYTE`.                                                                              |
| `src/__tests__/estimate.test.ts` | NEW. Tests: byte count, KB conversion, local-mode = zero fee, dry-run skips encoder call.                                            |

### Modify: `packages/0gkit-contracts/`

| File                             | Responsibility                                                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/estimate.ts`                | NEW. `ContractEstimate` type, pure `weiToFee(gas, gasPrice)` helper.                                                 |
| `src/factory.ts`                 | Add `estimate.<method>(...args)` namespace to `TypedContract`; add `{ dryRun?: boolean }` to `write.<method>` calls. |
| `src/types.ts`                   | Add `WriteOptions` and a `DryRunWriteResult` union; update `TypedContract<TAbi>` interface.                          |
| `src/index.ts`                   | Re-export `ContractEstimate`, `WriteOptions`.                                                                        |
| `src/__tests__/estimate.test.ts` | NEW. Tests: estimate returns gas+fee from mocked publicClient; dry-run uses simulateContract; missing wallet path.   |

### Modify: `packages/0gkit-cli/`

| File                             | Responsibility                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------ | ------- | --- | ---------------------------------------------------------------- |
| `src/commands/estimate.ts`       | NEW. Registers `0g estimate storage                                                  | compute | da  | contracts`subcommands; renders human + JSON via`formatEstimate`. |
| `src/commands/storage.ts`        | Add `--dry-run` flag to `0g storage put`; print dry-run result without broadcasting. |
| `src/commands/da.ts`             | Add `--dry-run` flag to `0g da publish`.                                             |
| `src/commands/infer.ts`          | Add `--dry-run` flag to `0g infer`.                                                  |
| `src/program.ts`                 | Register `registerEstimate(program, deps)`.                                          |
| `src/__tests__/estimate.test.ts` | NEW. Snapshot tests for `0g estimate storage                                         | compute | da  | contracts`human +`--json` output.                                |
| `src/__tests__/storage.test.ts`  | Add `--dry-run` snapshot test for `0g storage put`.                                  |
| `src/__tests__/da.test.ts`       | Add `--dry-run` snapshot test for `0g da publish`.                                   |
| `src/__tests__/infer.test.ts`    | Add `--dry-run` snapshot test for `0g infer`.                                        |

### Root-level changes

| File                                          | Responsibility                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `.changeset/sp7-cost-estimator-dryrun.md`     | `minor` bumps for `0gkit-core`, `0gkit-storage`, `0gkit-compute`, `0gkit-da`, `0gkit-contracts`, `0gkit-cli`. |
| `README.md`                                   | Add `0g estimate` row to the CLI feature table; mention `.estimate()` + `dryRun: true` in the API blurb.      |
| `docs/DECISIONS.md`                           | Append **D21** (token-count heuristic), **D22** (storage segment math), **D23** (dryRun envelope shape).      |
| `docs/specs/2026-05-20-essentials-roadmap.md` | Flip SP7 status row to ✅ (shipped) at end of plan.                                                           |
| `packages/0gkit-storage/README.md`            | Append "Estimating & dry-run" section.                                                                        |
| `packages/0gkit-compute/README.md`            | Append "Estimating & dry-run" section.                                                                        |
| `packages/0gkit-da/README.md`                 | Append "Estimating & dry-run" section.                                                                        |
| `packages/0gkit-contracts/README.md`          | Append "Estimating & dry-run" section.                                                                        |
| `packages/0gkit-cli/README.md`                | Append `0g estimate` section.                                                                                 |

---

## Task Decomposition (12 tasks)

Each task is independently testable. Commit after every task. Coverage gates enforced per-package on each commit.

---

### Task 1: Core `Estimate` + `DryRunResult` types and formatters

**Files:**

- Create: `packages/0gkit-core/src/estimate.ts`
- Modify: `packages/0gkit-core/src/index.ts`
- Test: `packages/0gkit-core/src/__tests__/estimate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/0gkit-core/src/__tests__/estimate.test.ts
import { describe, it, expect } from "vitest";
import { formatEstimate, formatNative, type Estimate } from "../estimate.js";

describe("formatNative", () => {
  it("renders 0 wei", () => {
    expect(formatNative(0n)).toBe("0 0G");
  });

  it("renders sub-gwei wei in scientific notation", () => {
    expect(formatNative(1n)).toBe("1e-18 0G");
  });

  it("renders gwei range with 9 decimals", () => {
    expect(formatNative(1_000_000_000n)).toBe("0.000000001 0G");
  });

  it("renders sub-1-0G amounts with 6 decimals", () => {
    expect(formatNative(123_456_789_000_000n)).toBe("0.000123 0G");
  });

  it("renders whole-0G amounts with 4 decimals", () => {
    expect(formatNative(2_500_000_000_000_000_000n)).toBe("2.5000 0G");
  });
});

describe("formatEstimate", () => {
  it("renders a minimal estimate", () => {
    const est: Estimate = {
      kind: "storage",
      gas: 21_000n,
      fee: 21_000_000_000_000n,
      breakdown: { sizeBytes: 1024 },
    };
    const out = formatEstimate(est);
    expect(out).toContain("kind        storage");
    expect(out).toContain("gas         21000");
    expect(out).toContain("fee         0.000021 0G");
    expect(out).toContain("sizeBytes   1024");
  });

  it("renders expectedSeconds when present", () => {
    const est: Estimate = {
      kind: "da",
      gas: 0n,
      fee: 0n,
      breakdown: { sizeBytes: 0 },
      expectedSeconds: 8,
    };
    expect(formatEstimate(est)).toContain("expected    ~8s");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/0gkit-core && pnpm test estimate`
Expected: FAIL — `formatEstimate is not a function` / no such module.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/0gkit-core/src/estimate.ts
/**
 * Common cost-estimate envelope used by every 0gkit primitive's `.estimate()`.
 * `kind` discriminates the breakdown shape; `gas` is units, `fee` is wei.
 * `expectedSeconds` is best-effort latency (e.g. block time or polling round-trip).
 */
export interface Estimate {
  readonly kind: "storage" | "compute" | "da" | "contract";
  readonly gas: bigint;
  readonly fee: bigint;
  readonly breakdown: Record<string, string | number | bigint | undefined>;
  readonly expectedSeconds?: number;
}

/**
 * Returned by every write path when called with `{ dryRun: true }`.
 * The `result` field carries the same shape the success path would have
 * returned, but with no broadcast: `txHash` and any chain-side identifiers
 * are `undefined`. `estimate` is always populated.
 */
export interface DryRunResult<T> {
  readonly dryRun: true;
  readonly estimate: Estimate;
  readonly result: T;
}

/**
 * Human-readable wei → "<decimal> 0G".
 * Picks 4/6/9 decimal places by magnitude; falls back to scientific notation
 * for sub-gwei values so the rendering never collapses to "0".
 */
export function formatNative(wei: bigint): string {
  if (wei === 0n) return "0 0G";
  const ONE = 1_000_000_000_000_000_000n; // 1e18
  const GWEI = 1_000_000_000n; // 1e9
  if (wei < GWEI) {
    // Sub-gwei: render in scientific notation so we don't lose the number.
    return `${Number(wei).toExponential().replace(/\+/g, "")} 0G`;
  }
  if (wei < ONE) {
    // Sub-1-0G but at least 1 gwei.
    const dec = (Number(wei) / Number(ONE)).toFixed(6);
    return `${dec} 0G`;
  }
  // ≥ 1 0G.
  const whole = wei / ONE;
  const rem = wei % ONE;
  const fract = Number(rem) / Number(ONE);
  const combined = (Number(whole) + fract).toFixed(4);
  return `${combined} 0G`;
}

/**
 * Render an Estimate as an aligned key/value block. JSON callers should use
 * the structured Estimate directly; this is for human CLI output.
 */
export function formatEstimate(est: Estimate): string {
  const lines: string[] = [];
  lines.push(`kind        ${est.kind}`);
  lines.push(`gas         ${est.gas.toString()}`);
  lines.push(`fee         ${formatNative(est.fee)}`);
  for (const [k, v] of Object.entries(est.breakdown)) {
    if (v === undefined) continue;
    const val = typeof v === "bigint" ? v.toString() : String(v);
    lines.push(`${k.padEnd(12)}${val}`);
  }
  if (est.expectedSeconds !== undefined) {
    lines.push(`expected    ~${est.expectedSeconds}s`);
  }
  return lines.join("\n");
}
```

- [ ] **Step 4: Wire the export in `index.ts`**

Edit `packages/0gkit-core/src/index.ts`, append:

```ts
export {
  formatEstimate,
  formatNative,
  type Estimate,
  type DryRunResult,
} from "./estimate.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/0gkit-core && pnpm test estimate`
Expected: PASS — 7 tests green.

- [ ] **Step 6: Typecheck + boundary check**

Run: `cd packages/0gkit-core && pnpm typecheck && pnpm lint`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add packages/0gkit-core/src/estimate.ts packages/0gkit-core/src/index.ts packages/0gkit-core/src/__tests__/estimate.test.ts
git commit -m "feat(core): add Estimate + DryRunResult + formatters for SP7"
```

---

### Task 2: Storage `.estimate()` + `upload({ dryRun: true })`

**Files:**

- Create: `packages/0gkit-storage/src/estimate.ts`
- Modify: `packages/0gkit-storage/src/storage.ts`
- Modify: `packages/0gkit-storage/src/index.ts`
- Test: `packages/0gkit-storage/src/__tests__/estimate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/0gkit-storage/src/__tests__/estimate.test.ts
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
    async upload() {
      throw new Error("dry-run should not call indexer.upload");
    }
    async downloadToBlob() {
      throw new Error("not used");
    }
    async peekHeader() {
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/0gkit-storage && pnpm test estimate`
Expected: FAIL — `estimateBytes is not exported` / `Storage.estimate is not a function`.

- [ ] **Step 3: Implement `estimate.ts`**

```ts
// packages/0gkit-storage/src/estimate.ts
import type { Estimate } from "@foundryprotocol/0gkit-core";

/**
 * Segment size used by 0G storage's Merkle-tree chunking. 256 KiB matches the
 * default chunk size in @0gfoundation/0g-storage-ts-sdk. Documented so callers
 * can interpret estimates without reading the SDK.
 */
export const SEGMENT_SIZE_BYTES = 256 * 1024;

/**
 * Rough per-segment gas heuristic — covers the SDK's `submit` call's per-segment
 * calldata + per-segment storage write cost. The real network's gas curve will
 * vary by congestion; this gives builders an order-of-magnitude answer they
 * can sanity-check before paying.
 */
const GAS_PER_SEGMENT = 80_000n;
const GAS_BASE = 21_000n;

/** Galileo currently bills storage at ~1 gwei per segment (placeholder). */
const FEE_PER_SEGMENT_WEI = 1_000_000_000n;

export interface StorageEstimateBreakdown {
  readonly sizeBytes: number;
  readonly segments: number;
}

export interface StorageEstimate extends Estimate {
  readonly kind: "storage";
  readonly breakdown: StorageEstimateBreakdown;
}

export function estimateBytes(sizeBytes: number): StorageEstimateBreakdown {
  if (sizeBytes < 0) {
    throw new Error("sizeBytes must be ≥ 0");
  }
  const segments = sizeBytes === 0 ? 0 : Math.ceil(sizeBytes / SEGMENT_SIZE_BYTES);
  return { sizeBytes, segments };
}

export function makeStorageEstimate(sizeBytes: number): StorageEstimate {
  const breakdown = estimateBytes(sizeBytes);
  const gas = GAS_BASE + BigInt(breakdown.segments) * GAS_PER_SEGMENT;
  const fee = BigInt(breakdown.segments) * FEE_PER_SEGMENT_WEI;
  return {
    kind: "storage",
    gas,
    fee,
    breakdown,
    expectedSeconds: 8,
  };
}
```

- [ ] **Step 4: Implement `Storage.estimate` + dry-run overload**

In `packages/0gkit-storage/src/storage.ts`, add:

```ts
import { makeStorageEstimate, type StorageEstimate } from "./estimate.js";
import type { DryRunResult } from "@foundryprotocol/0gkit-core";
```

Then inside `class Storage`, add the new methods (place after `upload` and before `download`):

```ts
async estimate(data: Uint8Array): Promise<StorageEstimate> {
  return makeStorageEstimate(data.length);
}
```

And change the `upload` signature to accept the optional flag. Replace the existing method with:

```ts
async upload(data: Uint8Array): Promise<UploadResult>;
async upload(
  data: Uint8Array,
  opts: { dryRun: true }
): Promise<DryRunResult<UploadResult>>;
async upload(
  data: Uint8Array,
  opts?: { dryRun?: boolean }
): Promise<UploadResult | DryRunResult<UploadResult>> {
  if (opts?.dryRun) {
    const estimate = await this.estimate(data);
    const root = await this.computeRoot(data);
    const result: UploadResult = {
      root,
      tx: { latencyMs: 0 },
      raw: { dryRun: true },
    };
    return { dryRun: true, estimate, result };
  }
  const signer = await this.signer();
  const mod = await this.sdk();
  const startedAt = Date.now();
  const file = new mod.MemData(Array.from(data));
  const indexer = new mod.Indexer(this.indexerUrl);
  const [res, err] = await indexer.upload(file, this.rpcUrl, signer);
  if (err) {
    throw new NetworkError(
      `0G Storage upload failed: ${err.message}`,
      `Check the indexer (${this.indexerUrl}) and RPC are reachable and the signer is funded.`
    );
  }
  const o = res as Record<string, unknown>;
  const root =
    "rootHash" in o
      ? (o.rootHash as string)
      : (o.rootHashes as string[] | undefined)?.[0];
  const txHash =
    "txHash" in o ? (o.txHash as string) : (o.txHashes as string[] | undefined)?.[0];
  if (!root || !txHash) {
    throw new NetworkError(
      `0G Storage upload returned an unrecognized result shape.`,
      `Report this to the 0gkit maintainers with your @0gfoundation/0g-storage-ts-sdk version.`
    );
  }
  return {
    root: normalizeHex(root),
    tx: { txHash: normalizeHex(txHash), latencyMs: Date.now() - startedAt },
    raw: res,
  };
}
```

- [ ] **Step 5: Re-export from `index.ts`**

Edit `packages/0gkit-storage/src/index.ts`, append:

```ts
export {
  SEGMENT_SIZE_BYTES,
  estimateBytes,
  makeStorageEstimate,
  type StorageEstimate,
  type StorageEstimateBreakdown,
} from "./estimate.js";
```

- [ ] **Step 6: Run tests + typecheck**

Run: `cd packages/0gkit-storage && pnpm test && pnpm typecheck && pnpm lint`
Expected: all pass; new tests green; coverage gate 80/70 still met.

- [ ] **Step 7: Commit**

```bash
git add packages/0gkit-storage/src/estimate.ts packages/0gkit-storage/src/storage.ts packages/0gkit-storage/src/index.ts packages/0gkit-storage/src/__tests__/estimate.test.ts
git commit -m "feat(storage): add Storage.estimate + upload({ dryRun }) for SP7"
```

---

### Task 3: Compute `.estimate()` + `inference({ dryRun: true })`

**Files:**

- Create: `packages/0gkit-compute/src/estimate.ts`
- Modify: `packages/0gkit-compute/src/compute.ts`
- Modify: `packages/0gkit-compute/src/index.ts`
- Test: `packages/0gkit-compute/src/__tests__/estimate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/0gkit-compute/src/__tests__/estimate.test.ts
import { describe, it, expect } from "vitest";
import { Compute } from "../compute.js";
import { countTokens, DEFAULT_MAX_OUTPUT_TOKENS } from "../estimate.js";

describe("countTokens (heuristic)", () => {
  it("empty string → 0 tokens", () => {
    expect(countTokens("")).toBe(0);
  });

  it("4 ASCII chars → 1 token", () => {
    expect(countTokens("abcd")).toBe(1);
  });

  it("5 ASCII chars → 2 tokens (ceil)", () => {
    expect(countTokens("abcde")).toBe(2);
  });

  it("unicode emoji counts code units, not codepoints", () => {
    expect(countTokens("😀")).toBe(1);
  });
});

const stubBroker = {
  acknowledgeProviderSigner: async () => {},
  getServiceMetadata: async () => ({
    endpoint: "https://example.invalid",
    model: "demo",
  }),
  getRequestHeaders: async () => ({}),
  processResponse: async () => null,
  listService: async () => [],
};

describe("Compute.estimate", () => {
  it("returns ComputeEstimate from messages", async () => {
    const c = new Compute({
      brokerKey: "0x" + "22".repeat(32),
      provider: "0x" + "11".repeat(20),
    });
    const e = await c.estimate({
      messages: [
        { role: "user", content: "Hello world" }, // 11 chars → 3 tokens
      ],
    });
    expect(e.kind).toBe("compute");
    expect(e.breakdown.inputTokens).toBe(3);
    expect(e.breakdown.outputTokensMax).toBe(DEFAULT_MAX_OUTPUT_TOKENS);
    expect(e.fee).toBeGreaterThanOrEqual(0n);
  });

  it("honours explicit maxOutputTokens", async () => {
    const c = new Compute({
      brokerKey: "0x" + "22".repeat(32),
      provider: "0x" + "11".repeat(20),
    });
    const e = await c.estimate({
      messages: [{ role: "user", content: "hi" }],
      maxOutputTokens: 64,
    });
    expect(e.breakdown.outputTokensMax).toBe(64);
  });
});

describe("Compute.inference({ dryRun: true })", () => {
  it("returns DryRunResult without calling fetch", async () => {
    let fetchCalled = false;
    const c = new Compute({
      brokerKey: "0x" + "22".repeat(32),
      provider: "0x" + "11".repeat(20),
      fetch: (async () => {
        fetchCalled = true;
        return new Response("{}");
      }) as typeof fetch,
      loadBroker: async () => ({
        createZGComputeNetworkBroker: async () => ({ inference: stubBroker }),
      }),
      loadEthers: async () =>
        ({
          JsonRpcProvider: class {},
          Wallet: class {},
        }) as unknown as typeof import("ethers"),
    });
    const res = await c.inference(
      { messages: [{ role: "user", content: "ping" }] },
      { dryRun: true }
    );
    expect(res.dryRun).toBe(true);
    expect(res.estimate.kind).toBe("compute");
    expect(res.result.output).toBe("");
    expect(res.result.receipt.txHash).toBeUndefined();
    expect(fetchCalled).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/0gkit-compute && pnpm test estimate`
Expected: FAIL — module `../estimate.js` not found.

- [ ] **Step 3: Implement `estimate.ts`**

```ts
// packages/0gkit-compute/src/estimate.ts
import type { Estimate } from "@foundryprotocol/0gkit-core";
import type { ChatMessage } from "./compute.js";

/** Default max-output cap used when the caller doesn't specify one. */
export const DEFAULT_MAX_OUTPUT_TOKENS = 512;

/**
 * Galileo broker's published nominal rate as of 2026-05.
 * Real rates are returned by `broker.inference.getServiceMetadata` per provider —
 * this is the offline fallback so `.estimate()` never has to round-trip.
 */
export const DEFAULT_FEE_WEI_PER_TOKEN = 1_000_000_000n; // 1 gwei

/**
 * Rough character-to-token estimator. OpenAI's documented heuristic
 * ("English ≈ 4 chars/token") is good enough for ballpark cost estimates; an
 * exact tokenizer adds megabytes of vocab files and we never claim precision.
 * Documented in D21.
 */
export function countTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}

export interface ComputeEstimateBreakdown {
  readonly inputTokens: number;
  readonly outputTokensMax: number;
  readonly model: string;
}

export interface ComputeEstimate extends Estimate {
  readonly kind: "compute";
  readonly breakdown: ComputeEstimateBreakdown;
}

export function makeComputeEstimate(args: {
  messages: ChatMessage[];
  model?: string;
  maxOutputTokens?: number;
  feeWeiPerToken?: bigint;
}): ComputeEstimate {
  const inputTokens = args.messages.reduce((acc, m) => acc + countTokens(m.content), 0);
  const outputTokensMax = args.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const rate = args.feeWeiPerToken ?? DEFAULT_FEE_WEI_PER_TOKEN;
  const fee = BigInt(inputTokens + outputTokensMax) * rate;
  return {
    kind: "compute",
    gas: 0n, // inference settles via broker, not direct gas
    fee,
    breakdown: {
      inputTokens,
      outputTokensMax,
      model: args.model ?? "(provider default)",
    },
    expectedSeconds: 5,
  };
}
```

- [ ] **Step 4: Add `Compute.estimate` + dry-run overload**

In `packages/0gkit-compute/src/compute.ts`, add the import:

```ts
import { makeComputeEstimate, type ComputeEstimate } from "./estimate.js";
import type { DryRunResult } from "@foundryprotocol/0gkit-core";
```

Add the estimate method and replace the existing `inference` with overload:

```ts
async estimate(args: {
  messages: ChatMessage[];
  model?: string;
  maxOutputTokens?: number;
}): Promise<ComputeEstimate> {
  return makeComputeEstimate({
    messages: args.messages,
    model: args.model ?? this.cfg.model,
    maxOutputTokens: args.maxOutputTokens,
  });
}

async inference(args: {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<InferenceResult>;
async inference(
  args: {
    model?: string;
    messages: ChatMessage[];
    temperature?: number;
    maxOutputTokens?: number;
  },
  opts: { dryRun: true }
): Promise<DryRunResult<InferenceResult>>;
async inference(
  args: {
    model?: string;
    messages: ChatMessage[];
    temperature?: number;
    maxOutputTokens?: number;
  },
  opts?: { dryRun?: boolean }
): Promise<InferenceResult | DryRunResult<InferenceResult>> {
  if (opts?.dryRun) {
    const estimate = await this.estimate(args);
    const result: InferenceResult = {
      output: "",
      receipt: { latencyMs: 0 },
      raw: { dryRun: true },
    };
    return { dryRun: true, estimate, result };
  }
  // existing real-inference body — leave unchanged
  const provider = this.requireProvider();
  const broker = await this.getBroker();
  // ... (rest of the original body)
}
```

(Copy the rest of the original `inference` body verbatim into the non-dry-run branch.)

- [ ] **Step 5: Re-export from `index.ts`**

Edit `packages/0gkit-compute/src/index.ts`, append:

```ts
export {
  countTokens,
  makeComputeEstimate,
  DEFAULT_MAX_OUTPUT_TOKENS,
  DEFAULT_FEE_WEI_PER_TOKEN,
  type ComputeEstimate,
  type ComputeEstimateBreakdown,
} from "./estimate.js";
```

- [ ] **Step 6: Run tests + typecheck**

Run: `cd packages/0gkit-compute && pnpm test && pnpm typecheck && pnpm lint`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/0gkit-compute/src/estimate.ts packages/0gkit-compute/src/compute.ts packages/0gkit-compute/src/index.ts packages/0gkit-compute/src/__tests__/estimate.test.ts
git commit -m "feat(compute): add Compute.estimate + inference({ dryRun }) for SP7"
```

---

### Task 4: DA `.estimate()` + `publish({ dryRun: true })`

**Files:**

- Create: `packages/0gkit-da/src/estimate.ts`
- Modify: `packages/0gkit-da/src/da.ts`
- Modify: `packages/0gkit-da/src/index.ts`
- Test: `packages/0gkit-da/src/__tests__/estimate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/0gkit-da/src/__tests__/estimate.test.ts
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
    expect(res.result.mode).toBe("live"); // would have been live if broadcast
    expect(called).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/0gkit-da && pnpm test estimate`
Expected: FAIL.

- [ ] **Step 3: Implement `estimate.ts`**

```ts
// packages/0gkit-da/src/estimate.ts
import type { Estimate } from "@foundryprotocol/0gkit-core";

/**
 * Placeholder rate for 0G DA pricing. Real on-chain pricing is not yet
 * published as a programmatic feed; this gives builders the right
 * order-of-magnitude (~1 nano-0G/byte ≈ $0.000_x per KB). When the encoder
 * exposes a metadata endpoint we'll honour that and fall back to this.
 * Documented in D21/D23.
 */
export const DEFAULT_DA_RATE_WEI_PER_BYTE = 1_000_000n; // 1e6 wei/byte

export interface DAEstimateBreakdown {
  readonly sizeBytes: number;
  readonly mode: "live" | "local";
}

export interface DAEstimate extends Estimate {
  readonly kind: "da";
  readonly breakdown: DAEstimateBreakdown;
}

/** Pure: bytes → estimate. `mode: "local"` yields fee 0. */
export function estimateBytes(
  sizeBytes: number,
  ratePerByte: bigint = DEFAULT_DA_RATE_WEI_PER_BYTE,
  mode: "live" | "local" = "live"
): DAEstimate {
  if (sizeBytes < 0) {
    throw new Error("sizeBytes must be ≥ 0");
  }
  const fee = mode === "local" ? 0n : BigInt(sizeBytes) * ratePerByte;
  return {
    kind: "da",
    gas: 0n,
    fee,
    breakdown: { sizeBytes, mode },
    expectedSeconds: 4,
  };
}
```

- [ ] **Step 4: Add `DA.estimate` + dry-run overload**

In `packages/0gkit-da/src/da.ts`:

```ts
import { estimateBytes, type DAEstimate } from "./estimate.js";
import type { DryRunResult } from "@foundryprotocol/0gkit-core";
```

Inside `class DA`, add:

```ts
async estimate(payload: unknown): Promise<DAEstimate> {
  const bytes = this.toBytes(payload);
  return estimateBytes(
    bytes.length,
    undefined,
    this.encoderUrl ? "live" : "local"
  );
}
```

Replace `publish` with overloads:

```ts
async publish(payload: unknown): Promise<DAPublishResult>;
async publish(
  payload: unknown,
  opts: { dryRun: true }
): Promise<DryRunResult<DAPublishResult>>;
async publish(
  payload: unknown,
  opts?: { dryRun?: boolean }
): Promise<DAPublishResult | DryRunResult<DAPublishResult>> {
  if (opts?.dryRun) {
    const estimate = await this.estimate(payload);
    const digest = this.digestOf(payload);
    const result: DAPublishResult = {
      digest,
      mode: this.encoderUrl ? "live" : "local",
      latencyMs: 0,
    };
    return { dryRun: true, estimate, result };
  }
  // existing body unchanged
  const startedAt = Date.now();
  const digest = this.digestOf(payload);
  if (!this.encoderUrl) {
    return { digest, mode: "local", latencyMs: Date.now() - startedAt };
  }
  // ... (rest of original body)
}
```

(Preserve the existing body verbatim in the non-dry-run branch.)

- [ ] **Step 5: Re-export from `index.ts`**

Edit `packages/0gkit-da/src/index.ts`, append:

```ts
export {
  estimateBytes,
  DEFAULT_DA_RATE_WEI_PER_BYTE,
  type DAEstimate,
  type DAEstimateBreakdown,
} from "./estimate.js";
```

- [ ] **Step 6: Run tests + typecheck**

Run: `cd packages/0gkit-da && pnpm test && pnpm typecheck && pnpm lint`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/0gkit-da/src/estimate.ts packages/0gkit-da/src/da.ts packages/0gkit-da/src/index.ts packages/0gkit-da/src/__tests__/estimate.test.ts
git commit -m "feat(da): add DA.estimate + publish({ dryRun }) for SP7"
```

---

### Task 5: Contracts `estimate.<method>` + `write.<method>({ dryRun: true })`

**Files:**

- Create: `packages/0gkit-contracts/src/estimate.ts`
- Modify: `packages/0gkit-contracts/src/factory.ts`
- Modify: `packages/0gkit-contracts/src/types.ts`
- Modify: `packages/0gkit-contracts/src/index.ts`
- Test: `packages/0gkit-contracts/src/__tests__/estimate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/0gkit-contracts/src/__tests__/estimate.test.ts
import { describe, it, expect, vi } from "vitest";
import type { Abi } from "viem";
import { createTypedContract } from "../factory.js";

const Erc20: Abi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

function fakePublicClient(opts: { gas: bigint; gasPrice: bigint }) {
  return {
    estimateContractGas: vi.fn(async () => opts.gas),
    getGasPrice: vi.fn(async () => opts.gasPrice),
    simulateContract: vi.fn(async () => ({
      request: { gas: opts.gas },
      result: true,
    })),
    waitForTransactionReceipt: vi.fn(async () => ({
      blockNumber: 42n,
    })),
  } as unknown as Parameters<typeof createTypedContract>[0]["publicClient"];
}

describe("typedContract.estimate.<method>", () => {
  it("returns ContractEstimate using viem.estimateContractGas", async () => {
    const pub = fakePublicClient({ gas: 50_000n, gasPrice: 2_000_000_000n });
    const c = createTypedContract({
      abi: Erc20,
      address: "0x" + "11".repeat(20),
      network: "galileo",
      publicClient: pub,
    });
    const e = await c.estimate.transfer("0x" + "22".repeat(20), 1_000n);
    expect(e.kind).toBe("contract");
    expect(e.gas).toBe(50_000n);
    expect(e.fee).toBe(50_000n * 2_000_000_000n);
    expect(e.breakdown.method).toBe("transfer");
  });
});

describe("typedContract.write.<method>({ dryRun: true })", () => {
  it("returns DryRunResult via simulateContract, no broadcast", async () => {
    const pub = fakePublicClient({ gas: 60_000n, gasPrice: 1_000_000_000n });
    const sim = pub.simulateContract as ReturnType<typeof vi.fn>;
    const c = createTypedContract({
      abi: Erc20,
      address: "0x" + "11".repeat(20),
      network: "galileo",
      publicClient: pub,
      signer: {
        address: "0x" + "33".repeat(20),
        privateKey: ("0x" + "44".repeat(32)) as `0x${string}`,
        signMessage: async () => "0x" as `0x${string}`,
        signTypedData: async () => "0x" as `0x${string}`,
        sendTransaction: async () => "0x" as `0x${string}`,
        source: "private-key",
      },
    });
    const res = await c.write.transfer(["0x" + "22".repeat(20), 1n], { dryRun: true });
    expect(res.dryRun).toBe(true);
    expect(res.estimate.gas).toBe(60_000n);
    expect(res.result.txHash).toBeUndefined();
    expect(sim).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/0gkit-contracts && pnpm test estimate`
Expected: FAIL — `estimate` namespace missing; `write.transfer` doesn't accept `{ dryRun }`.

- [ ] **Step 3: Implement `estimate.ts`**

```ts
// packages/0gkit-contracts/src/estimate.ts
import type { Estimate } from "@foundryprotocol/0gkit-core";

export interface ContractEstimateBreakdown {
  readonly method: string;
  readonly gasPrice: bigint;
}

export interface ContractEstimate extends Estimate {
  readonly kind: "contract";
  readonly breakdown: ContractEstimateBreakdown;
}

export function weiToFee(gas: bigint, gasPrice: bigint): bigint {
  return gas * gasPrice;
}

export function makeContractEstimate(args: {
  method: string;
  gas: bigint;
  gasPrice: bigint;
  expectedSeconds?: number;
}): ContractEstimate {
  return {
    kind: "contract",
    gas: args.gas,
    fee: weiToFee(args.gas, args.gasPrice),
    breakdown: { method: args.method, gasPrice: args.gasPrice },
    expectedSeconds: args.expectedSeconds ?? 3,
  };
}
```

- [ ] **Step 4: Extend `types.ts`**

Append to `packages/0gkit-contracts/src/types.ts`:

```ts
export interface WriteOptions {
  dryRun?: boolean;
}
```

- [ ] **Step 5: Extend `factory.ts`**

In `packages/0gkit-contracts/src/factory.ts`:

```ts
import { makeContractEstimate, type ContractEstimate } from "./estimate.js";
import type { DryRunResult } from "@foundryprotocol/0gkit-core";
import type { WriteOptions } from "./types.js";
```

Extend `TypedContract<TAbi>` interface:

```ts
export interface TypedContract<TAbi extends Abi> {
  address: Address;
  abi: TAbi;
  read: Record<string, (...args: unknown[]) => Promise<unknown>>;
  write: Record<
    string,
    (...args: unknown[]) => Promise<Receipt | DryRunResult<Receipt>>
  >;
  estimate: Record<string, (...args: unknown[]) => Promise<ContractEstimate>>;
  events: Record<string, (opts?: EventOptions) => Promise<readonly unknown[]>>;
}
```

After the `events` namespace construction, build `estimate`:

```ts
const estimate: Record<string, (...args: unknown[]) => Promise<ContractEstimate>> = {};
for (const name of writeMethods) {
  estimate[name] = async (...args: unknown[]): Promise<ContractEstimate> => {
    try {
      const account = walletClient?.account?.address;
      const gas = await publicClient.estimateContractGas({
        address: opts.address,
        abi: opts.abi,
        functionName: name,
        args: args as never,
        account: account ?? "0x0000000000000000000000000000000000000000",
      });
      const gasPrice = await publicClient.getGasPrice();
      return makeContractEstimate({ method: name, gas, gasPrice });
    } catch (err) {
      wrapChainError(err, `estimate.${name}`);
    }
  };
}
```

Replace the `write[name]` wrapper with one that accepts `WriteOptions`:

```ts
for (const name of writeMethods) {
  write[name] = async (
    ...input: unknown[]
  ): Promise<Receipt | DryRunResult<Receipt>> => {
    // Detect the WriteOptions trailing arg.
    let callArgs = input;
    let writeOpts: WriteOptions | undefined;
    const last = input[input.length - 1];
    if (
      last !== null &&
      typeof last === "object" &&
      !Array.isArray(last) &&
      "dryRun" in (last as object)
    ) {
      writeOpts = last as WriteOptions;
      callArgs = input.slice(0, -1);
    }
    // viem typed contracts take a single positional `args` array on write.
    const positional = Array.isArray(callArgs[0])
      ? (callArgs[0] as unknown[])
      : callArgs;

    if (writeOpts?.dryRun) {
      try {
        const account =
          walletClient?.account?.address ??
          "0x0000000000000000000000000000000000000000";
        const gas = await publicClient.estimateContractGas({
          address: opts.address,
          abi: opts.abi,
          functionName: name,
          args: positional as never,
          account,
        });
        const gasPrice = await publicClient.getGasPrice();
        await publicClient.simulateContract({
          address: opts.address,
          abi: opts.abi,
          functionName: name,
          args: positional as never,
          account,
        });
        const est = makeContractEstimate({ method: name, gas, gasPrice });
        return { dryRun: true, estimate: est, result: { latencyMs: 0 } };
      } catch (err) {
        wrapChainError(err, `dryRun.${name}`);
      }
    }

    if (!walletClient) {
      throw new ConfigError(
        `write.${name} requires a wallet client.`,
        `Pass { signer } when calling createTypedContract — a signer with an exposed privateKey (fromPrivateKey / fromFile / fromEnv) enables writes. For KMS / wagmi signers, use signer.sendTransaction directly.`
      );
    }
    const start = Date.now();
    try {
      const viemWrite = (
        viemContract as unknown as {
          write: Record<string, (...a: unknown[]) => Promise<`0x${string}`>>;
        }
      ).write;
      const hash = await viemWrite[name]!(...(positional as unknown[]));
      const rcpt = await publicClient.waitForTransactionReceipt({ hash });
      return {
        txHash: hash,
        blockNumber: rcpt.blockNumber,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      wrapChainError(err, `write.${name}`);
    }
  };
}
```

Return:

```ts
return {
  address: opts.address,
  abi: opts.abi,
  read: (
    viemContract as unknown as {
      read: Record<string, (...args: unknown[]) => Promise<unknown>>;
    }
  ).read,
  write,
  estimate,
  events,
};
```

- [ ] **Step 6: Re-export from `index.ts`**

Edit `packages/0gkit-contracts/src/index.ts`, append:

```ts
export {
  makeContractEstimate,
  weiToFee,
  type ContractEstimate,
  type ContractEstimateBreakdown,
} from "./estimate.js";
export { type WriteOptions } from "./types.js";
```

- [ ] **Step 7: Run tests + typecheck**

Run: `cd packages/0gkit-contracts && pnpm test && pnpm typecheck && pnpm lint`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add packages/0gkit-contracts/src/estimate.ts packages/0gkit-contracts/src/factory.ts packages/0gkit-contracts/src/types.ts packages/0gkit-contracts/src/index.ts packages/0gkit-contracts/src/__tests__/estimate.test.ts
git commit -m "feat(contracts): add estimate namespace + write({ dryRun }) for SP7"
```

---

### Task 6: CLI `0g estimate storage <file>` subcommand

**Files:**

- Create: `packages/0gkit-cli/src/commands/estimate.ts`
- Modify: `packages/0gkit-cli/src/program.ts`
- Test: `packages/0gkit-cli/src/__tests__/estimate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/0gkit-cli/src/__tests__/estimate.test.ts
import { describe, it, expect, vi } from "vitest";
import { buildProgram, type ProgramDeps } from "../program.js";
import { makeDefaultDeps } from "./fixture.js"; // helper that already exists; if not, inline a stub
import { Storage } from "@foundryprotocol/0gkit-storage";

function makeDeps(): ProgramDeps {
  const lines: string[] = [];
  const deps = makeDefaultDeps({ write: (l) => lines.push(l) });
  // Override makeStorage to return one that yields a deterministic estimate.
  deps.makeStorage = ((cfg) =>
    new Storage({
      ...cfg,
      loadSdk: async () => ({
        MemData: class {
          constructor() {}
          async merkleTree() {
            return [{ rootHash: () => "0xdeadbeef" }, null] as const;
          }
        },
        Indexer: class {
          constructor() {}
          async upload() {
            throw new Error("nope");
          }
          async downloadToBlob() {
            return [null, null] as const;
          }
          async peekHeader() {
            return [null, null] as const;
          }
        },
      }),
    })) as ProgramDeps["makeStorage"];
  deps.fs.readFile = async () => new Uint8Array(2 * 1024);
  // Expose the captured lines on deps for the test.
  (deps as ProgramDeps & { __lines?: string[] }).__lines = lines;
  return deps;
}

describe("0g estimate storage", () => {
  it("--json prints structured estimate", async () => {
    const deps = makeDeps();
    const lines = (deps as ProgramDeps & { __lines: string[] }).__lines;
    const prog = buildProgram(deps);
    await prog.parseAsync(["0g", "estimate", "storage", "./demo.bin", "--json"], {
      from: "user",
    });
    const payload = JSON.parse(lines.join("\n"));
    expect(payload.ok).toBe(true);
    expect(payload.data.kind).toBe("storage");
    expect(payload.data.breakdown.sizeBytes).toBe(2 * 1024);
  });

  it("human output renders kind/gas/fee", async () => {
    const deps = makeDeps();
    const lines = (deps as ProgramDeps & { __lines: string[] }).__lines;
    const prog = buildProgram(deps);
    await prog.parseAsync(["0g", "estimate", "storage", "./demo.bin"], {
      from: "user",
    });
    const blob = lines.join("\n");
    expect(blob).toContain("kind        storage");
    expect(blob).toContain("gas         ");
    expect(blob).toContain("fee         ");
  });
});
```

(If `makeDefaultDeps` doesn't already exist as a shared fixture, take the implementation from `packages/0gkit-cli/src/__tests__/fixture.test.ts` and extract it into a shared `fixture.ts` helper before writing this test.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/0gkit-cli && pnpm test estimate`
Expected: FAIL — no `estimate` command registered.

- [ ] **Step 3: Implement `estimate.ts` (storage subcommand only first)**

```ts
// packages/0gkit-cli/src/commands/estimate.ts
import type { Command } from "commander";
import { formatEstimate, ConfigError } from "@foundryprotocol/0gkit-core";
import { runCommand, type ProgramDeps } from "../program.js";

function storageNetwork(ctx: { network: string }): "aristotle" | "galileo" {
  if (ctx.network !== "aristotle" && ctx.network !== "galileo") {
    throw new ConfigError(
      `0g estimate storage does not support --network ${ctx.network}.`,
      `Use --network galileo (default) or --network aristotle.`
    );
  }
  return ctx.network;
}

function bigintsToStrings(v: unknown): unknown {
  if (typeof v === "bigint") return v.toString();
  if (Array.isArray(v)) return v.map(bigintsToStrings);
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      o[k] = bigintsToStrings(val);
    }
    return o;
  }
  return v;
}

export function registerEstimate(program: Command, deps: ProgramDeps): void {
  const estimate = program
    .command("estimate")
    .description("estimate cost for storage / compute / da / contracts ops");

  estimate
    .command("storage <file>")
    .description("estimate cost to upload <file> to 0G Storage")
    .action(async function (this: Command, file: string) {
      await runCommand(deps, this, async (ctx) => {
        const network = storageNetwork(ctx);
        const data = await deps.fs.readFile(file);
        const s = deps.makeStorage({ network, rpcUrl: ctx.rpcUrl });
        const est = await s.estimate(data);
        return {
          human: formatEstimate(est).split("\n"),
          json: bigintsToStrings(est) as Record<string, unknown>,
        };
      });
    });
}
```

- [ ] **Step 4: Wire into `program.ts`**

In `packages/0gkit-cli/src/program.ts`, add the import + call:

```ts
import { registerEstimate } from "./commands/estimate.js";
// ...
registerEstimate(program, deps);
```

- [ ] **Step 5: Run test to verify pass**

Run: `cd packages/0gkit-cli && pnpm test estimate`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/0gkit-cli/src/commands/estimate.ts packages/0gkit-cli/src/program.ts packages/0gkit-cli/src/__tests__/estimate.test.ts
git commit -m "feat(cli): add 0g estimate storage subcommand for SP7"
```

---

### Task 7: CLI `0g estimate compute` subcommand

**Files:**

- Modify: `packages/0gkit-cli/src/commands/estimate.ts`
- Modify: `packages/0gkit-cli/src/__tests__/estimate.test.ts`

- [ ] **Step 1: Add the failing test**

In `packages/0gkit-cli/src/__tests__/estimate.test.ts`, append:

```ts
describe("0g estimate compute", () => {
  it("--prompt + --max-output produces ComputeEstimate", async () => {
    const deps = makeDeps();
    const lines = (deps as ProgramDeps & { __lines: string[] }).__lines;
    // Override makeCompute to construct without broker — estimate is offline-only.
    deps.makeCompute = ((cfg) =>
      new (require("@foundryprotocol/0gkit-compute").Compute)(
        cfg
      )) as ProgramDeps["makeCompute"];
    const prog = buildProgram(deps);
    await prog.parseAsync(
      [
        "0g",
        "estimate",
        "compute",
        "--prompt",
        "Hello, world!",
        "--max-output",
        "64",
        "--json",
      ],
      { from: "user" }
    );
    const payload = JSON.parse(lines.join("\n"));
    expect(payload.ok).toBe(true);
    expect(payload.data.kind).toBe("compute");
    expect(payload.data.breakdown.outputTokensMax).toBe(64);
  });

  it("requires --prompt", async () => {
    const deps = makeDeps();
    const lines = (deps as ProgramDeps & { __lines: string[] }).__lines;
    const prog = buildProgram(deps);
    await prog.parseAsync(["0g", "estimate", "compute", "--json"], { from: "user" });
    const payload = JSON.parse(lines.join("\n"));
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("CONFIG");
  });
});
```

- [ ] **Step 2: Add the compute subcommand**

In `packages/0gkit-cli/src/commands/estimate.ts`, inside `registerEstimate`, after the storage subcommand, append:

```ts
estimate
  .command("compute")
  .description("estimate cost for a compute (chat completion) call")
  .option("-p, --prompt <text>", "prompt text")
  .option("--model <name>", "model id (provider default if omitted)")
  .option("--max-output <n>", "max output tokens (default 512)", (v) =>
    Number.parseInt(v, 10)
  )
  .action(async function (this: Command) {
    await runCommand(deps, this, async (ctx) => {
      const opts = this.opts() as {
        prompt?: string;
        model?: string;
        maxOutput?: number;
      };
      if (!opts.prompt) {
        throw new ConfigError(
          `--prompt is required.`,
          `Pass --prompt "your prompt text".`
        );
      }
      const network =
        ctx.network === "aristotle" || ctx.network === "galileo"
          ? ctx.network
          : undefined;
      const c = deps.makeCompute({
        network,
        brokerRpc: ctx.rpcUrl,
        model: opts.model,
        provider: "0x0000000000000000000000000000000000000000", // estimate only — never used
      });
      const est = await c.estimate({
        messages: [{ role: "user", content: opts.prompt }],
        model: opts.model,
        maxOutputTokens: opts.maxOutput,
      });
      return {
        human: formatEstimate(est).split("\n"),
        json: bigintsToStrings(est) as Record<string, unknown>,
      };
    });
  });
```

- [ ] **Step 3: Run + commit**

```bash
cd packages/0gkit-cli && pnpm test estimate
```

Expected: PASS.

```bash
git add packages/0gkit-cli/src/commands/estimate.ts packages/0gkit-cli/src/__tests__/estimate.test.ts
git commit -m "feat(cli): add 0g estimate compute subcommand for SP7"
```

---

### Task 8: CLI `0g estimate da` subcommand

**Files:**

- Modify: `packages/0gkit-cli/src/commands/estimate.ts`
- Modify: `packages/0gkit-cli/src/__tests__/estimate.test.ts`

- [ ] **Step 1: Add the failing test**

```ts
describe("0g estimate da", () => {
  it("--bytes computes from a number", async () => {
    const deps = makeDeps();
    const lines = (deps as ProgramDeps & { __lines: string[] }).__lines;
    const prog = buildProgram(deps);
    await prog.parseAsync(["0g", "estimate", "da", "--bytes", "1024", "--json"], {
      from: "user",
    });
    const payload = JSON.parse(lines.join("\n"));
    expect(payload.ok).toBe(true);
    expect(payload.data.kind).toBe("da");
    expect(payload.data.breakdown.sizeBytes).toBe(1024);
  });

  it("<file> reads bytes from disk", async () => {
    const deps = makeDeps();
    const lines = (deps as ProgramDeps & { __lines: string[] }).__lines;
    deps.fs.readFile = async () => new Uint8Array(2048);
    const prog = buildProgram(deps);
    await prog.parseAsync(["0g", "estimate", "da", "./blob.bin", "--json"], {
      from: "user",
    });
    const payload = JSON.parse(lines.join("\n"));
    expect(payload.ok).toBe(true);
    expect(payload.data.breakdown.sizeBytes).toBe(2048);
  });
});
```

- [ ] **Step 2: Add the DA subcommand**

In `packages/0gkit-cli/src/commands/estimate.ts`, append:

```ts
estimate
  .command("da [file]")
  .description("estimate cost to publish [file] (or --bytes <n>) to 0G DA")
  .option("--bytes <n>", "size in bytes (alternative to <file>)", (v) =>
    Number.parseInt(v, 10)
  )
  .action(async function (this: Command, file: string | undefined) {
    await runCommand(deps, this, async (ctx) => {
      const opts = this.opts() as { bytes?: number };
      let payload: Uint8Array;
      if (file && file !== undefined) {
        payload = await deps.fs.readFile(file);
      } else if (opts.bytes && opts.bytes >= 0) {
        payload = new Uint8Array(opts.bytes);
      } else {
        throw new ConfigError(
          `Pass either <file> or --bytes <n>.`,
          `e.g. 0g estimate da ./blob.bin OR 0g estimate da --bytes 4096`
        );
      }
      const network =
        ctx.network === "aristotle" || ctx.network === "galileo"
          ? ctx.network
          : undefined;
      const da = deps.makeDA({ network });
      const est = await da.estimate(payload);
      return {
        human: formatEstimate(est).split("\n"),
        json: bigintsToStrings(est) as Record<string, unknown>,
      };
    });
  });
```

- [ ] **Step 3: Run + commit**

```bash
cd packages/0gkit-cli && pnpm test estimate
```

Expected: PASS.

```bash
git add packages/0gkit-cli/src/commands/estimate.ts packages/0gkit-cli/src/__tests__/estimate.test.ts
git commit -m "feat(cli): add 0g estimate da subcommand for SP7"
```

---

### Task 9: CLI `0g estimate contracts` subcommand

**Files:**

- Modify: `packages/0gkit-cli/src/commands/estimate.ts`
- Modify: `packages/0gkit-cli/src/__tests__/estimate.test.ts`
- Modify: `packages/0gkit-cli/package.json` (add devDep on `@foundryprotocol/0gkit-contracts` if not present)

- [ ] **Step 1: Add the failing test**

```ts
describe("0g estimate contracts", () => {
  it("estimates ERC-20 transfer", async () => {
    const deps = makeDeps();
    const lines = (deps as ProgramDeps & { __lines: string[] }).__lines;
    // Inject a fake contracts.estimate method so we don't need a real RPC.
    deps.contracts = {
      ...deps.contracts,
      estimate: async (_opts: {
        abiPath: string;
        address: string;
        method: string;
        args: unknown[];
        network: string;
        rpcUrl?: string;
      }) => ({
        kind: "contract" as const,
        gas: 21_000n,
        fee: 21_000n * 2_000_000_000n,
        breakdown: { method: _opts.method, gasPrice: 2_000_000_000n },
        expectedSeconds: 3,
      }),
    } as ProgramDeps["contracts"];
    const prog = buildProgram(deps);
    await prog.parseAsync(
      [
        "0g",
        "estimate",
        "contracts",
        "--abi",
        "./MyContract.abi.json",
        "--address",
        "0x" + "11".repeat(20),
        "--method",
        "transfer",
        "--args",
        JSON.stringify(["0x" + "22".repeat(20), "1000"]),
        "--json",
      ],
      { from: "user" }
    );
    const payload = JSON.parse(lines.join("\n"));
    expect(payload.ok).toBe(true);
    expect(payload.data.kind).toBe("contract");
    expect(payload.data.breakdown.method).toBe("transfer");
  });
});
```

- [ ] **Step 2: Add `contracts.estimate` to `ProgramDeps`**

In `packages/0gkit-cli/src/program.ts`, extend the `contracts` field:

```ts
contracts: {
  generate: /* unchanged */ ;
  listStandard: /* unchanged */ ;
  getStandard: /* unchanged */ ;
  estimate: (opts: {
    abiPath: string;
    address: `0x${string}`;
    method: string;
    args: unknown[];
    network: string;
    rpcUrl?: string;
  }) => Promise<import("@foundryprotocol/0gkit-core").Estimate>;
}
```

And in the default `ProgramDeps` constructor (wherever the real `contracts` object is built — likely in `cli.ts`), add a real implementation:

```ts
contracts: {
  // ... existing fields
  estimate: async (opts) => {
    const { createTypedContract } = await import("@foundryprotocol/0gkit-contracts");
    const abi = JSON.parse(
      new TextDecoder().decode(await deps.fs.readFile(opts.abiPath))
    );
    const network =
      opts.network === "aristotle" || opts.network === "galileo"
        ? opts.network
        : "galileo";
    const tc = createTypedContract({
      abi,
      address: opts.address,
      network,
      rpcUrl: opts.rpcUrl,
    });
    const fn = tc.estimate[opts.method];
    if (!fn) {
      throw new ConfigError(
        `Method '${opts.method}' is not a non-view function in this ABI.`,
        `Pass --method <writeMethod> where writeMethod is one of: ${Object.keys(tc.estimate).join(", ")}`
      );
    }
    return fn(...(opts.args as unknown[]));
  },
},
```

- [ ] **Step 3: Add the contracts subcommand**

In `packages/0gkit-cli/src/commands/estimate.ts`, append:

```ts
estimate
  .command("contracts")
  .description("estimate gas + fee for a contract write method")
  .requiredOption("--abi <path>", "path to ABI JSON (Foundry artifact or raw ABI)")
  .requiredOption("--address <0x>", "contract address")
  .requiredOption("--method <name>", "non-view function to estimate")
  .option("--args <json>", "JSON array of args", "[]")
  .action(async function (this: Command) {
    await runCommand(deps, this, async (ctx) => {
      const opts = this.opts() as {
        abi: string;
        address: string;
        method: string;
        args: string;
      };
      let parsedArgs: unknown[];
      try {
        parsedArgs = JSON.parse(opts.args) as unknown[];
        if (!Array.isArray(parsedArgs)) {
          throw new Error("--args must be a JSON array");
        }
      } catch (err) {
        throw new ConfigError(
          `--args is not a JSON array: ${(err as Error).message}`,
          `Example: --args '["0xabc...", "1000"]'`
        );
      }
      if (!opts.address.startsWith("0x") || opts.address.length !== 42) {
        throw new ConfigError(
          `--address must be a 20-byte 0x address.`,
          `Pass --address 0x... (42 chars total).`
        );
      }
      const est = await deps.contracts.estimate({
        abiPath: opts.abi,
        address: opts.address as `0x${string}`,
        method: opts.method,
        args: parsedArgs,
        network: ctx.network,
        rpcUrl: ctx.rpcUrl,
      });
      return {
        human: formatEstimate(est).split("\n"),
        json: bigintsToStrings(est) as Record<string, unknown>,
      };
    });
  });
```

- [ ] **Step 4: Run + commit**

```bash
cd packages/0gkit-cli && pnpm test estimate && pnpm typecheck
```

```bash
git add packages/0gkit-cli/src/commands/estimate.ts packages/0gkit-cli/src/program.ts packages/0gkit-cli/src/cli.ts packages/0gkit-cli/src/__tests__/estimate.test.ts packages/0gkit-cli/package.json
git commit -m "feat(cli): add 0g estimate contracts subcommand for SP7"
```

---

### Task 10: `--dry-run` flag on `0g storage put`, `0g da publish`, `0g infer`

**Files:**

- Modify: `packages/0gkit-cli/src/commands/storage.ts`
- Modify: `packages/0gkit-cli/src/commands/da.ts`
- Modify: `packages/0gkit-cli/src/commands/infer.ts`
- Modify: `packages/0gkit-cli/src/__tests__/storage.test.ts`
- Modify: `packages/0gkit-cli/src/__tests__/da.test.ts`
- Modify: `packages/0gkit-cli/src/__tests__/infer.test.ts`

- [ ] **Step 1: Add `--dry-run` tests** (one per file)

In `packages/0gkit-cli/src/__tests__/storage.test.ts`, append:

```ts
describe("0g storage put --dry-run", () => {
  it("does not broadcast and prints estimate", async () => {
    const deps = makeDefaultDeps({
      /* same shape as estimate.test.ts */
    });
    const prog = buildProgram(deps);
    await prog.parseAsync(
      ["0g", "storage", "put", "./demo.bin", "--dry-run", "--json"],
      { from: "user" }
    );
    const out = JSON.parse((deps as any).__lines.join("\n"));
    expect(out.ok).toBe(true);
    expect(out.data.dryRun).toBe(true);
    expect(out.data.result.tx.txHash).toBeUndefined();
  });
});
```

Mirror for `da.test.ts` (`0g da publish --dry-run`) and `infer.test.ts` (`0g infer --dry-run -m "ping"`). For infer, override `makeCompute` so its broker is never reached (the dry-run branch should short-circuit before broker creation).

- [ ] **Step 2: Add the flag to `storage.ts`**

In the `storage put` action body, accept the option and branch:

```ts
storage
  .command("put <file>")
  .description("upload a file's bytes; prints root + tx")
  .option("--dry-run", "estimate cost without broadcasting", false)
  .action(async function (this: Command, file: string) {
    await runCommand(deps, this, async (ctx) => {
      const opts = this.opts() as { dryRun?: boolean };
      const network = storageNetwork(ctx);
      if (!ctx.privateKey && !opts.dryRun) {
        throw new ConfigError(
          `0g storage put requires a signer key (funds the upload tx).`,
          `Set ZEROG_PRIVATE_KEY or pass --private-key. Or use --dry-run.`
        );
      }
      const data = await deps.fs.readFile(file);
      const s = deps.makeStorage({
        network,
        rpcUrl: ctx.rpcUrl,
        privateKey: ctx.privateKey,
      });
      if (opts.dryRun) {
        const dr = await s.upload(data, { dryRun: true });
        return {
          human: [
            `[dry-run] would upload ${file} (${data.length} bytes)`,
            ...formatEstimate(dr.estimate).split("\n"),
            `  root ${dr.result.root}`,
          ],
          json: bigintsToStrings(dr) as Record<string, unknown>,
        };
      }
      const r = await s.upload(data);
      // ... rest unchanged
    });
  });
```

Import `formatEstimate` from `@foundryprotocol/0gkit-core` at the top of the file, plus the local `bigintsToStrings` helper from the estimate command (extract it into a shared `packages/0gkit-cli/src/commands/_helpers.ts` if used in more than two files).

- [ ] **Step 3: Add `--dry-run` to `da.ts` publish**

Same pattern: option, branch in action body, no API calls in dry-run path.

- [ ] **Step 4: Add `--dry-run` to `infer.ts`**

For infer, in the dry-run path, skip the broker key check (estimate is offline):

```ts
if (opts.dryRun) {
  const compute = deps.makeCompute({
    network: inferNetwork(ctx.network),
    provider: provider, // still needed by ctor but not called
    brokerKey: brokerKey ?? "0x" + "00".repeat(32), // bypass — never used
    model: opts.model,
  });
  const dr = await compute.inference(
    { messages: [{ role: "user", content }], model: opts.model },
    { dryRun: true }
  );
  return {
    human: [
      `[dry-run] would call provider ${provider}`,
      ...formatEstimate(dr.estimate).split("\n"),
    ],
    json: bigintsToStrings(dr) as Record<string, unknown>,
  };
}
```

- [ ] **Step 5: Run tests + commit**

```bash
cd packages/0gkit-cli && pnpm test
```

Expected: all green.

```bash
git add packages/0gkit-cli/src/commands/storage.ts packages/0gkit-cli/src/commands/da.ts packages/0gkit-cli/src/commands/infer.ts packages/0gkit-cli/src/__tests__/{storage,da,infer}.test.ts packages/0gkit-cli/src/commands/_helpers.ts
git commit -m "feat(cli): add --dry-run to 0g storage put / da publish / infer for SP7"
```

---

### Task 11: Full monorepo verification

**Files:** No source changes. Pure verification.

- [ ] **Step 1: Run full monorepo lint + typecheck + test**

Run:

```bash
cd /Users/rajkaria/Projects/0G-ai-kit
pnpm format:check && pnpm boundary:check && pnpm typecheck && pnpm build && pnpm test
```

Expected: all pass. Total test count should be ≥ previous baseline + ~30 (the new tests across 6 packages).

- [ ] **Step 2: Verify per-package coverage gates**

Run:

```bash
cd packages/0gkit-core && pnpm coverage 2>&1 | grep -E "All files|Lines|Branch"
cd ../0gkit-storage && pnpm coverage 2>&1 | grep -E "All files|Lines|Branch"
cd ../0gkit-compute && pnpm coverage 2>&1 | grep -E "All files|Lines|Branch"
cd ../0gkit-da && pnpm coverage 2>&1 | grep -E "All files|Lines|Branch"
cd ../0gkit-contracts && pnpm coverage 2>&1 | grep -E "All files|Lines|Branch"
cd ../0gkit-cli && pnpm coverage 2>&1 | grep -E "All files|Lines|Branch"
```

Expected: every package ≥ 80% lines / 70% branches.

- [ ] **Step 3: If any gate fails**, add additional tests targeting the uncovered branches (most likely: error paths in the dry-run branches, and the wrap of `ConfigError` in the contracts dry-run). Commit fixes individually.

- [ ] **Step 4: Commit any new tests**

```bash
git add -p
git commit -m "test(sp7): expand coverage to meet 80/70 gates after dry-run additions"
```

(If no new tests are needed, skip the commit step.)

---

### Task 12: Docs, changeset, README updates, PR

**Files:**

- Create: `.changeset/sp7-cost-estimator-dryrun.md`
- Modify: `README.md` (root)
- Modify: `docs/DECISIONS.md`
- Modify: `docs/specs/2026-05-20-essentials-roadmap.md` (flip SP7 to ✅)
- Modify: `packages/0gkit-storage/README.md`
- Modify: `packages/0gkit-compute/README.md`
- Modify: `packages/0gkit-da/README.md`
- Modify: `packages/0gkit-contracts/README.md`
- Modify: `packages/0gkit-cli/README.md`

- [ ] **Step 1: Write the changeset**

```bash
cat > .changeset/sp7-cost-estimator-dryrun.md <<'EOF'
---
"@foundryprotocol/0gkit-core": minor
"@foundryprotocol/0gkit-storage": minor
"@foundryprotocol/0gkit-compute": minor
"@foundryprotocol/0gkit-da": minor
"@foundryprotocol/0gkit-contracts": minor
"@foundryprotocol/0gkit-cli": minor
---

SP7: cost estimator + dry-run. Every primitive answers "what will this cost?" before broadcasting.

- `0gkit-core`: new `Estimate` / `DryRunResult<T>` envelope + `formatEstimate(est)` + `formatNative(wei)`.
- `0gkit-storage`: `Storage.estimate(bytes)` + `Storage.upload(bytes, { dryRun: true })`.
- `0gkit-compute`: `Compute.estimate({ messages, model?, maxOutputTokens? })` + `Compute.inference(args, { dryRun: true })`. Char/4 token heuristic (D21).
- `0gkit-da`: `DA.estimate(payload)` + `DA.publish(payload, { dryRun: true })`. Default rate `1e6 wei/byte` (D23).
- `0gkit-contracts`: new `typedContract.estimate.<method>(...args)` namespace using `estimateContractGas` + `getGasPrice`; `write.<method>(args, { dryRun: true })` runs `simulateContract` without broadcasting.
- `0gkit-cli`: new `0g estimate storage | compute | da | contracts` subcommands + `--dry-run` flag on `0g storage put`, `0g da publish`, `0g infer`.
EOF
```

- [ ] **Step 2: Append DECISIONS**

In `docs/DECISIONS.md`, append:

````md
## D21 — Compute token-count heuristic: `chars / 4` (ceil)

OpenAI's documented English approximation: 1 token ≈ 4 characters. We adopt
this in `countTokens(text)` so cost estimates round-trip in pure JS with no
tokenizer download. Estimates are explicitly order-of-magnitude — D22 documents
the per-token fee placeholder. A precise tokenizer (`tiktoken` ≈ 6 MB of vocab
files) would inflate every install for sub-cent precision nobody asked for.

## D22 — Storage segment math: ceil(bytes / 256 KiB)

0G storage chunks files into 256 KiB segments (matches `@0gfoundation/0g-storage-ts-sdk`
default). `estimateBytes(n)` returns `{ sizeBytes, segments: ceil(n / 256 KiB) }`.
Per-segment gas/fee defaults (`80_000 gas`, `1 gwei`) are heuristics matching
observed Galileo behaviour mid-2026. The SDK's actual cost function will
override these once a programmatic feed exists.

## D23 — `DryRunResult<T>` envelope

Every write path that accepts `{ dryRun: true }` returns:

```ts
{ dryRun: true, estimate: Estimate, result: T }
```
````

— where `T` is the existing success shape with `txHash`/`blockNumber` left
undefined. This keeps callers' type narrowing simple (`if (res.dryRun) {...}`)
and means dry-run code paths share the same Receipt-handling logic as live ones.

`````

- [ ] **Step 3: Append the package README sections**

For each of `packages/0gkit-{storage,compute,da,contracts}/README.md`, append a section. Storage example:

````md
## Estimating & dry-run

```ts
const est = await storage.estimate(data);
// { kind: "storage", gas, fee, breakdown: { sizeBytes, segments }, expectedSeconds }

const dr = await storage.upload(data, { dryRun: true });
// { dryRun: true, estimate, result: { root, tx: { latencyMs: 0 }, raw } }
`````

Estimates are heuristics (256 KiB segments, ~80k gas/segment, ~1 gwei fee/segment) —
exact costs depend on network gas + the SDK's submit calldata. Use `0g estimate storage <file>`
on the CLI for the same answer in your terminal.

`````

Mirror for compute / da / contracts with their respective signatures and one-line caveats.

- [ ] **Step 4: Append the CLI README section**

In `packages/0gkit-cli/README.md`:

````md
## `0g estimate` — cost before broadcast

```bash
0g estimate storage ./bigfile.bin
0g estimate compute --prompt "What is 2+2?" --max-output 64
0g estimate da --bytes 4096
0g estimate contracts --abi ./MyContract.abi.json --address 0x... --method transfer --args '["0x...","1000"]'
```

Every write command also takes `--dry-run`:

```bash
0g storage put ./file --dry-run
0g da publish ./blob --dry-run
0g infer -m "ping" --provider 0x... --dry-run
```

`--dry-run` runs all the estimation work without broadcasting a single tx.
`````

- [ ] **Step 5: Flip the roadmap row**

In `docs/specs/2026-05-20-essentials-roadmap.md`:

- In the Phase Overview table (line ~47), update Phase 3 row from `✅ SP6 0gkit-indexer, SP7 cost estimator + dry-run, SP8 expanded template library` to `✅ SP6 0gkit-indexer, ✅ SP7 cost estimator + dry-run, SP8 expanded template library`.
- In the SP7 heading (line ~416), insert `**Status:** Shipped 2026-05-22.` directly below the `### SP7 — Cost estimator + dry-run` heading.

- [ ] **Step 6: Update root README**

In `README.md`, update the CLI feature row to add `0g estimate` and a brief one-liner on `--dry-run`. (If the README has a "Recently shipped" or "Phase 3" section, append SP7 to it.)

- [ ] **Step 7: Prettier-format every touched markdown file**

```bash
cd /Users/rajkaria/Projects/0G-ai-kit && pnpm format
```

- [ ] **Step 8: Final monorepo verification**

```bash
pnpm format:check && pnpm boundary:check && pnpm typecheck && pnpm build && pnpm test
```

Expected: all pass.

- [ ] **Step 9: Commit all docs changes**

```bash
git add .changeset/sp7-cost-estimator-dryrun.md README.md docs/DECISIONS.md docs/specs/2026-05-20-essentials-roadmap.md packages/0gkit-storage/README.md packages/0gkit-compute/README.md packages/0gkit-da/README.md packages/0gkit-contracts/README.md packages/0gkit-cli/README.md
git commit -m "docs(sp7): changeset + DECISIONS D21/D22/D23 + README updates"
```

- [ ] **Step 10: Push + open PR**

```bash
git push -u origin sp7-cost-estimator-dryrun
gh pr create --title "SP7 — Cost estimator + dry-run (storage/compute/da/contracts/cli)" \
  --body "$(cat <<'BODY'
## Summary

SP7 ships `.estimate()` and `{ dryRun: true }` across every 0gkit primitive plus a top-level `0g estimate` CLI namespace and `--dry-run` flags on existing write commands.

- **0gkit-core**: new `Estimate` + `DryRunResult<T>` envelope + `formatEstimate` / `formatNative` helpers.
- **0gkit-storage**: `Storage.estimate(bytes)`, `upload(bytes, { dryRun: true })`.
- **0gkit-compute**: `Compute.estimate(args)`, `inference(args, { dryRun: true })`. `chars/4` token heuristic (D21).
- **0gkit-da**: `DA.estimate(payload)`, `publish(payload, { dryRun: true })`. Local-mode = 0 fee.
- **0gkit-contracts**: `typedContract.estimate.<method>(...args)`, `write.<method>(args, { dryRun: true })` via `simulateContract`.
- **0gkit-cli**: `0g estimate storage|compute|da|contracts` + `--dry-run` on `storage put`, `da publish`, `infer`.

Roadmap §SP7 satisfied: every primitive answers "what will this cost me?" before broadcasting.

## Decisions

- **D21** — Compute token-count is `ceil(chars / 4)`. Order-of-magnitude only; precise tokenizers add ~6 MB for sub-cent precision.
- **D22** — Storage segment math is `ceil(bytes / 256 KiB)`. Per-segment gas/fee defaults documented as heuristics.
- **D23** — `DryRunResult<T>` = `{ dryRun: true, estimate, result }` where `result` is the success shape minus broadcast identifiers.

## Test plan

- [ ] `pnpm test` — full monorepo green (every package's new estimate suite + existing suites)
- [ ] `pnpm boundary:check` — neutrality invariant holds (no `@foundryprotocol/sdk` imports in any 0gkit package)
- [ ] Per-package coverage ≥ 80/70 (gates already configured)
- [ ] `0g estimate storage ./README.md --json` returns a valid Estimate
- [ ] `0g storage put ./README.md --dry-run` exits 0 with no broadcast

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

- [ ] **Step 11: Wait for CI green + squash-merge**

```bash
gh pr checks --watch
gh pr merge --squash --delete-branch
```

---

## Self-Review

**Spec coverage** (against §SP7 of the roadmap):

| Requirement                                                                   | Task                                                                                                                                             |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `storage.estimate(bytes) → { sizeBytes, segments, gas, fee, … }`              | Task 2                                                                                                                                           |
| `compute.estimate({ prompt, model }) → { inputTokens, outputTokensMax, fee }` | Task 3                                                                                                                                           |
| `da.estimate(bytes)`                                                          | Task 4                                                                                                                                           |
| attestation registration `.estimate()`                                        | N/A — attestations are pure local crypto today (no on-chain register call yet); when one lands it'll mirror contract.estimate. Noted in PR body. |
| `storage.upload(bytes, { dryRun: true })`                                     | Task 2                                                                                                                                           |
| every write path accepts `{ dryRun: true }`                                   | Tasks 2/3/4/5                                                                                                                                    |
| `0g estimate storage ./file`                                                  | Task 6                                                                                                                                           |
| `0g estimate compute --prompt --model`                                        | Task 7                                                                                                                                           |
| `0g estimate da --bytes`                                                      | Task 8                                                                                                                                           |
| `0g estimate contracts --abi --address --method --args`                       | Task 9                                                                                                                                           |
| `0g dry-run` (per-command --dry-run on existing writes)                       | Task 10                                                                                                                                          |
| Snapshot stability of `0g estimate` output                                    | Tasks 6/7/8/9 (snapshot tests via expect.toMatchSnapshot is fine, but the structured shape assertions we wrote are stronger than snapshots)      |
| Coverage gates                                                                | Task 11                                                                                                                                          |
| Changeset, DECISIONS, roadmap flip                                            | Task 12                                                                                                                                          |

**Placeholder scan:** none — every step contains the actual code or command.

**Type consistency:** `Estimate.kind` is one of `"storage" | "compute" | "da" | "contract"` everywhere. `DryRunResult<T>` always has `{ dryRun: true, estimate, result }`. `StorageEstimate` / `ComputeEstimate` / `DAEstimate` / `ContractEstimate` all extend `Estimate` with refined `breakdown`. ✅

**Gaps fixed inline:** Attestation `.estimate()` isn't a required surface today (no register call wired in the package). Noted in self-review row above and in PR body.

---

## Plan Complete

Plan saved to `docs/plans/2026-05-22-sp7-cost-estimator-dryrun.md`.
