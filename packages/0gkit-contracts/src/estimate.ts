import type { Estimate } from "@foundryprotocol/0gkit-core";

export interface ContractEstimateBreakdown {
  readonly method: string;
  readonly gasPrice: bigint;
  readonly [k: string]: string | number | bigint | undefined;
}

export interface ContractEstimate extends Estimate {
  readonly kind: "contract";
  readonly breakdown: ContractEstimateBreakdown;
}

export function weiToFee(gas: bigint, gasPrice: bigint): bigint {
  return gas * gasPrice;
}

export function makeContractEstimate(args: {
  method: string;
  gas: bigint;
  gasPrice: bigint;
  expectedSeconds?: number;
}): ContractEstimate {
  return {
    kind: "contract",
    gas: args.gas,
    fee: weiToFee(args.gas, args.gasPrice),
    breakdown: { method: args.method, gasPrice: args.gasPrice },
    expectedSeconds: args.expectedSeconds ?? 3,
  };
}
