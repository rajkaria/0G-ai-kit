# @foundryprotocol/0gkit-storage

Neutral 0G Storage: upload, download, computeRoot, and exists. Built on
@foundryprotocol/0gkit-core. The `@0gfoundation/0g-storage-ts-sdk` and `ethers` are optional
peers (install them for uploads).

## Install

```bash
npm install @foundryprotocol/0gkit-storage @foundryprotocol/0gkit-core viem
npm install @0gfoundation/0g-storage-ts-sdk ethers@6.13.1 # for uploads (the upstream SDK pins ethers to 6.13.1)
```

## Use

```ts
import { Storage } from "@foundryprotocol/0gkit-storage";

const storage = new Storage({ network: "galileo", privateKey });
const { root, tx } = await storage.upload(new Uint8Array([1, 2, 3]));
const bytes = await storage.download(root);
```

## Estimating & dry-run

```ts
const est = await storage.estimate(data);
// { kind: "storage", gas, fee, breakdown: { sizeBytes, segments }, expectedSeconds }

const dr = await storage.upload(data, { dryRun: true });
// { dryRun: true, estimate, result: { root, tx: { latencyMs: 0 }, raw } }
```

Estimates are heuristics (256 KiB segments, ~80k gas/segment, ~1 gwei
fee/segment) — exact costs depend on network gas + the SDK's submit calldata.
Use `0g estimate storage <file>` on the CLI, or `0g storage put <file> --dry-run`
to validate end-to-end without broadcasting.

## License

MIT.
