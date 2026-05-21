import { describe, it, expect } from "vitest";
import { Compute } from "../compute.js";
import { countTokens, DEFAULT_MAX_OUTPUT_TOKENS } from "../estimate.js";

describe("countTokens (heuristic)", () => {
  it("empty string → 0 tokens", () => {
    expect(countTokens("")).toBe(0);
  });

  it("4 ASCII chars → 1 token", () => {
    expect(countTokens("abcd")).toBe(1);
  });

  it("5 ASCII chars → 2 tokens (ceil)", () => {
    expect(countTokens("abcde")).toBe(2);
  });

  it("unicode emoji counts code units, not codepoints", () => {
    expect(countTokens("😀")).toBe(1);
  });
});

const stubBroker = {
  acknowledgeProviderSigner: async () => {},
  getServiceMetadata: async () => ({
    endpoint: "https://example.invalid",
    model: "demo",
  }),
  getRequestHeaders: async () => ({}),
  processResponse: async () => null,
  listService: async () => [],
};

describe("Compute.estimate", () => {
  it("returns ComputeEstimate from messages", async () => {
    const c = new Compute({
      brokerKey: "0x" + "22".repeat(32),
      provider: "0x" + "11".repeat(20),
    });
    const e = await c.estimate({
      messages: [
        { role: "user", content: "Hello world" }, // 11 chars → 3 tokens
      ],
    });
    expect(e.kind).toBe("compute");
    expect(e.breakdown.inputTokens).toBe(3);
    expect(e.breakdown.outputTokensMax).toBe(DEFAULT_MAX_OUTPUT_TOKENS);
    expect(e.fee).toBeGreaterThanOrEqual(0n);
  });

  it("honours explicit maxOutputTokens", async () => {
    const c = new Compute({
      brokerKey: "0x" + "22".repeat(32),
      provider: "0x" + "11".repeat(20),
    });
    const e = await c.estimate({
      messages: [{ role: "user", content: "hi" }],
      maxOutputTokens: 64,
    });
    expect(e.breakdown.outputTokensMax).toBe(64);
  });
});

describe("Compute.inference({ dryRun: true })", () => {
  it("returns DryRunResult without calling fetch", async () => {
    let fetchCalled = false;
    const c = new Compute({
      brokerKey: "0x" + "22".repeat(32),
      provider: "0x" + "11".repeat(20),
      fetch: (async () => {
        fetchCalled = true;
        return new Response("{}");
      }) as typeof fetch,
      loadBroker: async () => ({
        createZGComputeNetworkBroker: async () => ({ inference: stubBroker }),
      }),
      loadEthers: async () =>
        ({
          JsonRpcProvider: class {},
          Wallet: class {},
        }) as unknown as typeof import("ethers"),
    });
    const res = await c.inference(
      { messages: [{ role: "user", content: "ping" }] },
      { dryRun: true }
    );
    expect(res.dryRun).toBe(true);
    expect(res.estimate.kind).toBe("compute");
    expect(res.result.output).toBe("");
    expect(res.result.receipt.txHash).toBeUndefined();
    expect(fetchCalled).toBe(false);
  });
});
