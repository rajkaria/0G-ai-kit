# create-0gkit-app

## 0.5.0

### Minor Changes

- 3b430a2: SP12 — Polish + community + v1.0.0 prep.
  - `--ci <github|gitlab|circle|none>` flag on `create-0gkit-app` scaffolds
    the chosen CI workflow files alongside the template.
  - Vercel "Deploy" buttons on all 9 template READMEs and the docs
    `templates` page.
  - Issue / PR / Discussion templates: bug.yml, feature.yml, security.md,
    rfc.md, plus help.yml / show-and-tell.yml / rfcs.yml under
    `.github/DISCUSSION_TEMPLATE/`.
  - `CONTRIBUTING.md` refresh (8 sections: setup, tests, templates, error
    codes, sub-project plans, changesets, DCO sign-off, code of conduct)
    - Contributor Covenant 2.1 contact wired.
  - `pnpm docs:check` gains an `--exports` mode that asserts every public
    export of every `0gkit-*` package is documented.
  - Pagefind in-site search wired into the docs layout (lazy-loaded on
    focus, ⌘K shortcut).
  - Lighthouse CI workflow with a ≥ 0.95 gate across
    performance/a11y/best-practices/SEO.
  - Decisions D35–D37.

## 0.4.2

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

## 0.4.1

### Patch Changes

- 296c1d8: SP10 — `@foundryprotocol/0gkit-jobs`. First publish: durable async job runner
  with memory/sqlite/redis backends, zod-typed `jobs.define()`, HMAC-signed
  webhooks, graceful shutdown for serverless via `AbortSignal`. CLI gains
  `0g jobs status` for read-only inspection of memory/sqlite-backed queues. The
  `ai-agent` template migrates from in-process loop to a `JobRunner` with
  `MemoryBackend` (swap to sqlite/redis for production).

## 0.4.0

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

## 0.3.0

### Minor Changes

- 94e7fd6: Make `create-0gkit-app` the working npm-create front door. It now bundles the
  scaffolder implementation, exposes the `create-0gkit-app` binary, and replaces
  the old defensive shim that redirected to the unavailable `create-0g-app` name.

## 0.2.0

### Minor Changes

- 89148d3: SP1: `npm create 0g-app@latest <name>` scaffolds a runnable 0G app in seconds.
  Templates: storage-app, inference-app, attestation-verify, mcp-agent, react-app.
  Pairs with SP2's `0g dev` for zero-faucet local development.
  `create-0gkit-app` is a defensive alias that redirects to the canonical name.
