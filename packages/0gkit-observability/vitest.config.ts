import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      // - index.ts: re-export barrel
      // - sdk.ts: optional-peer lazy-import path; integration-tested in the
      //   tee-attested-api template
      // - instrument.ts: `defaultTargets` + `setupSdkIfRequested` dynamically
      //   import primitive packages that aren't deps of THIS package by
      //   design (D32). Those branches are integration-tested in the
      //   template, not the unit suite. The wrap+mapper logic that the unit
      //   suite *does* exercise sits in wrap.ts + attribute-mappers.ts, both
      //   of which hit the gate independently.
      exclude: ["src/index.ts", "src/__tests__/**", "src/sdk.ts", "src/instrument.ts"],
      thresholds: { lines: 85, functions: 85, statements: 85, branches: 75 },
    },
  },
});
