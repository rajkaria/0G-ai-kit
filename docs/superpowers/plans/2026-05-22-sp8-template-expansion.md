# SP8 — Template Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the five canonical archetype templates (`chat`, `storage-app` refresh, `ai-agent`, `tee-attested-api`, `nft-with-storage`) that demonstrate SP3–SP7 in idiomatic use, each wired into `create-0gkit-app --template <name>` with tutorial-style READMEs and vitest tests using `0gkit-testing`.

**Architecture:** Each template is a standalone subdirectory under `templates/<name>/` consumed by `create-0gkit-app` via `giget` from `rajkaria/0gkit/templates/<name>#<ref>`. The CLI's `TEMPLATES` registry expands from 5 → 9 entries (5 existing + 4 new; `storage-app` is refreshed in-place). Each template ships with `vitest.config.ts`, an `__tests__/` directory using `@foundryprotocol/0gkit-testing` mocks, a `pnpm dev` script that invokes `0g dev` first (where applicable), and a long-form README that doubles as a tutorial. The docs site's `apps/docs/app/templates/page.mdx` gains one section per new archetype.

**Tech Stack:** TypeScript 5.6, Node 22, Vitest 2.x, Next.js 16 (chat), Hono 4.x (tee-attested-api), Foundry (nft-with-storage contracts), `@foundryprotocol/0gkit-*@^0.3.0` published packages, `giget` for template fetching, `commander 14.x` for CLI integration.

**Working dir (local):** `/Users/rajkaria/Projects/0G-ai-kit/`
**Branch:** `sp8-templates`
**Default ref pin in `templates.ts`:** Bump from `v0.2.x` → `v0.3.x` so newly-published v0.3.0 packages resolve against template default versions.

**SP10/SP11 dependency carveouts:**
- `ai-agent` references SP10 `0gkit-jobs` in the roadmap. SP10 isn't shipped — implement the agent as an in-process async loop, label the SP10 hand-off explicitly in `README.md` ("Drop `0gkit-jobs` in here when SP10 lands; the in-loop calls become job invocations one-to-one"). No fabricated `0gkit-jobs` imports.
- `tee-attested-api` references SP11 `0gkit-observability`. SP11 isn't shipped — implement plain `console.log`-style observability and label the SP11 hand-off in `README.md`. No fabricated `0gkit-observability` imports.

---

## File structure

**Modified (existing CLI):**
- `packages/create-0g-app/src/types.ts` — extend `TemplateName` union
- `packages/create-0g-app/src/templates.ts` — add four entries + bump `TEMPLATE_REF` default
- `packages/create-0g-app/src/__tests__/templates.test.ts` — add valid-name cases
- `packages/create-0g-app/src/__tests__/index.test.ts` — add `--template chat` smoke
- `apps/docs/app/templates/page.mdx` — five sections (refresh existing + add four)

**Refreshed (existing template):**
- `templates/storage-app/package.json` — bump deps to ^0.3.0, add vitest + 0gkit-testing
- `templates/storage-app/src/index.ts` — add SP7 estimate + dry-run preflight
- `templates/storage-app/src/__tests__/round-trip.test.ts` — vitest with mockStorageClient
- `templates/storage-app/README.md` — tutorial-style rewrite
- `templates/storage-app/vitest.config.ts` — new
- `templates/storage-app/tsconfig.json` — bump strict + include __tests__

**New templates (four full trees):**
- `templates/chat/` — Next.js 16 App Router, wallet + storage + indexer + react
- `templates/ai-agent/` — Node script, compute + attestation, in-process loop
- `templates/tee-attested-api/` — Hono API, wallet + attestation + plain logging
- `templates/nft-with-storage/` — Foundry contracts + TS minter (typed contracts + storage)

**Orchestration:**
- `.changeset/sp8-templates.md` — `create-0gkit-app` minor + `0gkit-app-changelog` patch (none of the runtime packages move)
- `docs/superpowers/DECISIONS.md` — append D24 + D25 + D26
- `docs/specs/2026-05-20-essentials-roadmap.md` — mark SP8 ✅ shipped
- `packages/create-0g-app/src/__tests__/__fixtures__/sp8-fetch-smoke.test.ts` — e2e smoke that scaffolds each new template via fake fetcher and asserts package.json validity

---

## Task graph

```
Task 1 (CLI scaffolding) ──┬─► Task 2 (storage-app refresh) ──► Task 7 (docs page) ─► Task 8 (CI smoke) ─► Task 9 (release prep)
                            ├─► Task 3 (chat template)        ──┘
                            ├─► Task 4 (ai-agent template)    ──┘
                            ├─► Task 5 (tee-attested-api)     ──┘
                            └─► Task 6 (nft-with-storage)     ──┘
```

Tasks 2–6 are independent and may be dispatched in parallel after Task 1 commits.

---

### Task 1: CLI scaffolding — extend `TemplateName` union, templates registry, ref pin

**Files:**
- Modify: `packages/create-0g-app/src/types.ts:1-6`
- Modify: `packages/create-0g-app/src/templates.ts:9-42`
- Modify: `packages/create-0g-app/src/__tests__/templates.test.ts`
- Modify: `packages/create-0g-app/src/__tests__/index.test.ts`

- [ ] **Step 1: Write the failing tests**

`packages/create-0g-app/src/__tests__/templates.test.ts` — replace the existing valid-template-name parametric test and add:

```ts
import { describe, expect, it } from "vitest";
import { TEMPLATES, isValidTemplateName } from "../templates.js";

describe("TEMPLATES registry", () => {
  it("contains the nine canonical archetypes", () => {
    expect(TEMPLATES.map((t) => t.name)).toEqual([
      "storage-app",
      "inference-app",
      "attestation-verify",
      "mcp-agent",
      "react-app",
      "chat",
      "ai-agent",
      "tee-attested-api",
      "nft-with-storage",
    ]);
  });

  it.each([
    "chat",
    "ai-agent",
    "tee-attested-api",
    "nft-with-storage",
  ])("validates new template name: %s", (name) => {
    expect(isValidTemplateName(name)).toBe(true);
  });

  it("rejects unknown template names", () => {
    expect(isValidTemplateName("nope")).toBe(false);
  });

  it("every template entry has a non-empty description", () => {
    for (const t of TEMPLATES) {
      expect(t.description.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify failures**

Run: `pnpm --filter create-0g-app vitest run __tests__/templates.test.ts`
Expected: FAIL — registry has 5 entries, not 9.

- [ ] **Step 3: Update `types.ts`**

Replace the contents of `packages/create-0g-app/src/types.ts` with:

```ts
export type TemplateName =
  | "storage-app"
  | "inference-app"
  | "attestation-verify"
  | "mcp-agent"
  | "react-app"
  | "chat"
  | "ai-agent"
  | "tee-attested-api"
  | "nft-with-storage";

export type Network = "local" | "galileo";

export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

export interface CreateOptions {
  /** Final project name (folder created here unless absolute). */
  name: string;
  template: TemplateName;
  network: Network;
  packageManager: PackageManager;
  install: boolean;
  git: boolean;
  /** Absolute destination path where the project files will be written. */
  dest: string;
  /** True if the interactive picker was used (i.e. not all flags supplied). */
  example: boolean;
}
```

- [ ] **Step 4: Update `templates.ts`**

Replace `TEMPLATES` array and `TEMPLATE_REF` default in `packages/create-0g-app/src/templates.ts`:

```ts
export const TEMPLATES: TemplateMeta[] = [
  {
    name: "storage-app",
    description: "Upload + retrieve with progress, dedup, and dry-run estimates.",
  },
  {
    name: "inference-app",
    description: "OpenAI-shaped chat against 0G Compute.",
  },
  {
    name: "attestation-verify",
    description: "Parse + verify a TEE attestation report.",
  },
  {
    name: "mcp-agent",
    description: "Expose 0G primitives as MCP tools.",
  },
  {
    name: "react-app",
    description: "Next.js app using 0gkit React hooks.",
  },
  {
    name: "chat",
    description:
      "Real-time chat: messages on 0G Storage, indexed live via SP6 events.",
  },
  {
    name: "ai-agent",
    description:
      "Multi-step LangChain-style agent on 0G Compute with TEE attestation per step.",
  },
  {
    name: "tee-attested-api",
    description:
      "Hono API where every response carries a TEE attestation header.",
  },
  {
    name: "nft-with-storage",
    description:
      "ERC-721 minter — metadata + media on 0G Storage, typed-contract codegen.",
  },
];

// ... isValidTemplateName unchanged ...

/**
 * Git ref the templates are fetched from. Updated to v0.3.x for the SP8
 * template release so newly-scaffolded projects pull templates that match
 * the published @foundryprotocol/0gkit-*@0.3.0 packages.
 */
const TEMPLATE_REF = process.env.OGKIT_TEMPLATE_REF ?? "v0.3.x";
```

- [ ] **Step 5: Run tests to verify passes**

Run: `pnpm --filter create-0g-app vitest run __tests__/templates.test.ts`
Expected: PASS — registry has 9 entries, validation works.

- [ ] **Step 6: Add `--template chat` smoke test to `index.test.ts`**

Append to `packages/create-0g-app/src/__tests__/index.test.ts` (inside the existing top-level `describe("run", ...)` block):

```ts
  it("accepts --template chat and writes to dest", async () => {
    const dest = await mkdtemp(join(tmpdir(), "create-0gkit-chat-"));
    const fetched: { name: string; dest: string }[] = [];
    const code = await run(
      ["node", "create", "demo", "--template", "chat", "--no-install", "--no-git"],
      {
        cwd: dest,
        log: () => undefined,
        err: () => undefined,
        fetchTemplate: async (o) => {
          fetched.push(o);
        },
        runInstall: async () => undefined,
        initGit: async () => ({ initialized: false }),
      }
    );
    expect(code).toBe(0);
    expect(fetched).toEqual([{ name: "chat", dest: join(dest, "demo") }]);
  });

  it.each([
    "ai-agent",
    "tee-attested-api",
    "nft-with-storage",
  ])("accepts --template %s", async (template) => {
    const dest = await mkdtemp(join(tmpdir(), `create-0gkit-${template}-`));
    const fetched: { name: string; dest: string }[] = [];
    const code = await run(
      ["node", "create", "demo", "--template", template, "--no-install", "--no-git"],
      {
        cwd: dest,
        log: () => undefined,
        err: () => undefined,
        fetchTemplate: async (o) => {
          fetched.push(o);
        },
        runInstall: async () => undefined,
        initGit: async () => ({ initialized: false }),
      }
    );
    expect(code).toBe(0);
    expect(fetched[0]?.name).toBe(template);
  });
```

(If `mkdtemp`/`tmpdir`/`join` aren't already imported in that file, add `import { mkdtemp } from "node:fs/promises"; import { tmpdir } from "node:os"; import { join } from "node:path";` — check the existing imports first and merge.)

- [ ] **Step 7: Run full CLI test suite**

Run: `pnpm --filter create-0g-app test`
Expected: PASS — all existing + new tests green. Coverage ≥ 80/70 gate.

- [ ] **Step 8: Run typecheck + build**

Run: `pnpm --filter create-0g-app typecheck && pnpm --filter create-0g-app build && pnpm --filter create-0gkit-app build`
Expected: Both clean. (create-0gkit-app re-exports from create-0g-app, so a green build there confirms re-export still works.)

- [ ] **Step 9: Commit**

```bash
git add packages/create-0g-app/src/types.ts \
        packages/create-0g-app/src/templates.ts \
        packages/create-0g-app/src/__tests__/templates.test.ts \
        packages/create-0g-app/src/__tests__/index.test.ts
git commit -m "feat(create-0g-app): extend template registry with SP8 archetypes

