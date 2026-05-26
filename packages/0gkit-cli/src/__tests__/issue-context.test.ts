import { describe, it, expect } from "vitest";
import { redactArgv, buildIssueContext } from "../issue-context.js";

describe("redactArgv", () => {
  it("redacts --private-key value", () => {
    expect(redactArgv(["storage", "put", "--private-key", "0xdeadbeef"])).toEqual([
      "storage",
      "put",
      "--private-key",
      "<redacted>",
    ]);
  });

  it("redacts --private-key=<value> form", () => {
    expect(redactArgv(["--private-key=0xdeadbeef", "infer"])).toEqual([
      "--private-key=<redacted>",
      "infer",
    ]);
  });

  it("redacts userinfo from --rpc URLs", () => {
    expect(
      redactArgv(["--rpc", "https://user:pass@rpc.example/v1", "chain", "balance"])
    ).toEqual(["--rpc", "https://<redacted>@rpc.example/v1", "chain", "balance"]);
  });

  it("leaves benign flags untouched", () => {
    expect(redactArgv(["chain", "balance", "0xabc", "--network", "galileo"])).toEqual([
      "chain",
      "balance",
      "0xabc",
      "--network",
      "galileo",
    ]);
  });
});

describe("buildIssueContext", () => {
  const baseInput = {
    error: {
      code: "STORAGE_QUOTA_EXCEEDED",
      message: "Storage quota exceeded.",
      hint: "Reduce upload size or split into multiple uploads.",
      helpUrl: "https://0gkit.com/errors/STORAGE_QUOTA_EXCEEDED",
      stack:
        "Error: Storage quota exceeded.\n    at Storage.upload (/x/storage.ts:42:9)\n    at Object.<anonymous> (/x/cli.ts:10:3)",
    },
    argv: ["storage", "put", "./big.bin", "--network", "galileo"],
    node: "v22.11.0",
    os: "darwin 25.5.0",
    packages: [
      { name: "@foundryprotocol/0gkit-cli", version: "1.3.0" },
      { name: "@foundryprotocol/0gkit-storage", version: "1.3.0" },
    ],
    now: new Date("2026-05-26T05:00:00.000Z"),
  };

  it("renders a complete markdown block with all sections", () => {
    const md = buildIssueContext(baseInput);
    expect(md).toContain("### 0gkit error report");
    expect(md).toContain("**Code:** `STORAGE_QUOTA_EXCEEDED`");
    expect(md).toContain("**Message:** Storage quota exceeded.");
    expect(md).toContain("**Hint:** Reduce upload size");
    expect(md).toContain("**Help:** https://0gkit.com/errors/STORAGE_QUOTA_EXCEEDED");
    expect(md).toContain("**CLI:** `0g storage put ./big.bin --network galileo`");
    expect(md).toContain("**Node:** v22.11.0");
    expect(md).toContain("**OS:** darwin 25.5.0");
    expect(md).toContain("- @foundryprotocol/0gkit-cli@1.3.0");
    expect(md).toContain("- @foundryprotocol/0gkit-storage@1.3.0");
    expect(md).toContain("at Storage.upload");
    expect(md).toContain("2026-05-26T05:00:00.000Z");
  });

  it("clips the stack to the first 10 frames", () => {
    const frames = Array.from(
      { length: 15 },
      (_, i) => `    at frame${i} (/x:${i}:1)`
    ).join("\n");
    const md = buildIssueContext({
      ...baseInput,
      error: { ...baseInput.error, stack: `Error: boom\n${frames}` },
    });
    expect(md).toContain("at frame0");
    expect(md).toContain("at frame9");
    expect(md).not.toContain("at frame10");
    expect(md).toContain("… 5 more frames omitted");
  });

  it("redacts argv before rendering the CLI line", () => {
    const md = buildIssueContext({
      ...baseInput,
      argv: ["infer", "--private-key", "0xdeadbeef", "hello"],
    });
    expect(md).toContain("**CLI:** `0g infer --private-key <redacted> hello`");
    expect(md).not.toContain("0xdeadbeef");
  });

  it("omits the stack section when no stack provided", () => {
    const md = buildIssueContext({
      ...baseInput,
      error: { ...baseInput.error, stack: undefined },
    });
    expect(md).not.toContain("#### Stack");
  });
});
