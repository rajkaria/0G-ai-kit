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
