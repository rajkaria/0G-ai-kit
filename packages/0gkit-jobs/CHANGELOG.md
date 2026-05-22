# @foundryprotocol/0gkit-jobs

## 0.5.0

### Minor Changes

- 296c1d8: SP10 — `@foundryprotocol/0gkit-jobs`. First publish: durable async job runner
  with memory/sqlite/redis backends, zod-typed `jobs.define()`, HMAC-signed
  webhooks, graceful shutdown for serverless via `AbortSignal`. CLI gains
  `0g jobs status` for read-only inspection of memory/sqlite-backed queues. The
  `ai-agent` template migrates from in-process loop to a `JobRunner` with
  `MemoryBackend` (swap to sqlite/redis for production).
