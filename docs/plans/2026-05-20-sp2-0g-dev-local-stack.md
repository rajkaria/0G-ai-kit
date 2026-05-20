# SP2 — `0g dev` Local Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `0g dev` — a local chain + storage + compute + DA stack that starts in ≤5s, prefunds 10 dev wallets, and is byte-compatible with the live network's client API so apps need zero code changes to flip between `local` and `galileo`.

**Architecture:** A new private package `@foundryprotocol/0gkit-devnet` owns the four mock servers (Node HTTP, no framework dependency); a new `0g dev` subcommand group in `@foundryprotocol/0gkit-cli` orchestrates lifecycle; `@foundryprotocol/0gkit-core` gains a `local` network preset. Anvil (shelled out, not vendored) provides the EVM chain; storage/compute/DA mocks are bespoke (they implement the same wire protocol as the real services).

**Tech Stack:** Node 20+, TypeScript 5.6, `commander@^14`, `viem`, `execa` (anvil spawning), Node `node:http` (no Express — keep deps thin), `zod` (HTTP body validation), `vitest`, `tsup`.

**Decisions referenced:** D6 (filesystem CAS), D2 (workspace tooling), D4 (CLI conventions).

**Co-ships with:** SP1 (`create-0g-app`). Release together as `0gkit-cli@0.2.0` + `0gkit-core@0.2.0` + new `0gkit-devnet@0.1.0`.

---

## File Structure

**Create:**

