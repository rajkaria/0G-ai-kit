# Contributing to 0gkit

Thanks for helping build the neutral 0G toolkit. This guide walks through the
common contribution flows.

## 1. Local setup

```bash
git clone https://github.com/rajkaria/0gkit.git
cd 0gkit
pnpm install
pnpm --filter @foundryprotocol/0gkit-core build   # core builds first
pnpm build                                        # everything
```

Requirements: Node `>=20.10`, pnpm `9.12.0` (via `packageManager`).

See it working:

```bash
pnpm --filter @foundryprotocol/0gkit-cli dev -- dev   # boots `0g dev` local stack
```

## 2. Running tests

```bash
pnpm test                            # full monorepo
pnpm --filter @foundryprotocol/0gkit-storage test
pnpm boundary:check                  # neutrality (no @foundryprotocol/* in @0gkit/*)
pnpm docs:check                      # error codes + exports have docs pages
pnpm templates:check                 # all 9 templates structurally valid
```

Each package targets 80% lines / 70% branches (configured per `vitest.config.ts`).
Mocks and fixtures for tests live in `@foundryprotocol/0gkit-testing`.

## 3. Adding a template

Templates live under `templates/` (workspace-excluded — see D24). Each is a
standalone project that builds against published `@foundryprotocol/0gkit-*`
versions, not workspace versions.

- Create `templates/<name>/` with: `package.json` (`@foundryprotocol/0gkit-*` deps
  pinned to `^<version>`), `tsconfig.json`, `vitest.config.ts`, `README.md`,
  `src/index.ts`, `src/*-flow.ts` (testable surface, D25), and `src/__tests__/`.
- Register in `packages/create-0g-app/src/types.ts` (`TemplateName` union) and
  `TEMPLATES` registry.
- Add a smoke case to `packages/create-0g-app/src/__tests__/sp8-scaffold-smoke.test.ts`.
- Append a row to `apps/docs/app/templates/page.mdx` with a Vercel deploy URL.

## 4. Adding an error code

```ts
// packages/0gkit-core/src/errors.ts
export const ERROR_CODES = [
  // ...
  "STORAGE_NEW_THING_FAILED",
] as const;

// At the throw site:
throw new StorageError({
  code: "STORAGE_NEW_THING_FAILED",
  message: "Detail here",
  hint: "How to fix",
});
```

Then `apps/docs/app/errors/STORAGE_NEW_THING_FAILED/page.mdx`:

```mdx
# STORAGE_NEW_THING_FAILED

**Cause:** ...
**Fix:** ...
**Example:** ...
```

`pnpm docs:check` will fail until both the code is thrown somewhere and the
docs page exists.

## 5. Writing a sub-project plan

Sub-project plans live under `docs/superpowers/plans/` as `<YYYY-MM-DD>-<sp-N>-<slug>.md`.

- Use `superpowers:writing-plans` to draft. Read the existing plans (SP1-SP12)
  for tone and structure — each one has File structure, Task graph, per-task
  TDD steps, and a Self-review checklist.
- Tasks should be bite-sized: one test + one implementation + one commit each.
  Aim for 5-15 tasks per sprint.
- Execute via `superpowers:subagent-driven-development` (one session, fresh
  subagent per task) or `superpowers:executing-plans` (parallel session).

## 6. Changesets

Every change to a published package needs a changeset:

```bash
pnpm changeset
```

Pick the affected packages and bump type:

- **patch** — bug fix, no public API change
- **minor** — additive change (new export, new option)
- **major** — breaking change. Add a `## Migration` section in the changeset body.

The changeset describes user-facing impact, not implementation detail.

## 7. Sign-off (DCO)

We require the [Developer Certificate of Origin](https://developercertificate.org/).
Sign your commits with `-s`:

```bash
git commit -s -m "feat: ..."
```

This appends `Signed-off-by: Your Name <email>` to the commit message. PRs
without DCO sign-off won't merge.

## 8. Code of Conduct

By participating, you agree to abide by the
[Code of Conduct](./CODE_OF_CONDUCT.md). Report incidents to
`conduct@foundryprotocol.xyz`.

## Reporting bugs / security

Open an issue using the [bug template](.github/ISSUE_TEMPLATE/bug.yml).
For security, see [SECURITY.md](./SECURITY.md) — do not file a public issue.

## Releasing

Maintainers: the changesets bot opens a **Version Packages** PR. Merging it
publishes to npm (requires `NPM_TOKEN`). All `@foundryprotocol/0gkit-*`
packages are version-linked.
