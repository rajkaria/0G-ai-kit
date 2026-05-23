---
"create-0gkit-app": patch
"create-0g-app": patch
---

Templates now consume `@foundryprotocol/0gkit-testing@^1.1.0`'s published mocks
instead of carrying inline fakes:

- `storage-app/src/__tests__/storage-flow.test.ts` uses `mockStorageClient()`.
- `ai-agent/src/__tests__/agent.test.ts` uses `mockComputeClient({ responder })`
  via a small sequenced-responder closure.
- `tee-attested-api/src/__tests__/app.test.ts` uses `mockComputeClient({ receiptOverride })`.

No runtime behavior change — the published mocks are shape-compatible with the
real SP6/SP7 client classes, so the tests assert the same contracts they did
before. Removes ~60 LOC of duplicated fake plumbing across the three templates.
