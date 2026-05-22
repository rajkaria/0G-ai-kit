# create-0g-app

## 0.3.2

### Patch Changes

- 2f7a022: SP11 — `@foundryprotocol/0gkit-observability`. First publish: `instrument0g()`
  patches Storage / Compute / DA prototypes to emit OTel spans with `0gkit.*`
  semantic attributes (`0gkit.network`, `0gkit.op`, `0gkit.size_bytes`,
  `0gkit.gas_native`, `0gkit.fee_native`, `0gkit.confirm_seconds`, `0gkit.root`,
  `0gkit.error_code`, …). Optional auto SDK setup via lazy-imported peers
  (`@opentelemetry/sdk-node`, `@opentelemetry/exporter-trace-otlp-http`); bring
  your own SDK with `mode: "attach"`. Bundle ≤ 20 KB gzipped (asserted in CI).
  CLI gains `0g cost forecast` aggregating SP7 estimates across ops. The
  `tee-attested-api` template migrates from `console.log` access logging to
  OTel spans (resolves SP8 D26).

## 0.3.1

### Patch Changes

- 296c1d8: SP10 — `@foundryprotocol/0gkit-jobs`. First publish: durable async job runner
  with memory/sqlite/redis backends, zod-typed `jobs.define()`, HMAC-signed
  webhooks, graceful shutdown for serverless via `AbortSignal`. CLI gains
  `0g jobs status` for read-only inspection of memory/sqlite-backed queues. The
  `ai-agent` template migrates from in-process loop to a `JobRunner` with
  `MemoryBackend` (swap to sqlite/redis for production).

## 0.3.0

### Minor Changes

- 61cd0a9: SP8 — Template expansion: ship the five canonical archetypes.

  Adds `chat`, `ai-agent`, `tee-attested-api`, `nft-with-storage` to the
  `--template` registry. Refreshes `storage-app` with SP7 dry-run preflight
  and dedup. Default `OGKIT_TEMPLATE_REF` bumped from `v0.2.x` → `v0.3.x` so
  new scaffolds resolve against `@foundryprotocol/0gkit-*@0.3.0`.

  Each template ships a tutorial-style README, vitest tests via inline fakes
  matching the published 0gkit API surface, and a `pnpm dev` script that
  integrates with `0g dev` where applicable. SP10 / SP11 hand-off paths are
  documented inline in the `ai-agent` and `tee-attested-api` READMEs.

## 0.2.0

### Minor Changes

- 89148d3: SP1: `npm create 0g-app@latest <name>` scaffolds a runnable 0G app in seconds.
  Templates: storage-app, inference-app, attestation-verify, mcp-agent, react-app.
  Pairs with SP2's `0g dev` for zero-faucet local development.
  `create-0gkit-app` is a defensive alias that redirects to the canonical name.