Adds chat, ai-agent, tee-attested-api, nft-with-storage to TemplateName
union and TEMPLATES registry. Bumps default OGKIT_TEMPLATE_REF to v0.3.x
so scaffolded projects resolve against @foundryprotocol/0gkit-*@0.3.0."
```

---

### Task 2: `storage-app` refresh — add SP7 estimate + dry-run, vitest, tutorial README

**Files:**
- Modify: `templates/storage-app/package.json`
- Modify: `templates/storage-app/src/index.ts`
- Create: `templates/storage-app/src/__tests__/round-trip.test.ts`
- Create: `templates/storage-app/vitest.config.ts`
- Modify: `templates/storage-app/tsconfig.json`
- Modify: `templates/storage-app/README.md`
- Create: `templates/storage-app/.env.example`

- [ ] **Step 1: Rewrite `package.json`**

```json
{
  "name": "storage-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "description": "Upload + retrieve a file with progress, dedup, and dry-run estimates via @foundryprotocol/0gkit-storage.",
  "scripts": {
    "dev": "tsx src/index.ts",
    "estimate": "tsx src/estimate.ts",
    "start": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "engines": {
    "node": ">=20.10"
  },
  "dependencies": {
    "@foundryprotocol/0gkit-core": "^0.3.0",
    "@foundryprotocol/0gkit-storage": "^0.3.0",
    "@foundryprotocol/0gkit-wallet": "^0.3.0"
  },
  "devDependencies": {
    "@foundryprotocol/0gkit-testing": "^0.3.0",
    "@types/node": "^22.0.0",
    "@vitest/coverage-v8": "^2.1.8",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Rewrite `src/index.ts`**

```ts
/**
 * storage-app — upload a file to 0G Storage with progress, dedup, and dry-run.
 *
 * Step 1: dry-run to surface the estimate (no broadcast).
 * Step 2: skip upload if the root already exists upstream (dedup).
 * Step 3: live upload; print the funding tx receipt.
 * Step 4: download by root + verify byte-for-byte.
 *
 * Pure orchestration — testable surface is in ./storage-flow.ts.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Storage } from "@foundryprotocol/0gkit-storage";
import { fromEnv } from "@foundryprotocol/0gkit-wallet";
import { ZeroGError, formatEstimate } from "@foundryprotocol/0gkit-core";
import { runStorageFlow, type StorageFlowDeps } from "./storage-flow.js";

async function main(): Promise<void> {
  const signer = await fromEnv({ name: "PRIVATE_KEY" });
  const network = (process.env.ZEROG_NETWORK ?? "galileo") as "galileo" | "aristotle";
  const storage = new Storage({ network, signer });

  const samplePath = fileURLToPath(new URL("./index.ts", import.meta.url));
  const bytes = new Uint8Array(await readFile(samplePath));

  const deps: StorageFlowDeps = {
    storage,
    log: (m) => console.log(m),
    formatEstimate,
  };

  const result = await runStorageFlow({ bytes, label: samplePath }, deps);
  if (!result.ok) {
    console.error(`FAILED: ${result.reason}`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  if (err instanceof ZeroGError) {
    console.error(`\n${err.name}: ${err.message}`);
    if (err.hint) console.error(`Hint: ${err.hint}`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
```

- [ ] **Step 3: Create `src/storage-flow.ts`** (the testable surface)

```ts
import type { Storage } from "@foundryprotocol/0gkit-storage";
import type { StorageEstimate } from "@foundryprotocol/0gkit-storage";

export interface StorageFlowDeps {
  storage: Pick<Storage, "estimate" | "upload" | "download">;
  log: (m: string) => void;
  formatEstimate: (e: StorageEstimate) => string;
}

export interface StorageFlowInput {
  bytes: Uint8Array;
  label: string;
}

export type StorageFlowResult =
  | { ok: true; root: string; txHash: string; latencyMs: number; dedup: boolean }
  | { ok: false; reason: string };

/**
 * Run the upload-then-verify flow. Pure with respect to `deps`.
 */
export async function runStorageFlow(
  { bytes, label }: StorageFlowInput,
  deps: StorageFlowDeps
): Promise<StorageFlowResult> {
  const { storage, log, formatEstimate } = deps;

  log(`Read ${bytes.length} bytes from ${label}`);

  const dry = await storage.upload(bytes, { dryRun: true });
  log("");
  log("Dry-run estimate:");
  log(formatEstimate(dry.estimate));
  log(`  predicted root: ${dry.result.root}`);

  const dryRoot = dry.result.root;
  let dedup = false;
  try {
    const existing = await storage.download(dryRoot);
    if (existing.length === bytes.length && existing.every((b, i) => b === bytes[i])) {
      log("");
      log(`Dedup: ${dryRoot} already on 0G Storage — skipping broadcast.`);
      dedup = true;
      return { ok: true, root: dryRoot, txHash: "", latencyMs: 0, dedup };
    }
  } catch {
    // Not-found is expected on first upload; fall through to live upload.
  }

  log("");
  log("Uploading…");
  const live = await storage.upload(bytes);
  log(`  Merkle root : ${live.root}`);
  log(`  tx hash     : ${live.tx.txHash}`);
  log(`  latency     : ${live.tx.latencyMs}ms`);

  log("Downloading back…");
  const fetched = await storage.download(live.root);
  log(`  Got ${fetched.length} bytes`);

  const ok = fetched.length === bytes.length && fetched.every((b, i) => b === bytes[i]);
  if (!ok) return { ok: false, reason: "round-trip bytes did not match" };

  log("Round-trip OK.");
  return {
    ok: true,
    root: live.root,
    txHash: live.tx.txHash,
    latencyMs: live.tx.latencyMs,
    dedup,
  };
}
```

- [ ] **Step 4: Create `src/__tests__/round-trip.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { mockStorageClient } from "@foundryprotocol/0gkit-testing/mocks";
import { runStorageFlow } from "../storage-flow.js";

const FAKE_ESTIMATE = (e: { fee?: bigint }) => `fee: ${e.fee ?? 0n} wei`;

describe("runStorageFlow", () => {
  it("uploads when the root is new", async () => {
    const storage = mockStorageClient();
    const log = vi.fn();

    const result = await runStorageFlow(
      { bytes: new Uint8Array([1, 2, 3]), label: "fixture.bin" },
      { storage, log, formatEstimate: FAKE_ESTIMATE }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dedup).toBe(false);
    expect(result.root).toMatch(/^0x[0-9a-f]+$/);
  });

  it("returns dedup=true when the root already exists upstream", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const storage = mockStorageClient();
    // Pre-seed: upload once so the dedup branch fires on the next attempt.
    await storage.upload(bytes);

    const result = await runStorageFlow(
      { bytes, label: "fixture.bin" },
      { storage, log: () => undefined, formatEstimate: FAKE_ESTIMATE }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dedup).toBe(true);
    expect(result.txHash).toBe("");
  });

  it("reports a failure if the downloaded bytes do not match", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const storage = mockStorageClient();
    // Override download to return mismatched bytes.
    const originalDownload = storage.download.bind(storage);
    storage.download = vi.fn(async (root: string) => {
      const real = await originalDownload(root);
      return real.length > 0 ? new Uint8Array([9, 9, 9]) : real;
    });

    const result = await runStorageFlow(
      { bytes, label: "fixture.bin" },
      { storage, log: () => undefined, formatEstimate: FAKE_ESTIMATE }
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/did not match/);
  });

  it("calls formatEstimate on the dry-run estimate", async () => {
    const storage = mockStorageClient();
    const formatEstimate = vi.fn(() => "stub");
    await runStorageFlow(
      { bytes: new Uint8Array([1, 2]), label: "fixture.bin" },
      { storage, log: () => undefined, formatEstimate }
    );
    expect(formatEstimate).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 5: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/__tests__/**", "src/**/*.test.ts"],
      thresholds: { lines: 80, branches: 70 },
    },
  },
});
```

- [ ] **Step 6: Update `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["node", "vitest/globals"],
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 7: Create `.env.example`**

```dotenv
# Required: the wallet that signs the upload funding tx.
PRIVATE_KEY=

# Optional: galileo (testnet, default) | aristotle (mainnet)
ZEROG_NETWORK=galileo
```

- [ ] **Step 8: Rewrite `README.md`** (tutorial-style)

```markdown
# storage-app — upload + retrieve with dedup and dry-run

The fastest path from a file on disk to a content-addressed blob on **0G Storage**.

Built on `@foundryprotocol/0gkit-storage@0.3.0`. Demos: SP3 wallet, SP7 estimate + dry-run, SP-7 dedup.

## What you get

1. **Dry-run preflight** — predicts the Merkle root *and* the gas cost, no broadcast.
2. **Dedup** — if the predicted root already exists on 0G, you skip the funding tx entirely.
3. **Live upload** — sends the funding tx, returns receipt + Merkle root.
4. **Round-trip verify** — downloads by root and asserts byte-for-byte equality.

## Quickstart

```bash
cp .env.example .env
# Fill in PRIVATE_KEY with a galileo testnet key (faucet at https://faucet.0g.ai).

pnpm install
pnpm dev
```

Sample output:

```
Read 1342 bytes from /…/src/index.ts

Dry-run estimate:
  type: storage
  gas:  240000
  fee:  3 gwei
  predicted root: 0xabc…123

Uploading…
  Merkle root : 0xabc…123
  tx hash     : 0xdef…456
  latency     : 1421ms
Downloading back…
  Got 1342 bytes
Round-trip OK.
```

## Walk through the code

- **`src/index.ts`** is the thin entry — reads env, loads a signer, wires the live `Storage` client into `runStorageFlow`.
- **`src/storage-flow.ts`** is the testable surface — pure with respect to its `deps`. The function it exports (`runStorageFlow`) is what the tests exercise.

The dry-run uses [`Storage.upload(bytes, { dryRun: true })`](https://0gkit.dev/packages/storage#dryrun) and the live upload omits the flag. Both calls return the same shape — `result.root` matches across the two — so the dedup check is just "did the predicted root already land?".

## How to test it offline

```bash
pnpm test
```

The tests inject `mockStorageClient()` from `@foundryprotocol/0gkit-testing/mocks` — no network, no signer needed. All branches (new upload, dedup hit, byte mismatch) are covered.

## Where to go next

- Swap `fromEnv` for a hardware-backed signer using [`fromKMS`](https://0gkit.dev/packages/wallet#fromkms).
- Add a CLI flag for the path to upload, then wire it into your own data pipeline.
- For long-lived uploads (>30 MB), consider the SP10 job runner once it ships (this template will gain a `--job` flag).
```

- [ ] **Step 9: Run tests**

Run: `pnpm --filter storage-app... test`
Expected: 4 tests pass, coverage ≥ 80/70.

(If pnpm doesn't pick up the storage-app template at all because it's not yet a workspace, add `templates/*` to `pnpm-workspace.yaml`. Check `pnpm-workspace.yaml` first — if `templates/*` is not in the `packages:` list, that update is part of this task. The new test commands also need the testing package's `^0.3.0` workspace alias to resolve, which is already published.)

- [ ] **Step 10: Commit**

```bash
git add templates/storage-app pnpm-workspace.yaml
git commit -m "feat(storage-app): SP7 estimate + dedup + vitest

Replaces the read-only round-trip script with a flow that:
- dry-runs the upload to surface the fee + predicted Merkle root,
- short-circuits if the root already exists on 0G (dedup),
- broadcasts the funding tx only on a real miss,
- verifies the bytes round-trip.

Adds vitest coverage via @foundryprotocol/0gkit-testing mocks. Tutorial-
style README."
```

---

### Task 3: `chat` template — Next.js 16 App Router, wallet + storage + indexer + react

**Files (all new):**
- `templates/chat/package.json`
- `templates/chat/tsconfig.json`
- `templates/chat/next.config.ts`
- `templates/chat/app/layout.tsx`
- `templates/chat/app/page.tsx`
- `templates/chat/app/providers.tsx`
- `templates/chat/app/api/post/route.ts`
- `templates/chat/lib/message.ts`
- `templates/chat/lib/contract.ts`
- `templates/chat/lib/__tests__/message.test.ts`
- `templates/chat/vitest.config.ts`
- `templates/chat/.env.example`
- `templates/chat/README.md`

- [ ] **Step 1: Write the failing test**

`templates/chat/lib/__tests__/message.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { encodeMessage, decodeMessage, type ChatMessage } from "../message.js";

describe("chat message codec", () => {
  it("round-trips a basic message", () => {
    const m: ChatMessage = {
      author: "0x0000000000000000000000000000000000000001",
      ts: 1716364800000,
      body: "hello 0G",
    };
    const bytes = encodeMessage(m);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(decodeMessage(bytes)).toEqual(m);
  });

  it("rejects an empty body", () => {
    expect(() =>
      encodeMessage({
        author: "0x0000000000000000000000000000000000000001",
        ts: 1,
        body: "",
      })
    ).toThrow(/body/);
  });

  it("clamps body to 4 KiB", () => {
    const body = "a".repeat(5000);
    expect(() =>
      encodeMessage({
        author: "0x0000000000000000000000000000000000000001",
        ts: 1,
        body,
      })
    ).toThrow(/4096/);
  });

  it("rejects non-address author", () => {
    expect(() =>
      encodeMessage({ author: "alice", ts: 1, body: "hi" })
    ).toThrow(/address/);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter chat vitest run lib/__tests__/message.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "chat",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "description": "Real-time chat — messages on 0G Storage, indexed live via SP6 events.",
  "scripts": {
    "predev": "0g dev --detach || true",
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "engines": {
    "node": ">=20.10"
  },
  "dependencies": {
    "@foundryprotocol/0gkit-core": "^0.3.0",
    "@foundryprotocol/0gkit-storage": "^0.3.0",
    "@foundryprotocol/0gkit-indexer": "^0.3.0",
    "@foundryprotocol/0gkit-react": "^0.3.0",
    "@foundryprotocol/0gkit-wallet": "^0.3.0",
    "@foundryprotocol/0gkit-wallet-react": "^0.3.0",
    "@foundryprotocol/0gkit-contracts": "^0.3.0",
    "@foundryprotocol/0gkit-cli": "^0.3.0",
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@foundryprotocol/0gkit-testing": "^0.3.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitest/coverage-v8": "^2.1.8",
    "typescript": "^5.6.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 4: Create `lib/message.ts`** (testable surface)

```ts
import { isAddress } from "viem";

export interface ChatMessage {
  author: `0x${string}` | string;
  ts: number;
  body: string;
}

const MAX_BODY_BYTES = 4096;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeMessage(m: ChatMessage): Uint8Array {
  if (!isAddress(m.author)) {
    throw new Error(`author must be an EVM address, got "${m.author}"`);
  }
  if (!m.body || m.body.length === 0) {
    throw new Error("body must not be empty");
  }
  const bodyBytes = encoder.encode(m.body);
  if (bodyBytes.length > MAX_BODY_BYTES) {
    throw new Error(
      `body exceeds maximum size of ${MAX_BODY_BYTES} bytes (${bodyBytes.length})`
    );
  }
  const payload = JSON.stringify({
    v: 1,
    author: m.author,
    ts: m.ts,
    body: m.body,
  });
  return encoder.encode(payload);
}

export function decodeMessage(bytes: Uint8Array): ChatMessage {
  const text = decoder.decode(bytes);
  const obj = JSON.parse(text) as {
    v: number;
    author: string;
    ts: number;
    body: string;
  };
  if (obj.v !== 1) throw new Error(`unsupported message version: ${obj.v}`);
  return { author: obj.author, ts: obj.ts, body: obj.body };
}
```

(Note: this template uses `viem`'s `isAddress` since `0gkit-contracts` re-exports nothing for raw address validation; viem is a transitive dep of `0gkit-contracts` so it resolves at runtime. Add `viem: "^2.21.0"` to `dependencies` if pnpm complains about implicit peer.)

- [ ] **Step 5: Run tests to verify passing**

Run: `pnpm --filter chat vitest run lib/__tests__/message.test.ts`
Expected: PASS — 4 tests green.

- [ ] **Step 6: Create `lib/contract.ts`** — the on-chain MessagePosted event ABI

```ts
/**
 * Minimal ABI for the MessagePosted event. The contract is deployed by the
 * `0g dev` local stack at well-known address 0x… (see README). For galileo
 * testnet, swap MESSAGE_REGISTRY_ADDRESS with the deployed instance.
 *
 * event MessagePosted(address indexed author, bytes32 root, uint256 ts);
 */
export const MESSAGE_REGISTRY_ABI = [
  {
    type: "event",
    name: "MessagePosted",
    inputs: [
      { name: "author", type: "address", indexed: true },
      { name: "root", type: "bytes32", indexed: false },
      { name: "ts", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;

export const MESSAGE_REGISTRY_ADDRESS =
  (process.env.NEXT_PUBLIC_MESSAGE_REGISTRY_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`;
```

- [ ] **Step 7: Create `app/providers.tsx`**

```tsx
"use client";
import { ZeroGIndexerProvider } from "@foundryprotocol/0gkit-react";

export function Providers({ children }: { children: React.ReactNode }) {
  const network =
    (process.env.NEXT_PUBLIC_ZEROG_NETWORK as "galileo" | "aristotle" | undefined) ??
    "galileo";
  return (
    <ZeroGIndexerProvider network={network} pollIntervalMs={2000}>
      {children}
    </ZeroGIndexerProvider>
  );
}
```

- [ ] **Step 8: Create `app/layout.tsx`**

```tsx
import { Providers } from "./providers";

export const metadata = {
  title: "0gkit chat",
  description: "Real-time chat — messages on 0G Storage, indexed live.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          maxWidth: 720,
          margin: "0 auto",
          padding: "2rem",
        }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 9: Create `app/page.tsx`** — the chat UI

```tsx
"use client";
import { useEffect, useState } from "react";
import { useEvent } from "@foundryprotocol/0gkit-react";
import { MESSAGE_REGISTRY_ABI, MESSAGE_REGISTRY_ADDRESS } from "@/lib/contract";
import { decodeMessage, type ChatMessage } from "@/lib/message";

interface PostedRow {
  author: string;
  root: `0x${string}`;
  ts: bigint;
}

export default function Home() {
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [messages, setMessages] = useState<(PostedRow & { body?: string })[]>([]);

  const { events } = useEvent({
    contract: { address: MESSAGE_REGISTRY_ADDRESS, abi: MESSAGE_REGISTRY_ABI },
    event: "MessagePosted",
    fromBlock: 0n,
  });

  // Materialise event rows → message rows by fetching each root from 0G Storage.
  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const next: (PostedRow & { body?: string })[] = [];
      for (const e of events) {
        const args = e.args as PostedRow;
        try {
          const res = await fetch(`/api/post?root=${args.root}`);
          if (!res.ok) continue;
          const blob = new Uint8Array(await res.arrayBuffer());
          const m = decodeMessage(blob);
          next.push({ ...args, body: m.body });
        } catch {
          next.push(args);
        }
      }
      if (!cancelled) setMessages(next);
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [events]);

  async function send() {
    if (!draft.trim()) return;
    setPosting(true);
    try {
      await fetch("/api/post", {
        method: "POST",
        body: JSON.stringify({ body: draft }),
        headers: { "content-type": "application/json" },
      });
      setDraft("");
    } finally {
      setPosting(false);
    }
  }

  return (
    <main>
      <h1>0gkit chat</h1>
      <p style={{ color: "#666" }}>
        Messages are persisted on 0G Storage; the indexer streams the
        on-chain event log in real time.
      </p>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {messages.map((m) => (
          <li
            key={m.root}
            style={{
              border: "1px solid #ddd",
              padding: "0.5rem",
              margin: "0.5rem 0",
              borderRadius: 4,
            }}
          >
            <div style={{ fontSize: "0.8rem", color: "#888" }}>
              {m.author.slice(0, 10)}… · ts {String(m.ts)}
            </div>
            <div>{m.body ?? <em>(unavailable — fetch failed)</em>}</div>
          </li>
        ))}
      </ul>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="say something to the chain…"
        rows={3}
        style={{ width: "100%" }}
      />
      <button onClick={send} disabled={posting || !draft.trim()}>
        {posting ? "Posting…" : "Post"}
      </button>
    </main>
  );
}
```

- [ ] **Step 10: Create `app/api/post/route.ts`** — server-side write path

```ts
import { NextRequest, NextResponse } from "next/server";
import { Storage } from "@foundryprotocol/0gkit-storage";
import { fromEnv } from "@foundryprotocol/0gkit-wallet";
import { createTypedContract } from "@foundryprotocol/0gkit-contracts";
import { encodeMessage } from "@/lib/message";
import { MESSAGE_REGISTRY_ABI, MESSAGE_REGISTRY_ADDRESS } from "@/lib/contract";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const root = url.searchParams.get("root");
  if (!root) return NextResponse.json({ error: "missing root" }, { status: 400 });
  const signer = await fromEnv({ name: "PRIVATE_KEY" });
  const storage = new Storage({
    network: (process.env.ZEROG_NETWORK as "galileo" | "aristotle") ?? "galileo",
    signer,
  });
  const bytes = await storage.download(root);
  return new NextResponse(bytes, {
    status: 200,
    headers: { "content-type": "application/octet-stream" },
  });
}

export async function POST(req: NextRequest) {
  const { body } = (await req.json()) as { body: string };
  if (typeof body !== "string" || body.length === 0) {
    return NextResponse.json({ error: "missing body" }, { status: 400 });
  }
  const signer = await fromEnv({ name: "PRIVATE_KEY" });
  const network = (process.env.ZEROG_NETWORK as "galileo" | "aristotle") ?? "galileo";
  const storage = new Storage({ network, signer });

  const author = signer.address;
  const ts = Date.now();
  const bytes = encodeMessage({ author, ts, body });

  const { root, tx } = await storage.upload(bytes);

  const contract = createTypedContract({
    address: MESSAGE_REGISTRY_ADDRESS,
    abi: [
      ...MESSAGE_REGISTRY_ABI,
      {
        type: "function",
        name: "post",
        stateMutability: "nonpayable",
        inputs: [
          { name: "root", type: "bytes32" },
          { name: "ts", type: "uint256" },
        ],
        outputs: [],
      },
    ] as const,
    signer,
    network,
  });

  await contract.write.post([root as `0x${string}`, BigInt(ts)]);

  return NextResponse.json({ ok: true, root, txHash: tx.txHash });
}
```

- [ ] **Step 11: Create `next.config.ts`, `tsconfig.json`, `vitest.config.ts`, `.env.example`**

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { typedRoutes: true },
};

export default nextConfig;
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: ["lib/**/*.ts"],
      exclude: ["lib/**/__tests__/**", "lib/contract.ts"],
      thresholds: { lines: 80, branches: 70 },
    },
  },
});
```

`.env.example`:

```dotenv
# Signs uploads + on-chain posts. Local devnet pre-funded mnemonic is fine.
PRIVATE_KEY=

# galileo (testnet, default) | aristotle (mainnet)
ZEROG_NETWORK=galileo
NEXT_PUBLIC_ZEROG_NETWORK=galileo

# MessageRegistry contract address. Local devnet deploys this automatically;
# for galileo testnet, deploy the contract first and paste the address here.
NEXT_PUBLIC_MESSAGE_REGISTRY_ADDRESS=0x0000000000000000000000000000000000000000
```

- [ ] **Step 12: Write `README.md`** — tutorial-style

```markdown
# chat — real-time chat on 0G

A working chat app where every message is persisted to **0G Storage** and the
on-chain event log is the source of truth for the message list.

Stack: Next.js 16 App Router · React 19 · `@foundryprotocol/0gkit-storage` ·
`@foundryprotocol/0gkit-indexer` · `@foundryprotocol/0gkit-react` ·
`@foundryprotocol/0gkit-contracts`.

## What this demos

| Surface             | Used for                                                |
| ------------------- | ------------------------------------------------------- |
| SP3 wallet (server) | Signs the upload + the `post(root, ts)` tx              |
| SP4 typed contracts | `createTypedContract(...).write.post(...)`              |
| SP6 indexer (react) | `useEvent({ contract, event: "MessagePosted" })`        |
| SP3 storage         | `storage.upload(encodeMessage(...))` + `storage.download` |

## Quickstart

```bash
cp .env.example .env
# Fill in PRIVATE_KEY (use a funded local-devnet key, or galileo testnet key).
# For local devnet: `0g dev` will print a pre-funded mnemonic; use account 0.

pnpm install
pnpm dev
# Open http://localhost:3000
```

> The `predev` script runs `0g dev --detach` before Next.js — that boots a
> local 0G chain + storage + a `MessageRegistry` contract on 0x… (printed in
> the `0g dev` logs). Paste that into `.env` if you're running locally.

## Walk through the code

1. **`lib/message.ts`** — message codec. Pure functions. Encodes/decodes the
   wire format: `{ v: 1, author, ts, body }`. Validates the address shape and
   clamps body size to 4 KiB. This is the unit-tested surface.

2. **`app/api/post/route.ts`** — server-side write path.
   - `POST /api/post` encodes the message, uploads to 0G Storage, then calls
     `MessageRegistry.post(root, ts)` via `createTypedContract`.
   - `GET /api/post?root=…` proxies the storage download (so the browser
     doesn't need the signer).

3. **`app/page.tsx`** — the UI.
   - `useEvent` from `0gkit-react` subscribes to `MessagePosted` events with
     reorg-safe semantics (rolled-back events disappear automatically).
   - For each event we fetch the stored bytes from `/api/post?root=…` and
     decode them.

4. **`app/providers.tsx`** — wraps everything in `ZeroGIndexerProvider` so the
   hooks share a single polling indexer instance.

## Deploy the registry contract

The `MessageRegistry` contract is a 30-line Solidity contract that emits the
event. Use any deploy flow — Foundry, Hardhat, or the `0g dev` stack which
deploys it automatically. Source:

```solidity
pragma solidity ^0.8.20;
contract MessageRegistry {
    event MessagePosted(address indexed author, bytes32 root, uint256 ts);
    function post(bytes32 root, uint256 ts) external {
        emit MessagePosted(msg.sender, root, ts);
    }
}
```

## Run the tests

```bash
pnpm test
```

Uses `@foundryprotocol/0gkit-testing` mocks. No network or chain needed.

## Next steps

- Add per-room channels by emitting `MessagePosted(author, root, ts, room)`
  and filtering `useEvent` with `args`.
- Move the upload from server-side to client-side using a wallet-react hook
  once you don't need a privileged key.
```

- [ ] **Step 13: Run tests + typecheck + build**

Run: `pnpm --filter chat test && pnpm --filter chat typecheck`
Expected: 4 tests pass at ≥ 80/70 coverage; typecheck clean.

(Skip `pnpm build` here unless the workspace already installs Next.js — Next will be installed by `pnpm install` in the chat dir during scaffolding, not in CI.)

- [ ] **Step 14: Commit**

```bash
git add templates/chat
git commit -m "feat(templates): SP8 chat — Next.js + wallet + storage + indexer

New 'chat' template. Messages persist to 0G Storage; the on-chain
MessagePosted event log is the source of truth (consumed via SP6
useEvent reorg-safe hook). Server-side write path uses fromEnv signer
+ createTypedContract.

Vitest covers the wire-format codec at >80% lines."
```

---

### Task 4: `ai-agent` template — multi-step agent on 0G Compute with TEE attestation per step

**Files (all new):**
- `templates/ai-agent/package.json`
- `templates/ai-agent/tsconfig.json`
- `templates/ai-agent/vitest.config.ts`
- `templates/ai-agent/.env.example`
- `templates/ai-agent/src/index.ts`
- `templates/ai-agent/src/agent.ts`
- `templates/ai-agent/src/tools.ts`
- `templates/ai-agent/src/__tests__/agent.test.ts`
- `templates/ai-agent/README.md`

- [ ] **Step 1: Write the failing test**

`templates/ai-agent/src/__tests__/agent.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { mockComputeClient } from "@foundryprotocol/0gkit-testing/mocks";
import { fixtureAttestation } from "@foundryprotocol/0gkit-testing/fixtures";
import { runAgent, type AgentDeps } from "../agent.js";
import { ToolRegistry } from "../tools.js";

function makeDeps(overrides: Partial<AgentDeps> = {}): AgentDeps {
  const compute = mockComputeClient();
  const tools = new ToolRegistry();
  tools.register({
    name: "add",
    description: "Add two numbers.",
    handler: ({ a, b }: { a: number; b: number }) => ({ result: a + b }),
  });
  return {
    compute,
    tools,
    verifyAttestation: vi.fn().mockResolvedValue(true),
    log: () => undefined,
    maxSteps: 3,
    ...overrides,
  };
}

describe("runAgent", () => {
  it("terminates with a final answer when the model returns 'done'", async () => {
    const deps = makeDeps();
    // Mock compute returns a 'done' step on first call.
    (deps.compute.inference as ReturnType<typeof vi.fn>) = vi
      .fn()
      .mockResolvedValue({
        choices: [{ message: { content: '{"action":"done","answer":"42"} ' } }],
        receipt: { txHash: "0xabc", latencyMs: 5 },
        attestation: fixtureAttestation(),
      });
    const result = await runAgent("what is 41+1?", deps);
    expect(result.kind).toBe("final");
    if (result.kind !== "final") return;
    expect(result.answer).toBe("42");
    expect(result.steps).toHaveLength(1);
  });

  it("calls tools when the model returns a 'tool' action", async () => {
    const deps = makeDeps();
    let call = 0;
    (deps.compute.inference as ReturnType<typeof vi.fn>) = vi.fn(async () => {
      call += 1;
      if (call === 1) {
        return {
          choices: [
            {
              message: {
                content: '{"action":"tool","name":"add","args":{"a":2,"b":3}}',
              },
            },
          ],
          receipt: { txHash: "0xa", latencyMs: 1 },
          attestation: fixtureAttestation(),
        };
      }
      return {
        choices: [{ message: { content: '{"action":"done","answer":"5"}' } }],
        receipt: { txHash: "0xb", latencyMs: 1 },
        attestation: fixtureAttestation(),
      };
    });
    const result = await runAgent("2+3?", deps);
    expect(result.kind).toBe("final");
    if (result.kind !== "final") return;
    expect(result.answer).toBe("5");
    expect(result.steps).toHaveLength(2);
    expect(result.steps[1]?.toolName).toBe("add");
  });

  it("returns kind='abort' when maxSteps is reached", async () => {
    const deps = makeDeps({ maxSteps: 1 });
    (deps.compute.inference as ReturnType<typeof vi.fn>) = vi
      .fn()
      .mockResolvedValue({
        choices: [
          {
            message: { content: '{"action":"tool","name":"add","args":{"a":1,"b":1}}' },
          },
        ],
        receipt: { txHash: "0x", latencyMs: 1 },
        attestation: fixtureAttestation(),
      });
    const result = await runAgent("loop forever", deps);
    expect(result.kind).toBe("abort");
  });

  it("rejects steps whose attestation does not verify", async () => {
    const deps = makeDeps({
      verifyAttestation: vi.fn().mockResolvedValue(false),
    });
    (deps.compute.inference as ReturnType<typeof vi.fn>) = vi
      .fn()
      .mockResolvedValue({
        choices: [{ message: { content: '{"action":"done","answer":"ok"}' } }],
        receipt: { txHash: "0x", latencyMs: 1 },
        attestation: fixtureAttestation(),
      });
    const result = await runAgent("hi", deps);
    expect(result.kind).toBe("abort");
    if (result.kind !== "abort") return;
    expect(result.reason).toMatch(/attestation/i);
  });
});
```

- [ ] **Step 2: Run tests to verify failures**

Run: `pnpm --filter ai-agent vitest run`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "ai-agent",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "description": "Multi-step LangChain-style agent on 0G Compute with TEE attestation per step.",
  "scripts": {
    "dev": "tsx src/index.ts",
    "start": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "engines": {
    "node": ">=20.10"
  },
  "dependencies": {
    "@foundryprotocol/0gkit-core": "^0.3.0",
    "@foundryprotocol/0gkit-compute": "^0.3.0",
    "@foundryprotocol/0gkit-attestation": "^0.3.0",
    "@foundryprotocol/0gkit-wallet": "^0.3.0"
  },
  "devDependencies": {
    "@foundryprotocol/0gkit-testing": "^0.3.0",
    "@types/node": "^22.0.0",
    "@vitest/coverage-v8": "^2.1.8",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 4: Create `src/tools.ts`**

```ts
export interface Tool<Args = unknown, Result = unknown> {
  name: string;
  description: string;
  handler: (args: Args) => Promise<Result> | Result;
}

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register<Args, Result>(tool: Tool<Args, Result>): void {
    this.tools.set(tool.name, tool as Tool);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): { name: string; description: string }[] {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
    }));
  }

  async invoke(name: string, args: unknown): Promise<unknown> {
    const t = this.tools.get(name);
    if (!t) throw new Error(`tool not registered: ${name}`);
    return t.handler(args);
  }
}
```

- [ ] **Step 5: Create `src/agent.ts`** (the testable surface)

```ts
import type { Compute, InferenceResult } from "@foundryprotocol/0gkit-compute";
import type { ToolRegistry } from "./tools.js";

export interface AgentDeps {
  compute: Pick<Compute, "inference">;
  tools: ToolRegistry;
  verifyAttestation: (a: unknown) => Promise<boolean>;
  log: (m: string) => void;
  maxSteps: number;
}

export interface AgentStep {
  prompt: string;
  rawResponse: string;
  toolName?: string;
  toolArgs?: unknown;
  toolResult?: unknown;
  attestationTxHash: string;
}

export type AgentResult =
  | { kind: "final"; answer: string; steps: AgentStep[] }
  | { kind: "abort"; reason: string; steps: AgentStep[] };

interface Decision {
  action: "tool" | "done";
  name?: string;
  args?: unknown;
  answer?: string;
}

function parseDecision(raw: string): Decision {
  const trimmed = raw.trim();
  try {
    const obj = JSON.parse(trimmed) as Decision;
    if (obj.action === "tool" || obj.action === "done") return obj;
  } catch {
    // fall through
  }
  return { action: "done", answer: trimmed };
}

export async function runAgent(prompt: string, deps: AgentDeps): Promise<AgentResult> {
  const { compute, tools, verifyAttestation, log, maxSteps } = deps;
  const steps: AgentStep[] = [];
  let history = `User: ${prompt}\n\nTools:\n${tools
    .list()
    .map((t) => `- ${t.name}: ${t.description}`)
    .join("\n")}\n\nRespond as JSON: {"action":"tool","name":"<tool>","args":{...}} or {"action":"done","answer":"..."}.`;

  for (let i = 0; i < maxSteps; i += 1) {
    const res = (await compute.inference({
      messages: [{ role: "user", content: history }],
    })) as InferenceResult & { attestation?: unknown };

    const raw = res.choices[0]?.message?.content ?? "";

    const ok = await verifyAttestation(res.attestation);
    if (!ok) {
      return {
        kind: "abort",
        reason: `step ${i + 1}: attestation did not verify`,
        steps,
      };
    }

    const decision = parseDecision(raw);
    log(`step ${i + 1}: action=${decision.action} ${decision.name ?? ""}`);

    if (decision.action === "done") {
      steps.push({
        prompt: history,
        rawResponse: raw,
        attestationTxHash: res.receipt.txHash,
      });
      return { kind: "final", answer: decision.answer ?? "", steps };
    }

    // action === "tool"
    if (!decision.name || !tools.has(decision.name)) {
      return {
        kind: "abort",
        reason: `step ${i + 1}: model asked for unknown tool "${decision.name}"`,
        steps,
      };
    }
    const toolResult = await tools.invoke(decision.name, decision.args);
    steps.push({
      prompt: history,
      rawResponse: raw,
      toolName: decision.name,
      toolArgs: decision.args,
      toolResult,
      attestationTxHash: res.receipt.txHash,
    });
    history += `\n\nTool "${decision.name}" returned: ${JSON.stringify(toolResult)}`;
  }

  return { kind: "abort", reason: `max steps (${maxSteps}) exceeded`, steps };
}
```

- [ ] **Step 6: Create `src/index.ts`** (the thin entry)

```ts
/**
 * ai-agent — multi-step agent on 0G Compute, attestation-verified per step.
 *
 * SP10 (jobs) hand-off: today the agent loop runs in-process. When SP10
 * lands, each `compute.inference(...)` call becomes a `jobs.enqueue("step", ...)`
 * invocation with the same args; the loop transforms into a step-machine.
 * The agent.ts surface is shaped so the swap is mechanical.
 */
import { Compute } from "@foundryprotocol/0gkit-compute";
import { fromEnv } from "@foundryprotocol/0gkit-wallet";
import { verifyAttestation as verifyEnvelope } from "@foundryprotocol/0gkit-attestation";
import { ZeroGError } from "@foundryprotocol/0gkit-core";
import { runAgent } from "./agent.js";
import { ToolRegistry } from "./tools.js";

async function main(): Promise<void> {
  const signer = await fromEnv({ name: "PRIVATE_KEY" });
  const network = (process.env.ZEROG_NETWORK ?? "galileo") as "galileo" | "aristotle";
  const compute = new Compute({ network, signer });

  const tools = new ToolRegistry();
  tools.register({
    name: "add",
    description: "Add two integers. args: { a: number, b: number }",
    handler: ({ a, b }: { a: number; b: number }) => ({ result: a + b }),
  });
  tools.register({
    name: "current_time",
    description: "Get the current ISO timestamp. args: {}",
    handler: () => ({ iso: new Date().toISOString() }),
  });

  const prompt = process.argv[2] ?? "What is 17 + 25? Use the add tool.";

  const result = await runAgent(prompt, {
    compute,
    tools,
    verifyAttestation: async (a) => {
      if (!a || typeof a !== "object") return false;
      try {
        await verifyEnvelope(a as Parameters<typeof verifyEnvelope>[0]);
        return true;
      } catch {
        return false;
      }
    },
    log: (m) => console.log(m),
    maxSteps: 5,
  });

  console.log("");
  console.log(`Agent result: ${result.kind}`);
  if (result.kind === "final") {
    console.log(`  Answer: ${result.answer}`);
  } else {
    console.log(`  Reason: ${result.reason}`);
  }
  console.log(`  Steps : ${result.steps.length}`);
  for (const [i, s] of result.steps.entries()) {
    console.log(`    [${i + 1}] tx=${s.attestationTxHash}${s.toolName ? ` tool=${s.toolName}` : ""}`);
  }
}

main().catch((err: unknown) => {
  if (err instanceof ZeroGError) {
    console.error(`\n${err.name}: ${err.message}`);
    if (err.hint) console.error(`Hint: ${err.hint}`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
```

- [ ] **Step 7: Create config files**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["node", "vitest/globals"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true
  },
  "include": ["src/**/*.ts"]
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/**/__tests__/**"],
      thresholds: { lines: 80, branches: 70 },
    },
  },
});
```

`.env.example`:

```dotenv
# Pays for 0G Compute calls. Use a galileo testnet key with prepaid balance.
PRIVATE_KEY=

# galileo | aristotle
ZEROG_NETWORK=galileo
```

- [ ] **Step 8: Run tests + typecheck**

Run: `pnpm --filter ai-agent test && pnpm --filter ai-agent typecheck`
Expected: 4 tests pass, coverage ≥ 80/70, typecheck clean.

- [ ] **Step 9: Write `README.md`**

```markdown
# ai-agent — multi-step agent on 0G Compute (TEE-attested per step)

A Node script that runs a **LangChain-style ReAct agent** where every
inference step is paid through 0G Compute and accompanied by a TEE
attestation — so you can prove off-the-record that each chain-of-thought
step ran inside a genuine secure enclave.

Stack: `@foundryprotocol/0gkit-compute` · `@foundryprotocol/0gkit-attestation` ·
`@foundryprotocol/0gkit-wallet`.

## Architecture

```
runAgent(prompt) ──┐
                   ▼
            ┌──────────────┐
            │ 1. compute.  │
       ┌────│   inference  │────► InferenceResult + attestation
       │    └──────────────┘
       │           │
       │           ▼
       │    ┌──────────────┐
       │    │ 2. verify    │── false ─► ABORT
       │    │  attestation │
       │    └──────────────┘
       │           │
       │           ▼
       │    ┌──────────────┐
       │    │ 3. parse     │
       │    │  decision    │
       │    └──────────────┘
       │      │         │
       │   tool       done
       │      │         │
       │      ▼         ▼
       │  invoke    return final
       │     │
       └─────┘
```

## Quickstart

```bash
cp .env.example .env
# PRIVATE_KEY needs a 0G Compute prepaid balance — see docs/packages/compute.

pnpm install
pnpm dev "What is 17 + 25? Use the add tool."
```

Sample output:

```
step 1: action=tool add
step 2: action=done

Agent result: final
  Answer: 42
  Steps : 2
    [1] tx=0xabc tool=add
    [2] tx=0xdef
```

## Walk through the code

- **`src/tools.ts`** — `ToolRegistry`. Register named handlers; the agent
  invokes them when the model emits `{"action":"tool","name":"…"}`.
- **`src/agent.ts`** — `runAgent(prompt, deps)`. Loops up to `maxSteps`:
  inference → verify attestation → parse decision → tool-or-done. Pure with
  respect to `deps` (compute client, tool registry, attestation verifier),
  so it tests offline.
- **`src/index.ts`** — wires real `Compute` + real `verifyEnvelope` from
  `0gkit-attestation`, registers a couple of demo tools, runs `runAgent`.

## SP10 (`@foundryprotocol/0gkit-jobs`) hand-off

The agent loop is intentionally shaped to map onto a durable job runner
one-to-one once SP10 ships. The plan is:

```ts
// today
const res = await compute.inference({ messages });

// SP10
const handle = await jobs.enqueue("agent-step", { messages });
const res = await handle.await();
```

The rest of the loop (verify, parse, invoke tool) stays put. The README
will be updated when SP10 lands.

## Run the tests

```bash
pnpm test
```

Tests inject `mockComputeClient()` + `fixtureAttestation()` from
`@foundryprotocol/0gkit-testing`. No network or compute balance needed.

## Next steps

- Replace the toy `add` tool with something real — a 0G Storage retrieval,
  a contract read, an HTTP call to your own API.
- Swap the JSON-decision protocol for OpenAI tool-calling once `0gkit-compute`
  exposes structured tool calls (tracked in SP9).
- Persist every step's attestation to 0G Storage so you have an auditable
  trail of the agent's reasoning.
```

- [ ] **Step 10: Commit**

```bash
git add templates/ai-agent
git commit -m "feat(templates): SP8 ai-agent — TEE-attested agent loop

ReAct-style multi-step agent on 0G Compute. Each inference step's TEE
attestation is verified before the model's decision is acted on; an
invalid attestation aborts the run.

In-process loop today; documented SP10 hand-off path for when the
durable job runner ships. Vitest covers all four branches (done,
tool, abort-on-max-steps, abort-on-bad-attestation) at >80% lines."
```

---

### Task 5: `tee-attested-api` template — Hono API with attestation header per response

**Files (all new):**
- `templates/tee-attested-api/package.json`
- `templates/tee-attested-api/tsconfig.json`
- `templates/tee-attested-api/vitest.config.ts`
- `templates/tee-attested-api/.env.example`
- `templates/tee-attested-api/src/index.ts`
- `templates/tee-attested-api/src/app.ts`
- `templates/tee-attested-api/src/middleware.ts`
- `templates/tee-attested-api/src/__tests__/app.test.ts`
- `templates/tee-attested-api/README.md`

- [ ] **Step 1: Write the failing test**

`templates/tee-attested-api/src/__tests__/app.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { mockComputeClient } from "@foundryprotocol/0gkit-testing/mocks";
import { fixtureAttestation } from "@foundryprotocol/0gkit-testing/fixtures";
import { buildApp } from "../app.js";

function makeDeps() {
  const compute = mockComputeClient();
  return {
    compute,
    getAttestation: vi.fn().mockResolvedValue(fixtureAttestation()),
    log: vi.fn(),
  };
}

describe("buildApp", () => {
  it("returns a JSON response with X-0G-Attestation header for /chat", async () => {
    const app = buildApp(makeDeps());
    const res = await app.request("/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "hello" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("X-0G-Attestation")).toBeTruthy();
    const body = (await res.json()) as { reply: string };
    expect(typeof body.reply).toBe("string");
  });

  it("includes the attestation header on /health too", async () => {
    const app = buildApp(makeDeps());
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-0G-Attestation")).toBeTruthy();
  });

  it("returns 400 when /chat is called without a prompt", async () => {
    const app = buildApp(makeDeps());
    const res = await app.request("/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("logs an access-log line per request", async () => {
    const deps = makeDeps();
    const app = buildApp(deps);
    await app.request("/health");
    expect(deps.log).toHaveBeenCalled();
    const line = (deps.log as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(line).toMatch(/GET \/health/);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter tee-attested-api vitest run`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "tee-attested-api",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "description": "Hono API where every response carries a TEE attestation header.",
  "scripts": {
    "dev": "tsx src/index.ts",
    "start": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "engines": {
    "node": ">=20.10"
  },
  "dependencies": {
    "@foundryprotocol/0gkit-core": "^0.3.0",
    "@foundryprotocol/0gkit-compute": "^0.3.0",
    "@foundryprotocol/0gkit-attestation": "^0.3.0",
    "@foundryprotocol/0gkit-wallet": "^0.3.0",
    "hono": "^4.6.0",
    "@hono/node-server": "^1.13.0"
  },
  "devDependencies": {
    "@foundryprotocol/0gkit-testing": "^0.3.0",
    "@types/node": "^22.0.0",
    "@vitest/coverage-v8": "^2.1.8",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 4: Create `src/middleware.ts`**

```ts
import type { Context, Next } from "hono";

export interface AttestationProvider {
  getAttestation(): Promise<unknown>;
}

/**
 * Hono middleware that attaches a serialized attestation envelope to every
 * response as the X-0G-Attestation header. The envelope is canonical JSON
 * (sorted keys, deterministic). Consumers can verify with
 * `@foundryprotocol/0gkit-attestation`'s `verifyAttestation`.
 */
export function withAttestation(provider: AttestationProvider) {
  return async (c: Context, next: Next) => {
    await next();
    const attestation = await provider.getAttestation();
    c.res.headers.set("X-0G-Attestation", JSON.stringify(attestation));
  };
}

export function withAccessLog(log: (m: string) => void) {
  return async (c: Context, next: Next) => {
    const start = Date.now();
    await next();
    const dur = Date.now() - start;
    log(`${c.req.method} ${c.req.path} ${c.res.status} ${dur}ms`);
  };
}
```

- [ ] **Step 5: Create `src/app.ts`** (the testable surface)

```ts
import { Hono } from "hono";
import type { Compute } from "@foundryprotocol/0gkit-compute";
import { withAttestation, withAccessLog, type AttestationProvider } from "./middleware.js";

export interface AppDeps extends AttestationProvider {
  compute: Pick<Compute, "inference">;
  log: (m: string) => void;
}

export function buildApp(deps: AppDeps): Hono {
  const app = new Hono();

  app.use("*", withAccessLog(deps.log));
  app.use("*", withAttestation(deps));

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/chat", async (c) => {
    const body = (await c.req.json()) as { prompt?: string };
    if (!body.prompt) {
      return c.json({ error: "missing prompt" }, 400);
    }
    const result = await deps.compute.inference({
      messages: [{ role: "user", content: body.prompt }],
    });
    const reply = result.choices[0]?.message?.content ?? "";
    return c.json({ reply });
  });

  return app;
}
```

- [ ] **Step 6: Create `src/index.ts`** (the thin entry)

```ts
/**
 * tee-attested-api — Hono server where every response is TEE-attested.
 *
 * SP11 (observability) hand-off: today we use plain `console.log` for the
 * access log and rely on the X-0G-Attestation response header. When SP11
 * lands, swap `log` for the structured logger + tracing emitter. The
 * attestation header stays.
 */
import { serve } from "@hono/node-server";
import { Compute } from "@foundryprotocol/0gkit-compute";
import { fromEnv } from "@foundryprotocol/0gkit-wallet";
import { ZeroGError } from "@foundryprotocol/0gkit-core";
import { fetchTeeQuote } from "@foundryprotocol/0gkit-attestation";
import { buildApp } from "./app.js";

async function main(): Promise<void> {
  const signer = await fromEnv({ name: "PRIVATE_KEY" });
  const network = (process.env.ZEROG_NETWORK ?? "galileo") as "galileo" | "aristotle";
  const compute = new Compute({ network, signer });

  // Pre-fetch the quote once at boot; refresh hourly.
  let cached: unknown = await fetchTeeQuote();
  setInterval(async () => {
    try {
      cached = await fetchTeeQuote();
    } catch (e) {
      console.error("attestation refresh failed:", e);
    }
  }, 60 * 60 * 1000);

  const app = buildApp({
    compute,
    getAttestation: async () => cached,
    log: (m) => console.log(m),
  });

  const port = Number(process.env.PORT ?? 8787);
  serve({ fetch: app.fetch, port });
  console.log(`tee-attested-api listening on http://localhost:${port}`);
  console.log(`  Every response carries an X-0G-Attestation header.`);
}

main().catch((err: unknown) => {
  if (err instanceof ZeroGError) {
    console.error(`\n${err.name}: ${err.message}`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
```

> **Note on `fetchTeeQuote`:** if `@foundryprotocol/0gkit-attestation` does not currently export a `fetchTeeQuote` function (verify via `grep "export" packages/0gkit-attestation/src/index.ts` before committing), replace the call with `fixtureAttestation` from `@foundryprotocol/0gkit-testing/fixtures` in `src/index.ts` and document in the README that the production code must wire up a real quote provider. The test surface in `app.ts` already accepts a generic `AttestationProvider`, so the swap is local to `index.ts`.

- [ ] **Step 7: Create config files**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["node", "vitest/globals"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true
  },
  "include": ["src/**/*.ts"]
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/**/__tests__/**"],
      thresholds: { lines: 80, branches: 70 },
    },
  },
});
```

`.env.example`:

```dotenv
PRIVATE_KEY=
ZEROG_NETWORK=galileo
PORT=8787
```

- [ ] **Step 8: Run tests + typecheck**

Run: `pnpm --filter tee-attested-api test && pnpm --filter tee-attested-api typecheck`
Expected: 4 tests pass, coverage ≥ 80/70, typecheck clean.

- [ ] **Step 9: Write `README.md`**

```markdown
# tee-attested-api — Hono API with TEE attestation on every response

A minimal Hono API where **every response** carries a TEE attestation in the
`X-0G-Attestation` header. Clients can verify the attestation cryptographically
to prove the response came from genuine enclave hardware.

Stack: `hono@^4` · `@foundryprotocol/0gkit-compute` ·
`@foundryprotocol/0gkit-attestation` · `@foundryprotocol/0gkit-wallet`.

## Endpoints

| Method | Path     | Returns                                |
| ------ | -------- | -------------------------------------- |
| GET    | `/health` | `{ ok: true }`                         |
| POST   | `/chat`   | `{ reply }` — runs prompt thru Compute |

Every response includes:

```
X-0G-Attestation: {"v":1,"quote":"…","signature":"…",…}
```

## Quickstart

```bash
cp .env.example .env
# PRIVATE_KEY pays for /chat's compute call.

pnpm install
pnpm dev
# → tee-attested-api listening on http://localhost:8787

curl -i -X POST http://localhost:8787/chat \
  -H 'content-type: application/json' \
  -d '{"prompt":"hello"}'
```

## Verifying the header on the client side

```ts
import { verifyAttestation } from "@foundryprotocol/0gkit-attestation";

const res = await fetch("http://localhost:8787/health");
const att = JSON.parse(res.headers.get("X-0G-Attestation")!);
await verifyAttestation(att); // throws if invalid
```

## Walk through the code

- **`src/middleware.ts`** — two Hono middlewares: `withAttestation` (attaches
  the X-0G-Attestation header to every response) and `withAccessLog` (one
  log line per request).
- **`src/app.ts`** — `buildApp(deps)` wires the middlewares onto a Hono app
  and registers `/health` and `/chat`. Pure with respect to `deps`.
- **`src/index.ts`** — production entry. Fetches the TEE quote once at boot
  and refreshes it hourly; wires the real `Compute` client.

## SP11 (`@foundryprotocol/0gkit-observability`) hand-off

Today this template uses plain `console.log` for the access log. When SP11
ships, the swap is one line:

```ts
// today
log: (m) => console.log(m),

// SP11
log: structuredLogger({ service: "tee-attested-api" }),
```

…and the attestation header gets a sibling `traceparent` for distributed
tracing.

## Run the tests

```bash
pnpm test
```

Uses `mockComputeClient` + `fixtureAttestation`; no live compute balance
required. All four branches (health, chat success, chat 400, access log
emission) covered at >80% lines.
```

- [ ] **Step 10: Commit**

```bash
git add templates/tee-attested-api
git commit -m "feat(templates): SP8 tee-attested-api — Hono API w/ attestation header

Every response carries X-0G-Attestation. Production wires fetchTeeQuote
into the middleware; tests inject fixtureAttestation. Documented SP11
hand-off path for observability."
```

---

### Task 6: `nft-with-storage` template — ERC-721 minter with metadata + media on 0G Storage

**Files (all new):**
- `templates/nft-with-storage/package.json`
- `templates/nft-with-storage/tsconfig.json`
- `templates/nft-with-storage/vitest.config.ts`
- `templates/nft-with-storage/foundry.toml`
- `templates/nft-with-storage/.env.example`
- `templates/nft-with-storage/contracts/StorageNFT.sol`
- `templates/nft-with-storage/scripts/Deploy.s.sol`
- `templates/nft-with-storage/src/index.ts`
- `templates/nft-with-storage/src/mint-flow.ts`
- `templates/nft-with-storage/src/metadata.ts`
- `templates/nft-with-storage/src/__tests__/mint-flow.test.ts`
- `templates/nft-with-storage/src/__tests__/metadata.test.ts`
- `templates/nft-with-storage/README.md`

- [ ] **Step 1: Write the failing tests**

`templates/nft-with-storage/src/__tests__/metadata.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildMetadata, parseMetadata } from "../metadata.js";

describe("metadata codec", () => {
  it("builds a valid ERC-721 metadata JSON", () => {
    const m = buildMetadata({
      name: "Genesis",
      description: "First mint.",
      mediaRoot: "0xabc",
    });
    expect(m.name).toBe("Genesis");
    expect(m.image).toBe("0g-storage://0xabc");
  });

  it("round-trips JSON encode + decode", () => {
    const m = buildMetadata({
      name: "Block #42",
      description: "Test mint.",
      mediaRoot: "0xdead",
    });
    const bytes = new TextEncoder().encode(JSON.stringify(m));
    expect(parseMetadata(bytes).name).toBe("Block #42");
  });

  it("rejects empty name", () => {
    expect(() =>
      buildMetadata({ name: "", description: "x", mediaRoot: "0xabc" })
    ).toThrow(/name/);
  });
});
```

`templates/nft-with-storage/src/__tests__/mint-flow.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { mockStorageClient } from "@foundryprotocol/0gkit-testing/mocks";
import { runMintFlow } from "../mint-flow.js";

describe("runMintFlow", () => {
  it("uploads media + metadata and calls mint with the metadata root", async () => {
    const storage = mockStorageClient();
    const mintCalls: { to: string; metadataRoot: string }[] = [];
    const result = await runMintFlow(
      {
        recipient: "0x0000000000000000000000000000000000000001",
        name: "Genesis",
        description: "First mint.",
        media: new Uint8Array([1, 2, 3, 4]),
      },
      {
        storage,
        mint: async (to, root) => {
          mintCalls.push({ to, metadataRoot: root });
          return { txHash: "0xfeed", latencyMs: 1 };
        },
        log: () => undefined,
      }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mintTx).toBe("0xfeed");
    expect(result.metadataRoot).toMatch(/^0x/);
    expect(mintCalls).toHaveLength(1);
    expect(mintCalls[0]?.metadataRoot).toBe(result.metadataRoot);
  });

  it("returns an error when the media upload fails", async () => {
    const storage = mockStorageClient();
    storage.upload = vi.fn(async () => {
      throw new Error("network down");
    });
    const result = await runMintFlow(
      {
        recipient: "0x0000000000000000000000000000000000000001",
        name: "X",
        description: "Y",
        media: new Uint8Array([1]),
      },
      {
        storage,
        mint: async () => ({ txHash: "0x", latencyMs: 1 }),
        log: () => undefined,
      }
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/upload/i);
  });
});
```

- [ ] **Step 2: Run tests to verify failures**

Run: `pnpm --filter nft-with-storage vitest run`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "nft-with-storage",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "description": "ERC-721 minter — metadata + media live on 0G Storage, typed-contract codegen.",
  "scripts": {
    "dev": "tsx src/index.ts",
    "start": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "build:contracts": "forge build --root .",
    "generate:contracts": "0g contracts generate --abi out/StorageNFT.sol/StorageNFT.json --out src/generated"
  },
  "engines": {
    "node": ">=20.10"
  },
  "dependencies": {
    "@foundryprotocol/0gkit-core": "^0.3.0",
    "@foundryprotocol/0gkit-storage": "^0.3.0",
    "@foundryprotocol/0gkit-contracts": "^0.3.0",
    "@foundryprotocol/0gkit-wallet": "^0.3.0",
    "@foundryprotocol/0gkit-cli": "^0.3.0",
    "viem": "^2.21.0"
  },
  "devDependencies": {
    "@foundryprotocol/0gkit-testing": "^0.3.0",
    "@types/node": "^22.0.0",
    "@vitest/coverage-v8": "^2.1.8",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 4: Create `contracts/StorageNFT.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Minimal ERC-721 with off-chain metadata pointing at 0G Storage. The
 * `tokenURI(tokenId)` is `0g-storage://<root>` where <root> is the Merkle
 * root of the metadata JSON returned by `0gkit-storage`.
 *
 * Not OpenZeppelin — kept inline so a template reader can read top-to-
 * bottom. Use OZ's audited implementation in production.
 */
contract StorageNFT {
    string public name;
    string public symbol;

    mapping(uint256 => address) private _owners;
    mapping(uint256 => bytes32) private _metadataRoots;
    uint256 public totalSupply;

    address public owner;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Minted(address indexed to, uint256 indexed tokenId, bytes32 metadataRoot);

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        owner = msg.sender;
    }

    function mint(address to, bytes32 metadataRoot) external returns (uint256 tokenId) {
        require(msg.sender == owner, "not owner");
        tokenId = totalSupply + 1;
        totalSupply = tokenId;
        _owners[tokenId] = to;
        _metadataRoots[tokenId] = metadataRoot;
        emit Transfer(address(0), to, tokenId);
        emit Minted(to, tokenId, metadataRoot);
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address o = _owners[tokenId];
        require(o != address(0), "nonexistent");
        return o;
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        bytes32 root = _metadataRoots[tokenId];
        require(root != bytes32(0), "nonexistent");
        return string(abi.encodePacked("0g-storage://", _bytes32ToHex(root)));
    }

    function _bytes32ToHex(bytes32 v) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory out = new bytes(2 + 64);
        out[0] = "0";
        out[1] = "x";
        for (uint256 i = 0; i < 32; i++) {
            uint8 b = uint8(v[i]);
            out[2 + 2 * i] = hexChars[b >> 4];
            out[3 + 2 * i] = hexChars[b & 0x0f];
        }
        return string(out);
    }
}
```

- [ ] **Step 5: Create `scripts/Deploy.s.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {StorageNFT} from "../contracts/StorageNFT.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        StorageNFT nft = new StorageNFT("0gkit Genesis", "0GKG");
        console.log("StorageNFT deployed at", address(nft));
        vm.stopBroadcast();
    }
}
```

- [ ] **Step 6: Create `foundry.toml`**

```toml
[profile.default]
src = "contracts"
out = "out"
libs = ["lib"]
solc_version = "0.8.20"
optimizer = true
optimizer_runs = 200
```

- [ ] **Step 7: Create `src/metadata.ts`**

```ts
export interface NftMetadataInput {
  name: string;
  description: string;
  mediaRoot: string;
}

export interface NftMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: { trait_type: string; value: string }[];
}

export function buildMetadata(input: NftMetadataInput): NftMetadata {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error("name must not be empty");
  }
  if (!input.mediaRoot.startsWith("0x")) {
    throw new Error("mediaRoot must be a hex Merkle root");
  }
  return {
    name: input.name,
    description: input.description,
    image: `0g-storage://${input.mediaRoot}`,
  };
}

export function parseMetadata(bytes: Uint8Array): NftMetadata {
  return JSON.parse(new TextDecoder().decode(bytes)) as NftMetadata;
}
```

- [ ] **Step 8: Create `src/mint-flow.ts`**

```ts
import type { Storage } from "@foundryprotocol/0gkit-storage";
import { buildMetadata } from "./metadata.js";

export interface MintFlowInput {
  recipient: string;
  name: string;
  description: string;
  media: Uint8Array;
}

export interface MintFlowDeps {
  storage: Pick<Storage, "upload">;
  mint: (
    to: string,
    metadataRoot: `0x${string}`
  ) => Promise<{ txHash: string; latencyMs: number }>;
  log: (m: string) => void;
}

export type MintFlowResult =
  | {
      ok: true;
      mediaRoot: string;
      metadataRoot: string;
      mintTx: string;
    }
  | { ok: false; reason: string };

export async function runMintFlow(
  input: MintFlowInput,
  deps: MintFlowDeps
): Promise<MintFlowResult> {
  const { storage, mint, log } = deps;
  let mediaRoot: string;
  try {
    const up = await storage.upload(input.media);
    mediaRoot = up.root;
    log(`Media uploaded: ${mediaRoot} (tx ${up.tx.txHash})`);
  } catch (e) {
    return {
      ok: false,
      reason: `media upload failed: ${(e as Error).message}`,
    };
  }

  let metadataRoot: string;
  try {
    const metadata = buildMetadata({
      name: input.name,
      description: input.description,
      mediaRoot,
    });
    const bytes = new TextEncoder().encode(JSON.stringify(metadata));
    const up = await storage.upload(bytes);
    metadataRoot = up.root;
    log(`Metadata uploaded: ${metadataRoot} (tx ${up.tx.txHash})`);
  } catch (e) {
    return {
      ok: false,
      reason: `metadata upload failed: ${(e as Error).message}`,
    };
  }

  try {
    const tx = await mint(input.recipient, metadataRoot as `0x${string}`);
    log(`Minted to ${input.recipient}: tx ${tx.txHash}`);
    return { ok: true, mediaRoot, metadataRoot, mintTx: tx.txHash };
  } catch (e) {
    return {
      ok: false,
      reason: `mint failed: ${(e as Error).message}`,
    };
  }
}
```

- [ ] **Step 9: Create `src/index.ts`**

```ts
/**
 * nft-with-storage — mint an ERC-721 whose metadata + media live on 0G.
 *
 * Workflow:
 *   1. forge build StorageNFT (run `pnpm build:contracts` once).
 *   2. 0g contracts generate (run `pnpm generate:contracts` after each build).
 *   3. Deploy the contract (forge script scripts/Deploy.s.sol).
 *   4. Set NFT_ADDRESS in .env; run `pnpm dev <recipient> <name> <path-to-media>`.
 */
import { readFile } from "node:fs/promises";
import { Storage } from "@foundryprotocol/0gkit-storage";
import { createTypedContract } from "@foundryprotocol/0gkit-contracts";
import { fromEnv } from "@foundryprotocol/0gkit-wallet";
import { ZeroGError } from "@foundryprotocol/0gkit-core";
import { runMintFlow } from "./mint-flow.js";

const STORAGE_NFT_ABI = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "metadataRoot", type: "bytes32" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
] as const;

async function main(): Promise<void> {
  const [recipient, name, mediaPath] = process.argv.slice(2);
  if (!recipient || !name || !mediaPath) {
    console.error("Usage: pnpm dev <recipient> <name> <media-path>");
    process.exit(2);
  }

  const signer = await fromEnv({ name: "PRIVATE_KEY" });
  const network = (process.env.ZEROG_NETWORK ?? "galileo") as "galileo" | "aristotle";
  const nftAddress = process.env.NFT_ADDRESS as `0x${string}` | undefined;
  if (!nftAddress) {
    console.error("Set NFT_ADDRESS in .env after running the deploy script.");
    process.exit(2);
  }

  const storage = new Storage({ network, signer });
  const contract = createTypedContract({
    abi: STORAGE_NFT_ABI,
    address: nftAddress,
    signer,
    network,
  });

  const media = new Uint8Array(await readFile(mediaPath));

  const result = await runMintFlow(
    {
      recipient,
      name,
      description: `Minted via the 0gkit nft-with-storage template.`,
      media,
    },
    {
      storage,
      mint: async (to, root) => {
        const receipt = await contract.write.mint([to as `0x${string}`, root]);
        return { txHash: receipt.txHash, latencyMs: receipt.latencyMs };
      },
      log: (m) => console.log(m),
    }
  );

  if (!result.ok) {
    console.error(`FAILED: ${result.reason}`);
    process.exit(1);
  }
  console.log("");
  console.log(`Mint OK.`);
  console.log(`  media    : 0g-storage://${result.mediaRoot}`);
  console.log(`  metadata : 0g-storage://${result.metadataRoot}`);
  console.log(`  tx       : ${result.mintTx}`);
}

main().catch((err: unknown) => {
  if (err instanceof ZeroGError) {
    console.error(`\n${err.name}: ${err.message}`);
    if (err.hint) console.error(`Hint: ${err.hint}`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
```

- [ ] **Step 10: Create config files**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["node", "vitest/globals"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true
  },
  "include": ["src/**/*.ts"]
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/**/__tests__/**", "src/generated/**"],
      thresholds: { lines: 80, branches: 70 },
    },
  },
});
```

`.env.example`:

```dotenv
PRIVATE_KEY=
ZEROG_NETWORK=galileo
NFT_ADDRESS=
```

- [ ] **Step 11: Run tests + typecheck**

Run: `pnpm --filter nft-with-storage test && pnpm --filter nft-with-storage typecheck`
Expected: 5 tests pass, coverage ≥ 80/70, typecheck clean.

- [ ] **Step 12: Write `README.md`**

```markdown
# nft-with-storage — ERC-721 minter with metadata + media on 0G Storage

Mint an ERC-721 token whose metadata JSON **and** media file both live on
**0G Storage** rather than IPFS or AWS. The `tokenURI` resolves to
`0g-storage://<root>` where `<root>` is the Merkle root returned by the
upload.

Stack: Foundry (contracts) · `@foundryprotocol/0gkit-storage` ·
`@foundryprotocol/0gkit-contracts` (typed contract codegen) ·
`@foundryprotocol/0gkit-wallet`.

## Workflow

```bash
# 1. Build the contract
pnpm build:contracts          # → forge build, writes out/StorageNFT.sol/...

# 2. Generate the typed TS client (SP4)
pnpm generate:contracts        # → src/generated/StorageNFT.ts

# 3. Deploy (Foundry script)
forge script scripts/Deploy.s.sol --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY

# 4. Configure
cp .env.example .env
# Paste the deployed StorageNFT address into NFT_ADDRESS.

# 5. Mint
pnpm dev 0x… "Genesis" ./my-image.png
```

## Walk through the code

- **`contracts/StorageNFT.sol`** — minimal ERC-721. `tokenURI(id)` returns
  `0g-storage://<metadataRoot>`. Inline implementation (no OZ) so a reader
  sees the whole thing top-to-bottom. Use OZ's audited base in production.
- **`scripts/Deploy.s.sol`** — Foundry deploy script.
- **`src/metadata.ts`** — pure ERC-721 metadata codec. Unit-tested.
- **`src/mint-flow.ts`** — `runMintFlow(input, deps)`. Two uploads (media,
  then metadata referencing the media root), then one on-chain mint. Pure
  with respect to `deps`. Returns either a success record or a structured
  error reason.
- **`src/index.ts`** — wires `Storage`, `createTypedContract`, and the
  deploy address; runs the flow.

## SP4 typed-contract codegen

`pnpm generate:contracts` runs `0g contracts generate --abi <forge-out>`.
The output is a deterministic TypeScript module under `src/generated/` that
gives you full IntelliSense for `mint`, `ownerOf`, `tokenURI`. You can use
the generated module directly *or* the inline ABI in `src/index.ts` — the
template ships the inline ABI for readability but the generated version
gives stronger types.

## Run the tests

```bash
pnpm test
```

Five tests cover the metadata codec (3) + the mint flow (2) using
`mockStorageClient` from `0gkit-testing`. No live chain or storage
required. Coverage ≥ 80/70.

## Production hardening checklist

- Replace the inline ERC-721 with [`@openzeppelin/contracts`](https://github.com/OpenZeppelin/openzeppelin-contracts).
- Add an off-chain metadata gateway that resolves `0g-storage://<root>` →
  the JSON for marketplaces (OpenSea-style) that expect HTTP(S).
- Move minting to a background queue once `@foundryprotocol/0gkit-jobs` (SP10)
  ships, so a slow upload doesn't time out a mint request.
```

- [ ] **Step 13: Commit**

```bash
git add templates/nft-with-storage
git commit -m "feat(templates): SP8 nft-with-storage — ERC-721 + 0G Storage

Foundry-based ERC-721 contract where tokenURI resolves to
0g-storage://<merkleRoot>. The TS minter uploads media, then metadata
(referencing the media root), then calls mint() via SP4 typed
contracts.

Vitest covers the metadata codec + mint flow at >80% lines."
```

---

### Task 7: Docs site — refresh `apps/docs/app/templates/page.mdx`

**File:**
- Modify: `apps/docs/app/templates/page.mdx`

- [ ] **Step 1: Read existing page**

Run: `cat apps/docs/app/templates/page.mdx`
Expected: existing page lists 5 templates with degit instructions.

- [ ] **Step 2: Rewrite the entire page**

Replace contents of `apps/docs/app/templates/page.mdx`:

```mdx
---
title: Templates
---

# Templates

0gkit ships **nine** starter projects so you can go from zero to a running
0G app in one command. Each is a minimal, correct, copy-and-go example
focused on one surface.

Grab any of them with `create-0gkit-app`:

```bash
npm create 0gkit-app@latest demo -- --template <name>
cd demo && pnpm install && pnpm dev
```

…or with `degit` if you want just the files:

```bash
npx degit rajkaria/0gkit/templates/<name> my-app
cd my-app && pnpm install
```

> The CLI also scaffolds a minimal read-only project with no template:
> `npx 0g init my-app`. Use that for a bare start; use a template below
> for a focused, surface-specific example.

---

## The five canonical archetypes (SP8)

### `chat`

Real-time chat where messages live on **0G Storage** and the on-chain
`MessagePosted` event log is the source of truth for the message list. Uses
the SP6 reorg-safe `useEvent` hook so rolled-back messages disappear
automatically.

```bash
npm create 0gkit-app@latest my-chat -- --template chat
```

Surfaces demoed: wallet + storage + indexer + react + typed contracts.
Best when: building anything where users post → the chain remembers.

### `storage-app`

A Node script that uploads a file to 0G Storage with **SP7 dry-run
preflight** (predicts cost + Merkle root before broadcasting), **dedup**
(skips the funding tx if the root already exists), and round-trip verify.

```bash
npm create 0gkit-app@latest my-store -- --template storage-app
```

Surfaces demoed: wallet + storage + SP7 estimator.
Best when: persisting datasets/artifacts to 0G.

### `ai-agent`

Multi-step **LangChain-style ReAct agent** on 0G Compute, where every
inference step's TEE attestation is verified before its decision is acted
on. In-process loop today; SP10 (`0gkit-jobs`) hand-off documented inline.

```bash
npm create 0gkit-app@latest my-agent -- --template ai-agent
```

Surfaces demoed: wallet + compute + attestation.
Best when: chained model reasoning with auditable enclave provenance.

### `tee-attested-api`

A **Hono** HTTP API where every response carries an `X-0G-Attestation`
header. Clients can verify cryptographically that the response originated
inside genuine enclave hardware. Plain `console.log` access logging today;
SP11 (`0gkit-observability`) hand-off documented inline.

```bash
npm create 0gkit-app@latest my-api -- --template tee-attested-api
```

Surfaces demoed: wallet + attestation + compute.
Best when: shipping a public API whose payloads need provenance.

### `nft-with-storage`

A Foundry-deployed ERC-721 where both the metadata JSON **and** the media
file live on 0G Storage. `tokenURI(id)` returns `0g-storage://<merkleRoot>`.
Uses SP4 typed-contract codegen.

```bash
npm create 0gkit-app@latest my-nft -- --template nft-with-storage
```

Surfaces demoed: wallet + storage + SP4 typed contracts.
Best when: minting collectibles with on-chain provenance + off-chain payloads.

---

## The other four (Phase 1 starters)

### `inference-app`

OpenAI-shaped chat completion against a 0G Compute provider, with the
on-chain fee receipt.

```bash
npm create 0gkit-app@latest my-infer -- --template inference-app
```

### `attestation-verify`

Pure-crypto attestation verifier (no network). Parse + verify a TEE
attestation envelope offline.

```bash
npm create 0gkit-app@latest my-verify -- --template attestation-verify
```

### `mcp-agent`

Expose 0G primitives (storage, compute, da, attestation) as MCP tools so
an LLM client can call them.

```bash
npm create 0gkit-app@latest my-mcp -- --template mcp-agent
```

### `react-app`

Next.js 16 App Router console wired to `0gkit-react` hooks (`useUpload`,
`useAttestation`).

```bash
npm create 0gkit-app@latest my-ui -- --template react-app
```
```

- [ ] **Step 3: Verify docs build**

Run: `pnpm --filter ./apps/docs build` (only if pnpm picks up the docs workspace; otherwise skip).
Expected: clean build, no MDX errors.

- [ ] **Step 4: Commit**

```bash
git add apps/docs/app/templates/page.mdx
git commit -m "docs(templates): SP8 — refresh templates page with five new archetypes

Expands from 5 → 9 starter projects. Promotes the five canonical
archetypes (chat, storage-app, ai-agent, tee-attested-api,
nft-with-storage) as the headline section; the four Phase-1 starters
move below."
```

---

### Task 8: CI smoke test — scaffold each template via fake fetcher, assert package.json + tsconfig present

**File:**
- Create: `packages/create-0g-app/src/__tests__/sp8-scaffold-smoke.test.ts`

- [ ] **Step 1: Write the smoke test**

```ts
import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../index.js";

/**
 * SP8 smoke test: every TEMPLATES entry must round-trip through `run` with
 * a fake fetcher that mimics giget by copying a known fixture tree. We
 * don't reach out to GitHub — we just assert the orchestrator handles each
 * template name correctly end-to-end.
 */
const TEMPLATES = [
  "storage-app",
  "inference-app",
  "attestation-verify",
  "mcp-agent",
  "react-app",
  "chat",
  "ai-agent",
  "tee-attested-api",
  "nft-with-storage",
];

describe("SP8 scaffold smoke", () => {
  it.each(TEMPLATES)("scaffolds %s end-to-end via fake fetcher", async (template) => {
    const root = await mkdtemp(join(tmpdir(), `sp8-${template}-`));
    const fakeFetch = async ({ dest }: { name: string; dest: string }) => {
      await mkdir(dest, { recursive: true });
      await writeFile(
        join(dest, "package.json"),
        JSON.stringify({ name: template, version: "0.1.0", type: "module" })
      );
      await writeFile(join(dest, "README.md"), `# ${template}\n`);
    };
    const code = await run(
      ["node", "create", "demo", "--template", template, "--no-install", "--no-git"],
      {
        cwd: root,
        log: () => undefined,
        err: () => undefined,
        fetchTemplate: fakeFetch,
        runInstall: async () => undefined,
        initGit: async () => ({ initialized: false }),
      }
    );
    expect(code).toBe(0);
    expect(existsSync(join(root, "demo", "package.json"))).toBe(true);
    const pkg = JSON.parse(await readFile(join(root, "demo", "package.json"), "utf8"));
    expect(pkg.name).toBe(template);
  });
});
```

- [ ] **Step 2: Run the smoke test**

Run: `pnpm --filter create-0g-app vitest run __tests__/sp8-scaffold-smoke.test.ts`
Expected: 9 tests pass.

- [ ] **Step 3: Run full create-0g-app suite + boundary check**

Run: `pnpm --filter create-0g-app test && pnpm boundary:check`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add packages/create-0g-app/src/__tests__/sp8-scaffold-smoke.test.ts
git commit -m "test(create-0g-app): SP8 — end-to-end scaffold smoke for all 9 templates

Parametric vitest run that injects a fake fetcher mimicking giget,
runs the full CLI orchestrator per template name, and asserts the
output tree (package.json present + name matches)."
```

---

### Task 9: Release prep — changeset, DECISIONS, roadmap mark, CLAUDE.md sync, PR open + squash-merge

**Files:**
- Create: `.changeset/sp8-templates.md`
- Modify: `docs/superpowers/DECISIONS.md`
- Modify: `docs/specs/2026-05-20-essentials-roadmap.md`
- Modify: `pnpm-workspace.yaml` (if templates not yet included)

- [ ] **Step 1: Add changeset**

`.changeset/sp8-templates.md`:

```markdown
---
"create-0gkit-app": minor
"create-0g-app": minor
---

SP8 — Template expansion: ship five canonical archetypes.

Adds `chat`, `ai-agent`, `tee-attested-api`, `nft-with-storage` to the
`--template` registry. Refreshes `storage-app` with SP7 dry-run preflight
and dedup. Default `OGKIT_TEMPLATE_REF` bumped from `v0.2.x` → `v0.3.x` so
new scaffolds resolve against `@foundryprotocol/0gkit-*@0.3.0`.

Each template ships a tutorial-style README, vitest tests via
`@foundryprotocol/0gkit-testing` mocks/fixtures, and a `pnpm dev` script
that integrates with `0g dev` where applicable.
```

- [ ] **Step 2: Append D24 + D25 + D26 to DECISIONS.md**

(Read current DECISIONS.md first to find the next decision number — if D23 is the last one, these are D24/D25/D26; otherwise renumber.)

Append:

```markdown
### D24 — Templates live under `templates/<name>/` with one folder per archetype

Five SP8 archetypes (`chat`, `storage-app` refresh, `ai-agent`,
`tee-attested-api`, `nft-with-storage`) added alongside the four Phase-1
templates. `create-0gkit-app` resolves them via `giget` from
`rajkaria/0gkit/templates/<name>#<TEMPLATE_REF>`. Default ref bumped to
`v0.3.x` for SP8 release.

**Why:** Existing `templates/<name>/` convention is established and
`giget` already does fragment-based fetching cleanly. No need to invent a
new monorepo layout.

### D25 — Each template's testable surface lives in `src/<flow>.ts`, not in the entry

E.g. `templates/chat/lib/message.ts`, `templates/ai-agent/src/agent.ts`,
`templates/nft-with-storage/src/mint-flow.ts`. The `src/index.ts` (or
`app/page.tsx` for Next templates) is the *thin entry* that wires real
dependencies. The flow file accepts a `deps` bag so tests inject
`mockStorageClient` / `mockComputeClient` / `fixtureAttestation` from
`@foundryprotocol/0gkit-testing` with no network.

**Why:** Templates double as tutorials. A reader can skim the entry
top-to-bottom to see what gets wired together, then drill into the flow
file to see the actual logic. The split also enforces the 80/70 vitest
gate — entry files are excluded from coverage thresholds because they're
config glue.

### D26 — SP10/SP11 hand-off paths documented inline in `ai-agent` and `tee-attested-api`

`ai-agent` runs the agent loop in-process today; the README documents
where `@foundryprotocol/0gkit-jobs` (SP10) will swap in once it ships
(per-step `compute.inference` becomes `jobs.enqueue("step", …)`).
`tee-attested-api` uses `console.log` for access logging today; the
README documents the `@foundryprotocol/0gkit-observability` (SP11)
swap (one-line replacement for the `log` dep).

**Why:** Honesty rule. Roadmap §SP8 originally listed SP10/SP11 as
dependencies; we don't ship templates that import packages that don't
exist, but we also don't ship templates that pretend the future doesn't
exist. Inline TODOs in the README + a `deps: { log, jobs? }` shape in the
flow file make the migration mechanical when SP10/SP11 land.
```

- [ ] **Step 3: Mark SP8 ✅ in `docs/specs/2026-05-20-essentials-roadmap.md`**

Find the SP8 section header and update its status line. Read the file first to find the exact pattern (it's likely a leading `✅`/`⏭` marker per SP). Match the style of SP6/SP7's completed markers.

- [ ] **Step 4: Update `pnpm-workspace.yaml`**

Read `pnpm-workspace.yaml`; if `templates/*` is not in the `packages:` list, append it. (Required so `pnpm --filter <template-name> ...` works in CI; otherwise the templates are stranded outside the workspace.)

Expected diff:

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "templates/*"   # ← new
```

- [ ] **Step 5: Run the full monorepo gate locally**

Run: `pnpm install && pnpm typecheck && pnpm boundary:check && pnpm test`
Expected: all green. Coverage gate is per-package; SP8 templates each pass their own 80/70 threshold.

- [ ] **Step 6: Push the branch**

```bash
git push -u origin sp8-templates
```

- [ ] **Step 7: Open the PR**

```bash
gh pr create --title "SP8 — Template expansion (chat, storage-app refresh, ai-agent, tee-attested-api, nft-with-storage)" --body "$(cat <<'EOF'
## Summary

Ships the five canonical SP8 archetype templates, wired into
`create-0gkit-app --template <name>`:

- **chat** (new) — Next.js 16 + wallet + storage + indexer + react. Reorg-safe message list via SP6 `useEvent`.
- **storage-app** (refresh) — adds SP7 dry-run preflight + dedup + vitest via `@foundryprotocol/0gkit-testing` mocks.
- **ai-agent** (new) — multi-step ReAct loop on 0G Compute, attestation-verified per step. SP10 (`0gkit-jobs`) hand-off documented inline.
- **tee-attested-api** (new) — Hono API w/ `X-0G-Attestation` header on every response. SP11 (`0gkit-observability`) hand-off documented inline.
- **nft-with-storage** (new) — Foundry ERC-721 where `tokenURI` resolves to `0g-storage://<merkleRoot>`. SP4 typed-contract codegen.

Plus:

- `apps/docs/app/templates/page.mdx` — refreshed with all 9 archetypes.
- CI smoke test in `create-0g-app` parametric across all 9 templates.
- DECISIONS D24/D25/D26 — template layout, deps-injection seam, SP10/SP11 hand-off doctrine.

## Test plan

- [x] `pnpm test` green across the monorepo
- [x] `pnpm typecheck` green
- [x] `pnpm boundary:check` green (no template imports `@foundryprotocol/*` from inside `packages/0gkit-*`; templates themselves consume from npm so neutrality is preserved)
- [x] Each new template's vitest suite passes its own 80/70 coverage gate
- [x] SP8 scaffold smoke test scaffolds all 9 templates end-to-end via fake fetcher

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 8: Wait for CI to pass, then squash-merge**

```bash
gh pr checks --watch
gh pr merge --squash --delete-branch
```

- [ ] **Step 9: Pull merged main, update Foundryprotocol `CLAUDE.md`**

```bash
git checkout main && git pull
```

Then update `/Users/rajkaria/Projects/Foundryprotocol/CLAUDE.md`:

- Mark SP8 ✅ in the "Phase 1+2+3 status" list (or the equivalent current list).
- Note that the `create-0gkit-app` minor bump and `create-0g-app` minor bump are pending publish (next changeset run).
- Move "Immediate next session" → SP9 error taxonomy.

Commit the doc update in the Foundryprotocol repo.

```bash
cd /Users/rajkaria/Projects/Foundryprotocol
git add CLAUDE.md
git commit -m "docs: SP8 template expansion shipped on 0gkit main"
git push
```

---

## Self-review (run before dispatching subagents)

**Spec coverage:**
- ✅ Five templates (chat, storage-app refresh, ai-agent, tee-attested-api, nft-with-storage) — Tasks 2-6
- ✅ Wired into `create-0gkit-app --template` — Task 1
- ✅ Vitest tests using `0gkit-testing` per template — Tasks 2-6 step 1/4
- ✅ `pnpm dev` invokes `0g dev` where applicable — Task 3 `predev`; ai-agent/tee-attested-api/nft-with-storage don't need it (no chain dep at dev time)
- ✅ Tutorial-style README per template — Tasks 2-6 step "README"
- ✅ Docs site `docs/templates/<name>` (rendered inline within `apps/docs/app/templates/page.mdx`, since the docs site uses a single-page index, not per-template pages) — Task 7. **Note:** if review later prefers per-template pages, that's a follow-up; the index page covers the success criterion.
- ✅ End-to-end smoke via `create-0gkit-app demo --template chat` — Task 8

**Placeholder scan:** No TBD / TODO / "fill in" / "similar to Task N" in any step.

**Type consistency:**
- `runStorageFlow` return type is consistent in Task 2 step 3 + tests step 4.
- `runAgent` `AgentResult` variants are consistent across Task 4 step 1 + 5.
- `runMintFlow` `MintFlowResult` consistent across Task 6 step 1 + 8.
- `buildApp` deps interface consistent across Task 5 step 1 + 5.
- `TEMPLATES` array length (9) consistent across Tasks 1 + 8.

**Reality checks (must verify before implementation):**
- `@foundryprotocol/0gkit-attestation` exports: confirm `verifyAttestation` (not `verifyEnvelope`) and `fetchTeeQuote` exist; adjust imports if names differ. Task 4 step 6 and Task 5 step 6 use the suspected names — the implementer **must** `grep` the package's `src/index.ts` first and update the import if needed. (Honesty rule: no fabrication.)
- `Compute.inference` return shape — confirm it includes `{ choices, receipt, attestation }`. If `attestation` is at a different path, adjust Task 4 step 5 + step 6 + tests.
- `Storage.upload` return — confirmed shape from SP7: `{ root, tx: { txHash, latencyMs } }` for live; `{ dryRun: true, estimate, result: { root, ... } }` for dry-run. Task 2 step 3 uses both.
- `createTypedContract.write.<method>` return type: `Receipt` shape (`{ txHash, latencyMs, blockNumber? }`). Task 3 step 10 + Task 6 step 9 assume this.
- `mockComputeClient.inference` default behavior — if it doesn't return `attestation`, Task 4 step 1 overrides it via `vi.fn().mockResolvedValue(...)`. If the mock returns no `choices`, the agent test's parser would fall through to the "done with raw" branch — Task 4 step 5 handles that already.

If any reality check turns up a mismatch, fix the affected step inline before committing the task.

---

## Execution

**Plan complete and saved to `docs/superpowers/plans/2026-05-22-sp8-template-expansion.md`.**

**Subagent-driven execution recommended.** Suggested dispatch:
- Sequential: Task 1 (CLI scaffolding) — must land first.
- Parallel: Tasks 2-6 (five templates) — one subagent each, after Task 1 lands.
- Sequential: Tasks 7-9 (docs, CI smoke, release prep) — after all template tasks land.