- `packages/0gkit-devnet/package.json`
- `packages/0gkit-devnet/tsup.config.ts`
- `packages/0gkit-devnet/tsconfig.json`
- `packages/0gkit-devnet/vitest.config.ts`
- `packages/0gkit-devnet/README.md`
- `packages/0gkit-devnet/src/index.ts` — public exports
- `packages/0gkit-devnet/src/types.ts` — `DevnetConfig`, `DevnetHandle`, `ServiceStatus`
- `packages/0gkit-devnet/src/anvil.ts` — anvil binary detection + spawn helper
- `packages/0gkit-devnet/src/storage-mock.ts` — HTTP server, filesystem CAS, Merkle root
- `packages/0gkit-devnet/src/compute-mock.ts` — OpenAI-compatible HTTP server + Ollama detect
- `packages/0gkit-devnet/src/da-mock.ts` — in-memory canonical-digest store + HTTP
- `packages/0gkit-devnet/src/state.ts` — `~/.0g-dev/devnet.json` PID + ports file
- `packages/0gkit-devnet/src/accounts.ts` — deterministic HD mnemonic → 10 funded keys
- `packages/0gkit-devnet/src/merkle.ts` — re-export from `0gkit-storage` (no circular dep — devnet depends on storage; storage doesn't depend on devnet)
- `packages/0gkit-devnet/src/__tests__/storage-mock.test.ts`
- `packages/0gkit-devnet/src/__tests__/compute-mock.test.ts`
- `packages/0gkit-devnet/src/__tests__/da-mock.test.ts`
- `packages/0gkit-devnet/src/__tests__/anvil.test.ts`
- `packages/0gkit-devnet/src/__tests__/state.test.ts`
- `packages/0gkit-devnet/src/__tests__/conformance.test.ts` — runs storage primitive against mock, asserts same shape as galileo path
- `packages/0gkit-cli/src/commands/dev.ts`
- `packages/0gkit-cli/src/commands/dev-status.ts`
- `packages/0gkit-cli/src/commands/dev-stop.ts`
- `packages/0gkit-cli/src/commands/dev-reset.ts`
- `packages/0gkit-cli/src/commands/dev-fund.ts`
- `packages/0gkit-cli/src/__tests__/dev.test.ts`
- `.changeset/sp2-0g-dev.md`
- `apps/docs/app/cli/dev/page.mdx`

**Modify:**

- `packages/0gkit-core/src/networks.ts` — add `local` preset
- `packages/0gkit-core/src/networks.test.ts` — assert local preset shape
- `packages/0gkit-cli/src/program.ts` — register `dev` subcommand group
- `packages/0gkit-cli/package.json` — add `@foundryprotocol/0gkit-devnet` dep
- `pnpm-workspace.yaml` — already globs `packages/*`, nothing to change
- `turbo.json` — already pipelines `build` `test` `typecheck`; new package picks them up
- `.github/workflows/ci.yml` — extend coverage filter
- `README.md` (root) — add `0g dev` blurb
- `apps/docs/app/cli/page.mdx` — link to new `/cli/dev` page

---

### Task 1: Bootstrap `@foundryprotocol/0gkit-devnet` package

**Files:**

- Create: `packages/0gkit-devnet/package.json`
- Create: `packages/0gkit-devnet/tsconfig.json`
- Create: `packages/0gkit-devnet/tsup.config.ts`
- Create: `packages/0gkit-devnet/vitest.config.ts`
- Create: `packages/0gkit-devnet/src/index.ts`
- Create: `packages/0gkit-devnet/README.md`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "@foundryprotocol/0gkit-devnet",
  "version": "0.1.0",
  "private": false,
  "description": "Local chain + storage + compute + DA stack for 0G app development.",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } },
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "clean": "rimraf dist"
  },
  "dependencies": {
    "@foundryprotocol/0gkit-core": "workspace:*",
    "@foundryprotocol/0gkit-storage": "workspace:*",
    "execa": "^9.0.0",
    "viem": "^2.21.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "rimraf": "^6.0.1",
    "tsup": "^8.3.0",
    "typescript": "^5.6.3",
    "vitest": "^2.1.0",
    "@vitest/coverage-v8": "^2.1.0"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Write `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`**

`tsconfig.json` (copy of `packages/0gkit-storage/tsconfig.json`).
`tsup.config.ts`:

```ts
import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
});
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    globals: false,
    coverage: {
      provider: "v8",
      thresholds: { lines: 80, branches: 70, statements: 80, functions: 80 },
    },
  },
});
```

- [ ] **Step 3: Write a minimal `src/index.ts`**

```ts
export const VERSION = "0.1.0";
```

- [ ] **Step 4: Verify build + typecheck**

Run: `pnpm --filter @foundryprotocol/0gkit-devnet build && pnpm --filter @foundryprotocol/0gkit-devnet typecheck`
Expected: both exit 0; `dist/index.js` and `dist/index.d.ts` exist.

- [ ] **Step 5: Commit**

```bash
git add packages/0gkit-devnet
git commit -m "feat(devnet): bootstrap @foundryprotocol/0gkit-devnet package"
```

---

### Task 2: `anvil` detection + spawn helper

**Files:**

- Create: `packages/0gkit-devnet/src/anvil.ts`
- Create: `packages/0gkit-devnet/src/__tests__/anvil.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { detectAnvil, AnvilNotInstalledError } from "../anvil.js";

describe("detectAnvil", () => {
  it("returns a path when anvil is on PATH", async () => {
    const path = await detectAnvil();
    expect(path).toMatch(/anvil$/);
  });

  it("throws AnvilNotInstalledError with install hint when missing", async () => {
    await expect(detectAnvil({ pathOverride: "/nope/anvil" })).rejects.toBeInstanceOf(
      AnvilNotInstalledError
    );
    await expect(detectAnvil({ pathOverride: "/nope/anvil" })).rejects.toThrow(
      /curl -L https:\/\/foundry.paradigm.xyz/
    );
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `pnpm --filter @foundryprotocol/0gkit-devnet test`
Expected: FAIL — `Cannot find module '../anvil.js'`.

- [ ] **Step 3: Implement `anvil.ts`**

```ts
import { execa } from "execa";
import { ZeroGError } from "@foundryprotocol/0gkit-core";

export class AnvilNotInstalledError extends ZeroGError {
  constructor() {
    super({
      code: "DEVNET_ANVIL_NOT_INSTALLED",
      message:
        "anvil (from foundry) is required for `0g dev`. Install it with:\n" +
        "  curl -L https://foundry.paradigm.xyz | bash && foundryup",
      helpUrl: "https://0gkit.dev/errors/DEVNET_ANVIL_NOT_INSTALLED",
    });
  }
}

export async function detectAnvil(
  opts: { pathOverride?: string } = {}
): Promise<string> {
  const candidate = opts.pathOverride ?? "anvil";
  try {
    const { stdout } = await execa(candidate, ["--version"], { reject: false });
    if (!stdout.includes("anvil")) throw new AnvilNotInstalledError();
    return candidate;
  } catch {
    throw new AnvilNotInstalledError();
  }
}

export interface AnvilProcess {
  url: string;
  chainId: number;
  pid: number;
  stop(): Promise<void>;
}

export async function spawnAnvil(opts: {
  port: number;
  mnemonic: string;
  accounts: number;
}): Promise<AnvilProcess> {
  await detectAnvil();
  const child = execa(
    "anvil",
    [
      "--port",
      String(opts.port),
      "--mnemonic",
      opts.mnemonic,
      "--accounts",
      String(opts.accounts),
      "--block-time",
      "1",
      "--silent",
    ],
    { stdio: "ignore", detached: false }
  );
  // Wait for RPC to be ready (poll).
  const url = `http://127.0.0.1:${opts.port}`;
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(url, {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_chainId",
          params: [],
          id: 1,
        }),
        headers: { "content-type": "application/json" },
      });
      if (r.ok) {
        const { result } = (await r.json()) as { result: string };
        return {
          url,
          chainId: parseInt(result, 16),
          pid: child.pid!,
          stop: async () => {
            child.kill("SIGTERM");
          },
        };
      }
    } catch {
      /* keep polling */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill("SIGTERM");
  throw new ZeroGError({
    code: "DEVNET_ANVIL_START_TIMEOUT",
    message: `anvil failed to come up on ${url} within 5s`,
    helpUrl: "https://0gkit.dev/errors/DEVNET_ANVIL_START_TIMEOUT",
  });
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `pnpm --filter @foundryprotocol/0gkit-devnet test`
Expected: 2/2 pass. (If anvil isn't on PATH, the `detectAnvil` happy-path test should be skipped with `it.skipIf(!process.env.CI_HAS_ANVIL)` — add that guard before commit.)

- [ ] **Step 5: Commit**

```bash
git add packages/0gkit-devnet/src/anvil.ts packages/0gkit-devnet/src/__tests__/anvil.test.ts
git commit -m "feat(devnet): anvil binary detection + spawn helper"
```

---

### Task 3: Deterministic dev accounts (HD mnemonic → 10 funded keys)

**Files:**

- Create: `packages/0gkit-devnet/src/accounts.ts`
- Create: `packages/0gkit-devnet/src/__tests__/accounts.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { deriveAccounts, DEFAULT_DEV_MNEMONIC } from "../accounts.js";

describe("deriveAccounts", () => {
  it("produces 10 deterministic addresses from the default mnemonic", () => {
    const a = deriveAccounts({ count: 10 });
    const b = deriveAccounts({ count: 10 });
    expect(a).toEqual(b);
    expect(a).toHaveLength(10);
    expect(a[0].address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(a[0].privateKey).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  it("respects custom mnemonic", () => {
    const a = deriveAccounts({
      count: 2,
      mnemonic: "test test test test test test test test test test test junk",
    });
    const b = deriveAccounts({ count: 2, mnemonic: DEFAULT_DEV_MNEMONIC });
    expect(a[0].address).not.toEqual(b[0].address);
  });
});
```

- [ ] **Step 2: Confirm failure**

Run: `pnpm --filter @foundryprotocol/0gkit-devnet test accounts`
Expected: module-not-found.

- [ ] **Step 3: Implement `accounts.ts`**

```ts
import { mnemonicToAccount } from "viem/accounts";

export const DEFAULT_DEV_MNEMONIC =
  "test test test test test test test test test test test junk"; // standard anvil dev mnemonic

export interface DevAccount {
  index: number;
  address: `0x${string}`;
  privateKey: `0x${string}`;
}

export function deriveAccounts(
  opts: { count: number; mnemonic?: string } = { count: 10 }
): DevAccount[] {
  const m = opts.mnemonic ?? DEFAULT_DEV_MNEMONIC;
  const out: DevAccount[] = [];
  for (let i = 0; i < opts.count; i++) {
    const acct = mnemonicToAccount(m, { addressIndex: i });
    out.push({
      index: i,
      address: acct.address,
      privateKey: (
        acct as unknown as { getHdKey(): { privateKey: Uint8Array } }
      ).getHdKey().privateKey
        ? (("0x" +
            Buffer.from((acct as any).getHdKey().privateKey).toString(
              "hex"
            )) as `0x${string}`)
        : (("0x" + "00".repeat(32)) as `0x${string}`), // placeholder; replaced below
    });
  }
  return out;
}
```

(Note for implementer: viem's `mnemonicToAccount` returns an `HDAccount` with `.getHdKey()`. Use the actual API — adjust the typing accordingly. The test asserts the shape; the implementation must match. Verify with `viem` v2.21 docs.)

- [ ] **Step 4: Run tests, iterate until pass**

Run: `pnpm --filter @foundryprotocol/0gkit-devnet test accounts`
Expected: 2/2 pass.

- [ ] **Step 5: Commit**

```bash
git add packages/0gkit-devnet/src/accounts.ts packages/0gkit-devnet/src/__tests__/accounts.test.ts
git commit -m "feat(devnet): deterministic dev accounts from HD mnemonic"
```

---

### Task 4: Storage mock — HTTP server + filesystem CAS

**Files:**

- Create: `packages/0gkit-devnet/src/storage-mock.ts`
- Create: `packages/0gkit-devnet/src/__tests__/storage-mock.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startStorageMock, StorageMockHandle } from "../storage-mock.js";

describe("storage-mock", () => {
  let dir: string;
  let mock: StorageMockHandle;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "devnet-storage-"));
    mock = await startStorageMock({ port: 0, stateDir: dir });
  });

  afterEach(async () => {
    await mock.stop();
    rmSync(dir, { recursive: true, force: true });
  });

  it("uploads bytes and returns a Merkle root", async () => {
    const body = new TextEncoder().encode("hello 0g");
    const r = await fetch(`${mock.url}/upload`, { method: "POST", body });
    expect(r.status).toBe(200);
    const { root } = (await r.json()) as { root: string };
    expect(root).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("downloads previously-uploaded bytes by root", async () => {
    const body = new TextEncoder().encode("round trip");
    const up = await fetch(`${mock.url}/upload`, { method: "POST", body });
    const { root } = (await up.json()) as { root: string };
    const dl = await fetch(`${mock.url}/download/${root}`);
    expect(dl.status).toBe(200);
    const got = new Uint8Array(await dl.arrayBuffer());
    expect(new TextDecoder().decode(got)).toBe("round trip");
  });

  it("returns 404 for unknown root", async () => {
    const r = await fetch(`${mock.url}/download/0x${"0".repeat(64)}`);
    expect(r.status).toBe(404);
  });
});
```

- [ ] **Step 2: Confirm failure**

Run: `pnpm --filter @foundryprotocol/0gkit-devnet test storage-mock`

- [ ] **Step 3: Implement `storage-mock.ts`**

```ts
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { computeMerkleRoot } from "@foundryprotocol/0gkit-storage";

export interface StorageMockHandle {
  url: string;
  port: number;
  stop(): Promise<void>;
}

export async function startStorageMock(opts: {
  port: number;
  stateDir: string;
}): Promise<StorageMockHandle> {
  mkdirSync(opts.stateDir, { recursive: true });

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.method === "POST" && req.url === "/upload") {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const bytes = Buffer.concat(chunks);
        const root = await computeMerkleRoot(bytes);
        writeFileSync(join(opts.stateDir, root), bytes);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ root, size: bytes.length }));
        return;
      }
      if (req.method === "GET" && req.url?.startsWith("/download/")) {
        const root = req.url.slice("/download/".length);
        const path = join(opts.stateDir, root);
        if (!existsSync(path)) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, { "content-type": "application/octet-stream" });
        res.end(readFileSync(path));
        return;
      }
      res.writeHead(404);
      res.end();
    } catch (e) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: (e as Error).message }));
    }
  });

  await new Promise<void>((r) => server.listen(opts.port, "127.0.0.1", r));
  const addr = server.address();
  if (!addr || typeof addr === "string")
    throw new Error("server.address() returned unexpected");
  const port = addr.port;

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    stop: () => new Promise<void>((r) => server.close(() => r())),
  };
}
```

(Implementer note: `computeMerkleRoot` may need to be exported from `0gkit-storage`. If it isn't, the prerequisite step is to add it as a public export and write a unit test for it in `0gkit-storage` first — this gives the conformance test a single source of truth for root computation.)

- [ ] **Step 4: Run tests, confirm pass**

Run: `pnpm --filter @foundryprotocol/0gkit-devnet test storage-mock`
Expected: 3/3 pass.

- [ ] **Step 5: Commit**

```bash
git add packages/0gkit-devnet/src/storage-mock.ts packages/0gkit-devnet/src/__tests__/storage-mock.test.ts
git commit -m "feat(devnet): storage mock HTTP server with filesystem CAS"
```

---

### Task 5: Compute mock — OpenAI-compatible HTTP + Ollama detect

**Files:**

- Create: `packages/0gkit-devnet/src/compute-mock.ts`
- Create: `packages/0gkit-devnet/src/__tests__/compute-mock.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startComputeMock, ComputeMockHandle } from "../compute-mock.js";

describe("compute-mock", () => {
  let mock: ComputeMockHandle;
  beforeEach(async () => {
    mock = await startComputeMock({ port: 0, mode: "stub" });
  });
  afterEach(async () => {
    await mock.stop();
  });

  it("serves /v1/chat/completions in OpenAI shape (stub mode)", async () => {
    const r = await fetch(`${mock.url}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "0g/stub",
        messages: [{ role: "user", content: "ping" }],
      }),
    });
    expect(r.status).toBe(200);
    const json = (await r.json()) as {
      choices: { message: { role: string; content: string } }[];
    };
    expect(json.choices[0].message.role).toBe("assistant");
    expect(json.choices[0].message.content).toContain("[MOCK]");
    expect(json.choices[0].message.content).toContain("ping");
  });

  it("serves /v1/models", async () => {
    const r = await fetch(`${mock.url}/v1/models`);
    expect(r.status).toBe(200);
    const j = (await r.json()) as { data: { id: string }[] };
    expect(j.data.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Confirm failure**

Run: `pnpm --filter @foundryprotocol/0gkit-devnet test compute-mock`

- [ ] **Step 3: Implement `compute-mock.ts`**

```ts
import { createServer, IncomingMessage, ServerResponse } from "node:http";

export interface ComputeMockHandle {
  url: string;
  port: number;
  stop(): Promise<void>;
}
export type ComputeMockMode = "stub" | "ollama";

async function detectOllama(): Promise<string | null> {
  try {
    const r = await fetch("http://127.0.0.1:11434/api/tags", {
      signal: AbortSignal.timeout(500),
    });
    return r.ok ? "http://127.0.0.1:11434" : null;
  } catch {
    return null;
  }
}

async function readJson<T = unknown>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

export async function startComputeMock(opts: {
  port: number;
  mode?: ComputeMockMode;
}): Promise<ComputeMockHandle> {
  const mode: ComputeMockMode =
    opts.mode ?? ((await detectOllama()) ? "ollama" : "stub");

  const server = createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/v1/models") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ data: [{ id: "0g/stub", object: "model" }] }));
        return;
      }
      if (req.method === "POST" && req.url === "/v1/chat/completions") {
        const body = await readJson<{
          model: string;
          messages: { role: string; content: string }[];
        }>(req);
        const last = body.messages[body.messages.length - 1]?.content ?? "";
        const content =
          mode === "stub" ? `[MOCK] echoing: ${last}` : await callOllama(last);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            id: `mock-${Date.now()}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: body.model,
            choices: [
              {
                index: 0,
                message: { role: "assistant", content },
                finish_reason: "stop",
              },
            ],
            usage: {
              prompt_tokens: last.length,
              completion_tokens: content.length,
              total_tokens: last.length + content.length,
            },
          })
        );
        return;
      }
      res.writeHead(404);
      res.end();
    } catch (e) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: (e as Error).message }));
    }
  });

  await new Promise<void>((r) => server.listen(opts.port, "127.0.0.1", r));
  const addr = server.address();
  if (!addr || typeof addr === "string")
    throw new Error("server.address() returned unexpected");
  const port = addr.port;

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    stop: () => new Promise<void>((r) => server.close(() => r())),
  };
}

