import { describe, it, expect, vi } from "vitest";
import type { Abi } from "viem";
import type { DryRunResult, Receipt } from "@foundryprotocol/0gkit-core";
import { createTypedContract } from "../factory.js";

const Erc20: Abi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

function fakePublicClient(opts: { gas: bigint; gasPrice: bigint }) {
  return {
    estimateContractGas: vi.fn(async () => opts.gas),
    getGasPrice: vi.fn(async () => opts.gasPrice),
    simulateContract: vi.fn(async () => ({
      request: { gas: opts.gas },
      result: true,
    })),
    waitForTransactionReceipt: vi.fn(async () => ({
      blockNumber: 42n,
    })),
  } as unknown as Parameters<typeof createTypedContract>[0]["publicClient"];
}

describe("typedContract.estimate.<method>", () => {
  it("returns ContractEstimate using viem.estimateContractGas", async () => {
    const pub = fakePublicClient({ gas: 50_000n, gasPrice: 2_000_000_000n });
    const c = createTypedContract({
      abi: Erc20,
      address: ("0x" + "11".repeat(20)) as `0x${string}`,
      network: "galileo",
      publicClient: pub,
    });
    const e = await c.estimate.transfer!(
      ("0x" + "22".repeat(20)) as `0x${string}`,
      1_000n
    );
    expect(e.kind).toBe("contract");
    expect(e.gas).toBe(50_000n);
    expect(e.fee).toBe(50_000n * 2_000_000_000n);
    expect(e.breakdown.method).toBe("transfer");
  });
});

describe("typedContract.write.<method>({ dryRun: true })", () => {
  it("returns DryRunResult via simulateContract, no broadcast", async () => {
    const pub = fakePublicClient({ gas: 60_000n, gasPrice: 1_000_000_000n });
    const sim = (pub as unknown as { simulateContract: ReturnType<typeof vi.fn> })
      .simulateContract;
    const c = createTypedContract({
      abi: Erc20,
      address: ("0x" + "11".repeat(20)) as `0x${string}`,
      network: "galileo",
      publicClient: pub,
      signer: {
        address: ("0x" + "33".repeat(20)) as `0x${string}`,
        privateKey: ("0x" + "44".repeat(32)) as `0x${string}`,
        signMessage: async () => "0x" as `0x${string}`,
        signTypedData: async () => "0x" as `0x${string}`,
        sendTransaction: async () => "0x" as `0x${string}`,
        source: "private-key",
      },
    });
    const res = (await c.write.transfer!(
      [("0x" + "22".repeat(20)) as `0x${string}`, 1n],
      { dryRun: true }
    )) as DryRunResult<Receipt>;
    expect(res.dryRun).toBe(true);
    expect(res.estimate.gas).toBe(60_000n);
    expect(res.result.txHash).toBeUndefined();
    expect(sim).toHaveBeenCalledTimes(1);
  });
});
