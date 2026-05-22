# @foundryprotocol/0gkit-observability

## 0.6.0

### Minor Changes

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