async function callOllama(prompt: string): Promise<string> {
  const r = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "llama3", prompt, stream: false }),
  });
  if (!r.ok) return `[MOCK ollama unreachable] ${prompt}`;
  const j = (await r.json()) as { response: string };
  return j.response;
}
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `pnpm --filter @foundryprotocol/0gkit-devnet test compute-mock`
Expected: 2/2 pass.

- [ ] **Step 5: Commit**

```bash
git add packages/0gkit-devnet/src/compute-mock.ts packages/0gkit-devnet/src/__tests__/compute-mock.test.ts
git commit -m "feat(devnet): compute mock OpenAI-compatible HTTP server"
```

---

### Task 6: DA mock — in-memory canonical-digest store

**Files:**

- Create: `packages/0gkit-devnet/src/da-mock.ts`
- Create: `packages/0gkit-devnet/src/__tests__/da-mock.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startDaMock, DaMockHandle } from "../da-mock.js";

describe("da-mock", () => {
  let mock: DaMockHandle;
  beforeEach(async () => {
    mock = await startDaMock({ port: 0 });
  });
  afterEach(async () => {
    await mock.stop();
  });

  it("publish returns a digest", async () => {
    const r = await fetch(`${mock.url}/publish`, {
      method: "POST",
      body: new Uint8Array([1, 2, 3]),
    });
    expect(r.status).toBe(200);
    const { digest } = (await r.json()) as { digest: string };
    expect(digest).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("verify returns true for known digest", async () => {
    const up = await fetch(`${mock.url}/publish`, {
      method: "POST",
      body: new Uint8Array([9, 8, 7]),
    });
    const { digest } = (await up.json()) as { digest: string };
    const v = await fetch(`${mock.url}/verify/${digest}`);
    expect(v.status).toBe(200);
    expect(await v.json()).toEqual({ available: true });
  });

  it("verify returns false for unknown digest", async () => {
    const v = await fetch(`${mock.url}/verify/0x${"0".repeat(64)}`);
    expect(await v.json()).toEqual({ available: false });
  });
});
```

