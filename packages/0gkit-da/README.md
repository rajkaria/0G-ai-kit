# @foundryprotocol/0gkit-da

Neutral 0G Data Availability: deterministic digest + encoder publish + local
integrity verify. Built on @foundryprotocol/0gkit-core + viem.

## Install

```bash
npm install @foundryprotocol/0gkit-da @foundryprotocol/0gkit-core viem
```

## Use

```ts
import { DA } from "@foundryprotocol/0gkit-da";

const da = new DA({ network: "galileo" }); // omit encoder → local digest mode
const { digest, daRef, mode } = await da.publish({ hello: "world" });
const ok = da.verify({ hello: "world" }, digest);
```

`verify(payload, expectedDigest)` is a local integrity check (no network). See
the repo's `docs/superpowers/DECISIONS.md` (D3) for the DA verify scope.

## Estimating & dry-run

```ts
const est = await da.estimate(payload);
// { kind: "da", gas: 0n, fee, breakdown: { sizeBytes, mode } }

const dr = await da.publish(payload, { dryRun: true });
// { dryRun: true, estimate, result: { digest, mode, latencyMs: 0 } }
```

Local mode (no `encoderUrl`) always returns `fee: 0n`. Live mode uses
`DEFAULT_DA_RATE_WEI_PER_BYTE` (`1e6 wei/byte`, ~1 nano-0G/byte) as a
placeholder until 0G publishes a programmatic pricing feed. Use
`0g estimate da <file>` or `0g estimate da --bytes <n>` on the CLI;
`0g da publish <file> --dry-run` validates without broadcasting.

## License

MIT.
