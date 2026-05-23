---
"@foundryprotocol/0gkit-attestation": major
"@foundryprotocol/0gkit-chain": major
"@foundryprotocol/0gkit-cli": major
"@foundryprotocol/0gkit-compute": major
"@foundryprotocol/0gkit-contracts": major
"@foundryprotocol/0gkit-core": major
"@foundryprotocol/0gkit-da": major
"@foundryprotocol/0gkit-devnet": major
"@foundryprotocol/0gkit-indexer": major
"@foundryprotocol/0gkit-jobs": major
"@foundryprotocol/0gkit-mcp": major
"@foundryprotocol/0gkit-observability": major
"@foundryprotocol/0gkit-react": major
"@foundryprotocol/0gkit-storage": major
"@foundryprotocol/0gkit-testing": major
"@foundryprotocol/0gkit-wallet": major
"@foundryprotocol/0gkit-wallet-react": major
"create-0gkit-app": major
"create-0g-app": major
---

# 0gkit v1.0.0 — feature-complete, API-stable release

Phase 4 (SP9–SP12) shipped — the 0gkit toolkit is feature-complete and the public surface is now considered stable. From this point onward we follow strict semver: no breaking changes without a major bump.

**What's in v1.0.0** (cumulative across all 12 sub-projects):

- **Primitives** — `0gkit-core` (Networks/viem client/Receipt/Signer/ZeroGError taxonomy) · `0gkit-storage` · `0gkit-compute` · `0gkit-da` · `0gkit-attestation` · `0gkit-chain`.
- **Wallet** — `0gkit-wallet` (HD + JSON-keystore + raw-key signers) + `0gkit-wallet-react` (wagmi 2.x adapter).
- **Contracts** — `0gkit-contracts` (wagmi-style typed `read.*` / `write.*` / `events.*` over viem, Foundry codegen, registry placeholders).
- **Indexer** — `0gkit-indexer` (polling indexer, reorg-safe, memory/sqlite/redis cursor backends) + `useEvent` / `useLogs` in `0gkit-react`.
- **Jobs** — `0gkit-jobs` (durable runner, memory/sqlite/redis backends, HMAC webhooks, at-least-once delivery).
- **Observability** — `0gkit-observability` (prototype-patch instrumentation, `0gkit.*` OTel attributes, ≤ 20 KB gz, optional OTel SDK auto-setup).
- **Testing** — `0gkit-testing` (mocks/fixtures/`testWallet`/`setupLocalDevnet`/vitest matchers).
- **CLI** — `0gkit-cli` (`0g init / doctor / chain / storage / infer / da / attest / contracts / estimate / jobs / cost`).
- **MCP** — `0gkit-mcp` (every CLI capability as an MCP tool).
- **Scaffolder** — `create-0gkit-app` (9 archetypes: storage-app, ai-agent, tee-attested-api, nft-with-storage, chat, react-app, …) with `--ci <github|gitlab|circle|none>`.
- **Docs site** — Pagefind in-site search · Lighthouse CI ≥ 0.95 gate · per-error-code MDX pages · `docs:check --exports` CI gate.
- **Error taxonomy** — 45 SCREAMING_SNAKE codes with deterministic `helpUrl` per code · `<ZeroGErrorBoundary>` in React.

**Stability commitment from v1.0.0:** public API surface frozen until v2.0.0. Bug fixes are patches; new features are minors; only true breaking changes warrant a major.