- [ ] **Step 2: Confirm failure**

Run: `pnpm --filter @foundryprotocol/0gkit-devnet test da-mock`

- [ ] **Step 3: Implement `da-mock.ts`**

```ts
import { createServer } from "node:http";
import { createHash } from "node:crypto";

export interface DaMockHandle {
  url: string;
  port: number;
  stop(): Promise<void>;
}

export async function startDaMock(opts: { port: number }): Promise<DaMockHandle> {
  const store = new Map<string, Buffer>();

  const server = createServer(async (req, res) => {
    try {
      if (req.method === "POST" && req.url === "/publish") {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const bytes = Buffer.concat(chunks);
        const digest = "0x" + createHash("sha256").update(bytes).digest("hex");
        store.set(digest, bytes);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ digest, size: bytes.length }));
        return;
      }
      if (req.method === "GET" && req.url?.startsWith("/verify/")) {
        const digest = req.url.slice("/verify/".length);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ available: store.has(digest) }));
        return;
      }
      res.writeHead(404);
      res.end();
    } catch (e) {
      res.writeHead(500);
      res.end((e as Error).message);
    }
  });

  await new Promise<void>((r) => server.listen(opts.port, "127.0.0.1", r));
  const addr = server.address();
  if (!addr || typeof addr === "string")
    throw new Error("server.address() returned unexpected");
  return {
    url: `http://127.0.0.1:${addr.port}`,
    port: addr.port,
    stop: () => new Promise<void>((r) => server.close(() => r())),
  };
}
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @foundryprotocol/0gkit-devnet test da-mock
git add packages/0gkit-devnet/src/da-mock.ts packages/0gkit-devnet/src/__tests__/da-mock.test.ts
git commit -m "feat(devnet): DA mock in-memory canonical-digest store"
```

---

### Task 7: PID + ports state file (`~/.0g-dev/devnet.json`)

**Files:**

- Create: `packages/0gkit-devnet/src/state.ts`
- Create: `packages/0gkit-devnet/src/__tests__/state.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeState, readState, clearState, DevnetState } from "../state.js";

