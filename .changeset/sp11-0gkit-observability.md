---
"@foundryprotocol/0gkit-observability": minor
"@foundryprotocol/0gkit-cli": minor
"create-0gkit-app": patch
"create-0g-app": patch
---

SP11 — `@foundryprotocol/0gkit-observability`. First publish: `instrument0g()`
patches Storage / Compute / DA prototypes to emit OTel spans with `0gkit.*`
semantic attributes (`0gkit.network`, `0gkit.op`, `0gkit.size_bytes`,
`0gkit.gas_native`, `0gkit.fee_native`, `0gkit.confirm_seconds`, `0gkit.root`,
`0gkit.error_code`, …). Optional auto SDK setup via lazy-imported peers
(`@opentelemetry/sdk-node`, `@opentelemetry/exporter-trace-otlp-http`); bring
your own SDK with `mode: "attach"`. Bundle ≤ 20 KB gzipped (asserted in CI).
CLI gains `0g cost forecast` aggregating SP7 estimates across ops. The
`tee-attested-api` template migrates from `console.log` access logging to
OTel spans (resolves SP8 D26).
