---
"@foundryprotocol/0gkit-core": minor
"@foundryprotocol/0gkit-react": minor
"@foundryprotocol/0gkit-cli": minor
"@foundryprotocol/0gkit-storage": patch
"@foundryprotocol/0gkit-compute": patch
"@foundryprotocol/0gkit-da": patch
"@foundryprotocol/0gkit-attestation": patch
"@foundryprotocol/0gkit-chain": patch
"@foundryprotocol/0gkit-contracts": patch
"@foundryprotocol/0gkit-indexer": patch
"@foundryprotocol/0gkit-wallet": patch
"@foundryprotocol/0gkit-wallet-react": patch
"@foundryprotocol/0gkit-testing": patch
"@foundryprotocol/0gkit-devnet": patch
"@foundryprotocol/0gkit-mcp": patch
---

SP9 — Error taxonomy + helpUrl + docs:check CI gate.

Every `ZeroGError` thrown by any `0gkit-*` package now carries:

- a stable `code` from the canonical `ERROR_CODES` enum (~45 SCREAMING_SNAKE
  values across CONFIG, WALLET, CHAIN, STORAGE, COMPUTE, DA, ATTESTATION,
  CONTRACTS, INDEXER, JOBS, OBSERVABILITY namespaces — JOBS/OBSERVABILITY are
  forward-defined for SP10/SP11), and
- a `helpUrl` that resolves to `https://0gkit.dev/errors/<CODE>` with a one-page
  explainer (cause, fix, minimal example).

`0gkit-react` ships a new `<ZeroGErrorBoundary>` component that catches errors
thrown inside its subtree and renders the helpUrl as a clickable link. Pass
`fallback` for full custom rendering, or `onError` for analytics side-effects.

`0gkit-cli`'s `--json` failure output now includes `helpUrl`; human mode adds a
`Help: <url>` line under the hint.

`pnpm docs:check` is wired into CI. Every code thrown in `packages/**/src/**`
must have a corresponding `apps/docs/app/errors/<CODE>/page.mdx`; missing pages
or orphan pages fail the build. Static regex extraction — false positives are
rare and the failure mode is a loud CI run.

Breaking change for direct callers of `new ZeroGError(code, message, hint)`:
the `code` argument's union moves from `'CONFIG' | 'NETWORK' | 'CHAIN' |
'ATTESTATION'` to the wider `ErrorCode` (~45 SCREAMING_SNAKE values). The old
broad codes are no longer accepted — use the specific namespaced equivalents
(e.g. `CONFIG_MISSING_ENV`, `CHAIN_RPC_UNREACHABLE`,
`ATTESTATION_BAD_SIGNATURE`). Subclass constructors (`ConfigError`,
`NetworkError`, `ChainError`, `AttestationError`) preserve their
`(message, hint)` signatures and default their code based on the namespace, so
most existing callsites compile unchanged.