describe("devnet state file", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "devnet-state-"));
  });

  it("round-trips a state object", () => {
    const s: DevnetState = {
      pid: 12345,
      startedAt: new Date().toISOString(),
      chain: { url: "http://127.0.0.1:8545", chainId: 31337, pid: 11111 },
      storage: { url: "http://127.0.0.1:5678", port: 5678 },
      compute: { url: "http://127.0.0.1:5679", port: 5679 },
      da: { url: "http://127.0.0.1:5680", port: 5680 },
      accounts: [
        {
          index: 0,
          address: "0xabc",
          privateKey: "0xdef",
        } as DevnetState["accounts"][number],
      ],
      mnemonic: "test test test test test test test test test test test junk",
      stateDir: dir,
    };
    writeState(s, { dir });
    expect(readState({ dir })).toEqual(s);
  });

  it("returns null when no state exists", () => {
    expect(readState({ dir })).toBeNull();
  });

  it("clearState removes the file", () => {
    writeState({ pid: 1 } as DevnetState, { dir });
    clearState({ dir });
    expect(readState({ dir })).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Confirm failure → Step 3: Implement → Step 4: Run → Step 5: Commit**

```ts
// state.ts
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface DevnetService {
  url: string;
  port: number;
}
export interface DevnetChainService extends DevnetService {
  chainId: number;
  pid: number;
}
export interface DevnetAccount {
  index: number;
  address: `0x${string}`;
  privateKey: `0x${string}`;
}
export interface DevnetState {
  pid: number;
  startedAt: string;
  chain: DevnetChainService;
  storage: DevnetService;
  compute: DevnetService;
  da: DevnetService;
  accounts: DevnetAccount[];
  mnemonic: string;
  stateDir: string;
}

function file(dir?: string) {
  return join(dir ?? join(homedir(), ".0g-dev"), "devnet.json");
}

export function writeState(s: DevnetState, opts: { dir?: string } = {}) {
  const p = file(opts.dir);
  mkdirSync(join(p, "..").replace(/\/devnet\.json\/?$/, ""), { recursive: true });
  writeFileSync(p, JSON.stringify(s, null, 2));
}
export function readState(opts: { dir?: string } = {}): DevnetState | null {
  const p = file(opts.dir);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as DevnetState) : null;
}
export function clearState(opts: { dir?: string } = {}) {
  const p = file(opts.dir);
  if (existsSync(p)) rmSync(p);
}
```

```bash
pnpm --filter @foundryprotocol/0gkit-devnet test state
git add packages/0gkit-devnet/src/state.ts packages/0gkit-devnet/src/__tests__/state.test.ts
git commit -m "feat(devnet): PID + ports state file at ~/.0g-dev/devnet.json"
```

---

### Task 8: Orchestrator — `startDevnet()` / `stopDevnet()`

**Files:**

- Create/extend: `packages/0gkit-devnet/src/index.ts`
- Create: `packages/0gkit-devnet/src/__tests__/orchestrator.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { startDevnet, stopDevnet, isRunning } from "../index.js";

describe.skipIf(!process.env.CI_HAS_ANVIL)("devnet orchestrator", () => {
  it("starts and stops the full stack", async () => {
    const handle = await startDevnet({
      accounts: 3,
      ports: { chain: 0, storage: 0, compute: 0, da: 0 },
    });
    expect(handle.chain.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(handle.accounts).toHaveLength(3);
    expect(await isRunning()).toBe(true);
    await stopDevnet();
    expect(await isRunning()).toBe(false);
  }, 15_000);
});
```

- [ ] **Step 2: Confirm failure → Step 3: Implement → Step 4: Run → Step 5: Commit**

```ts
// index.ts (extend the placeholder)
import { spawnAnvil } from "./anvil.js";
import { startStorageMock } from "./storage-mock.js";
import { startComputeMock } from "./compute-mock.js";
import { startDaMock } from "./da-mock.js";
import { deriveAccounts, DEFAULT_DEV_MNEMONIC } from "./accounts.js";
import { writeState, readState, clearState, DevnetState } from "./state.js";
import { homedir } from "node:os";
import { join } from "node:path";

export * from "./types.js"; // (Task 9 creates types.ts; for now inline)
export { deriveAccounts, DEFAULT_DEV_MNEMONIC } from "./accounts.js";

export const VERSION = "0.1.0";

export interface DevnetStartOptions {
  accounts?: number;
  mnemonic?: string;
  ports?: Partial<{ chain: number; storage: number; compute: number; da: number }>;
  stateDir?: string;
}

export interface DevnetHandle extends DevnetState {
  stop(): Promise<void>;
}

export async function startDevnet(
  opts: DevnetStartOptions = {}
): Promise<DevnetHandle> {
  const stateDir = opts.stateDir ?? join(homedir(), ".0g-dev");
  const mnemonic = opts.mnemonic ?? DEFAULT_DEV_MNEMONIC;
  const accountsList = deriveAccounts({ count: opts.accounts ?? 10, mnemonic });

  const chain = await spawnAnvil({
    port: opts.ports?.chain ?? 8545,
    mnemonic,
    accounts: opts.accounts ?? 10,
  });
  const storage = await startStorageMock({
    port: opts.ports?.storage ?? 5678,
    stateDir: join(stateDir, "storage"),
  });
  const compute = await startComputeMock({ port: opts.ports?.compute ?? 5679 });
  const da = await startDaMock({ port: opts.ports?.da ?? 5680 });

  const state: DevnetState = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    chain: {
      url: chain.url,
      port: parseInt(new URL(chain.url).port),
      chainId: chain.chainId,
      pid: chain.pid,
    },
    storage: { url: storage.url, port: storage.port },
    compute: { url: compute.url, port: compute.port },
    da: { url: da.url, port: da.port },
    accounts: accountsList,
    mnemonic,
    stateDir,
  };
  writeState(state, { dir: stateDir });

  return {
    ...state,
    stop: async () => {
      await Promise.allSettled([
        chain.stop(),
        storage.stop(),
        compute.stop(),
        da.stop(),
      ]);
      clearState({ dir: stateDir });
    },
  };
}

export async function stopDevnet(opts: { stateDir?: string } = {}): Promise<void> {
  const s = readState({ dir: opts.stateDir });
  if (!s) return;
  // Signal the parent process to terminate gracefully
  try {
    process.kill(s.pid, "SIGTERM");
  } catch {
    /* already dead */
  }
  // Anvil child
  try {
    process.kill(s.chain.pid, "SIGTERM");
  } catch {
    /* already dead */
  }
  clearState({ dir: opts.stateDir });
}

export async function isRunning(opts: { stateDir?: string } = {}): Promise<boolean> {
  const s = readState({ dir: opts.stateDir });
  if (!s) return false;
  try {
    process.kill(s.pid, 0);
    return true;
  } catch {
    return false;
  }
}
```

```bash
pnpm --filter @foundryprotocol/0gkit-devnet test
git add packages/0gkit-devnet/src/index.ts packages/0gkit-devnet/src/__tests__/orchestrator.test.ts
git commit -m "feat(devnet): orchestrator startDevnet/stopDevnet/isRunning"
```

---

### Task 9: `local` network preset in `@foundryprotocol/0gkit-core`

**Files:**

- Modify: `packages/0gkit-core/src/networks.ts`
- Modify: `packages/0gkit-core/src/__tests__/networks.test.ts`

- [ ] **Step 1: Add failing test**

```ts
it("exposes a 'local' network preset matching 0g dev defaults", () => {
  const n = networks.local;
  expect(n.chainId).toBe(31337);
  expect(n.rpcUrl).toBe("http://127.0.0.1:8545");
  expect(n.storageUrl).toBe("http://127.0.0.1:5678");
  expect(n.computeUrl).toBe("http://127.0.0.1:5679");
  expect(n.daUrl).toBe("http://127.0.0.1:5680");
  expect(n.explorerUrl).toBeNull(); // no explorer locally
});
```

- [ ] **Step 2: Confirm failure**

Run: `pnpm --filter @foundryprotocol/0gkit-core test networks`

- [ ] **Step 3: Implement — add the `local` preset to the `networks` constant**

```ts
export const networks = {
  galileo: {
    /* existing */
  },
  local: {
    name: "0g-local",
    chainId: 31337,
    rpcUrl: "http://127.0.0.1:8545",
    storageUrl: "http://127.0.0.1:5678",
    computeUrl: "http://127.0.0.1:5679",
    daUrl: "http://127.0.0.1:5680",
    explorerUrl: null,
    faucetUrl: null,
  },
} as const;
```

- [ ] **Step 4: Run + Commit**

```bash
pnpm --filter @foundryprotocol/0gkit-core test
git add packages/0gkit-core/src/networks.ts packages/0gkit-core/src/__tests__/networks.test.ts
git commit -m "feat(core): add 'local' network preset for 0g dev"
```

---

### Task 10: CLI command `0g dev` (start)

**Files:**

- Create: `packages/0gkit-cli/src/commands/dev.ts`
- Modify: `packages/0gkit-cli/src/program.ts`
- Modify: `packages/0gkit-cli/package.json` (add `@foundryprotocol/0gkit-devnet` dep)
- Create: `packages/0gkit-cli/src/__tests__/dev.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, vi } from "vitest";
import { buildProgram } from "../program.js";

describe("0g dev (start)", () => {
  it("prints accounts + mnemonic + service URLs on success", async () => {
    const out: string[] = [];
    const startDevnet = vi.fn().mockResolvedValue({
      chain: { url: "http://127.0.0.1:8545", chainId: 31337 },
      storage: { url: "http://127.0.0.1:5678" },
      compute: { url: "http://127.0.0.1:5679" },
      da: { url: "http://127.0.0.1:5680" },
      accounts: [{ index: 0, address: "0xabc", privateKey: "0xdef" }],
      mnemonic: "test test test test test test test test test test test junk",
      stop: vi.fn(),
    });
    const program = buildProgram({
      log: (m) => out.push(m),
      devnet: {
        startDevnet,
        stopDevnet: vi.fn(),
        isRunning: vi.fn().mockResolvedValue(false),
      },
    });
    await program.parseAsync(["node", "0g", "dev", "--accounts", "1", "--detach"]);
    expect(startDevnet).toHaveBeenCalledWith(expect.objectContaining({ accounts: 1 }));
    expect(out.join("\n")).toContain("chain  → http://127.0.0.1:8545");
    expect(out.join("\n")).toContain("storage → http://127.0.0.1:5678");
    expect(out.join("\n")).toContain("Mnemonic:");
    expect(out.join("\n")).toContain("0xabc");
  });

  it("exits 1 with helpful message if already running", async () => {
    const program = buildProgram({
      log: () => {},
      err: () => {},
      devnet: {
        startDevnet: vi.fn(),
        stopDevnet: vi.fn(),
        isRunning: vi.fn().mockResolvedValue(true),
      },
    });
    program.exitOverride();
    await expect(program.parseAsync(["node", "0g", "dev"])).rejects.toThrow(
      /exitCode: 1/
    );
  });
});
```

- [ ] **Step 2: Confirm failure → Step 3: Implement command + ProgramDeps extension**

```ts
// commands/dev.ts
import type { Command } from "commander";
import type { ProgramDeps } from "../program.js";

export function registerDevCommand(parent: Command, deps: ProgramDeps): void {
  const dev = parent
    .command("dev")
    .description("Local 0G devnet (chain + storage + compute + DA)");

  dev
    .command("start", { isDefault: true })
    .description("Start the local devnet")
    .option(
      "--accounts <n>",
      "Number of prefunded dev accounts",
      (v) => parseInt(v, 10),
      10
    )
    .option("--mnemonic <phrase>", "Custom HD mnemonic")
    .option("--port-chain <n>", "anvil port", (v) => parseInt(v, 10), 8545)
    .option("--port-storage <n>", "storage mock port", (v) => parseInt(v, 10), 5678)
    .option("--port-compute <n>", "compute mock port", (v) => parseInt(v, 10), 5679)
    .option("--port-da <n>", "DA mock port", (v) => parseInt(v, 10), 5680)
    .option("--state-dir <path>", "State directory")
    .option("--detach", "Return immediately after services come up (for tests)")
    .action(async (opts) => {
      if (await deps.devnet.isRunning()) {
        deps.err("0g dev is already running. Run `0g dev stop` first.");
        process.exit(1);
      }
      const handle = await deps.devnet.startDevnet({
        accounts: opts.accounts,
        mnemonic: opts.mnemonic,
        ports: {
          chain: opts.portChain,
          storage: opts.portStorage,
          compute: opts.portCompute,
          da: opts.portDa,
        },
        stateDir: opts.stateDir,
      });
      deps.log(`0g dev — local stack up`);
      deps.log(`  chain  → ${handle.chain.url} (chainId ${handle.chain.chainId})`);
      deps.log(`  storage → ${handle.storage.url}`);
      deps.log(`  compute → ${handle.compute.url}`);
      deps.log(`  da      → ${handle.da.url}`);
      deps.log(``);
      deps.log(`Mnemonic: ${handle.mnemonic}`);
      deps.log(`Accounts (${handle.accounts.length}, 10,000 ETH each):`);
      for (const a of handle.accounts)
        deps.log(`  [${a.index}] ${a.address}  ${a.privateKey}`);
      deps.log(``);
      deps.log(`Stop with: 0g dev stop`);
      if (opts.detach) return;
      await new Promise<void>((resolve) => {
        process.on("SIGINT", async () => {
          await handle.stop();
          resolve();
        });
        process.on("SIGTERM", async () => {
          await handle.stop();
          resolve();
        });
      });
    });

  // dev stop / status / reset / fund — Task 11
}
```

Modify `program.ts` to inject `deps.devnet` (import from `@foundryprotocol/0gkit-devnet`) and call `registerDevCommand(program, deps)`.

- [ ] **Step 4: Run tests → Step 5: Commit**

```bash
pnpm --filter @foundryprotocol/0gkit-cli test dev
git add packages/0gkit-cli packages/0gkit-cli/src/commands/dev.ts packages/0gkit-cli/src/__tests__/dev.test.ts
git commit -m "feat(cli): 0g dev start — orchestrate local stack, print accounts"
```

---

### Task 11: CLI `0g dev stop|status|reset|fund`

**Files:**

- Extend: `packages/0gkit-cli/src/commands/dev.ts` (or split into `dev-stop.ts` etc. per file structure)
- Extend: `packages/0gkit-cli/src/__tests__/dev.test.ts`

- [ ] **Step 1: Write failing tests** for each subcommand:
  - `0g dev status` prints "running" + service URLs when state file present; "not running" otherwise.
  - `0g dev stop` calls `stopDevnet`, exits 0.
  - `0g dev reset` clears state dir and re-funds (calls `clearState` + spawns fresh).
  - `0g dev fund 0xADDR --amount 100` makes an `anvil_setBalance` RPC call.

- [ ] **Step 2: Confirm failure → Step 3: Implement → Step 4: Run → Step 5: Commit**

For `fund`, use viem's `walletClient.request({ method: "anvil_setBalance", params: [address, "0x" + (BigInt(amount) * 10n ** 18n).toString(16)] })`.

```bash
pnpm --filter @foundryprotocol/0gkit-cli test dev
git add packages/0gkit-cli/src
git commit -m "feat(cli): 0g dev stop, status, reset, fund subcommands"
```

---

### Task 12: Conformance test — storage primitive against mock matches galileo-shape

**Files:**

- Create: `packages/0gkit-devnet/src/__tests__/conformance.test.ts`

- [ ] **Step 1: Write the conformance test**

```ts
import { describe, it, expect } from "vitest";
import { StorageClient } from "@foundryprotocol/0gkit-storage";
import { networks } from "@foundryprotocol/0gkit-core";
import { startDevnet, stopDevnet } from "../index.js";

describe.skipIf(!process.env.CI_HAS_ANVIL)(
  "conformance: storage primitive ↔ local mock",
  () => {
    it("upload returns same Receipt shape as galileo path", async () => {
      const handle = await startDevnet({
        accounts: 1,
        ports: { chain: 0, storage: 0, compute: 0, da: 0 },
      });
      try {
        const storage = new StorageClient({
          network: {
            ...networks.local,
            storageUrl: handle.storage.url,
            rpcUrl: handle.chain.url,
          },
          privateKey: handle.accounts[0].privateKey,
        });
        const { root, receipt } = await storage.upload(
          new TextEncoder().encode("conformance")
        );
        expect(root).toMatch(/^0x[0-9a-f]{64}$/);
        expect(receipt).toMatchObject({
          status: expect.any(String),
          txHash: expect.stringMatching(/^0x/),
          blockNumber: expect.any(BigInt),
        });
        const bytes = await storage.download(root);
        expect(new TextDecoder().decode(bytes)).toBe("conformance");
      } finally {
        await stopDevnet();
      }
    }, 30_000);
  }
);
```

- [ ] **Step 2: Run → Step 3: Iterate until pass → Step 4: Commit**

This test is the contract: the real `StorageClient` (no special "is-mock" branching anywhere) talks to the local mock and gets back the exact same `Receipt` shape it'd get from galileo. If this passes, the mock is API-faithful.

```bash
pnpm --filter @foundryprotocol/0gkit-devnet test conformance
git add packages/0gkit-devnet/src/__tests__/conformance.test.ts
git commit -m "test(devnet): storage primitive conformance against local mock"
```

---

### Task 13: CI integration

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add anvil install step + extend coverage filter**

```yaml
- name: Install foundry (anvil)
  uses: foundry-rs/foundry-toolchain@v1
  with:
    version: stable

- name: Mark CI_HAS_ANVIL for conformance tests
  run: echo "CI_HAS_ANVIL=1" >> $GITHUB_ENV
```

Extend the test matrix or coverage filter to include `@foundryprotocol/0gkit-devnet`.

- [ ] **Step 2: Push branch → confirm CI green → Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: install foundry for devnet conformance tests"
```

---

### Task 14: Docs page + changeset

**Files:**

- Create: `apps/docs/app/cli/dev/page.mdx`
- Modify: `apps/docs/app/cli/page.mdx` (add link)
- Create: `.changeset/sp2-0g-dev.md`
- Modify: `README.md` (root) — add `0g dev` to the Quick start section

- [ ] **Step 1: Write the docs page** covering: what it is, how to start, ports table, accounts, switching between `local`/`galileo`, troubleshooting (anvil not found), known divergences from galileo (no real attestation hardware, deterministic mnemonic only).

- [ ] **Step 2: Write the changeset**

```md
---
"@foundryprotocol/0gkit-devnet": minor
"@foundryprotocol/0gkit-cli": minor
"@foundryprotocol/0gkit-core": minor
---

SP2: `0g dev` — a local 0G stack (chain + storage + compute + DA) that starts in
≤5s with 10 pre-funded dev accounts. Eliminates faucet round-trips during
development. Adds the `local` network preset to `0gkit-core`; apps switch
between `local` and `galileo` by changing one constant.
```

- [ ] **Step 3: Commit**

```bash
git add apps/docs/app/cli/dev/page.mdx apps/docs/app/cli/page.mdx .changeset/sp2-0g-dev.md README.md
git commit -m "docs(devnet): 0g dev page + changeset"
```

---

### Task 15: Self-review + boundary check + finishing

- [ ] **Step 1: Run the full gauntlet**

```bash
pnpm install
pnpm boundary:check
pnpm typecheck
pnpm test
pnpm build
```

All must exit 0.

- [ ] **Step 2: Manual smoke**

```bash
pnpm --filter @foundryprotocol/0gkit-cli build
node packages/0gkit-cli/dist/cli.js dev --accounts 3 --detach
node packages/0gkit-cli/dist/cli.js dev status
node packages/0gkit-cli/dist/cli.js dev stop
```

Expected: prints 3 accounts + mnemonic, status reports running, stop tears everything down.

- [ ] **Step 3: Use `superpowers:finishing-a-development-branch`** to land via squash-merge after CI is green.

---

## Spec Coverage Self-Review

| Spec requirement (SP2)                                       | Task                                     |
| ------------------------------------------------------------ | ---------------------------------------- |
| `0g dev` starts in ≤5s, prints 10 funded accounts + mnemonic | Tasks 8, 10                              |
| Mock storage with same client API as real network            | Tasks 4, 12                              |
| Mock compute (Ollama if detected, stub otherwise)            | Task 5                                   |
| Mock DA (canonical digest)                                   | Task 6                                   |
| `local` network preset in `0gkit-core`                       | Task 9                                   |
| `0g dev stop/status/reset/fund`                              | Task 11                                  |
| Conformance: real storage primitive talks to mock unchanged  | Task 12                                  |
| Coverage thresholds (80/70 lines/branches)                   | All tasks (vitest config in Task 1)      |
| Anvil install hint when missing                              | Task 2 (`AnvilNotInstalledError`)        |
| Apps zero-code-change between `local` and `galileo`          | Tasks 9, 12 (proven by conformance test) |
