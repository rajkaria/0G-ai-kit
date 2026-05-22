import type { Estimate } from "@foundryprotocol/0gkit-core";
import type { ChatMessage } from "./compute.js";

/** Default max-output cap used when the caller doesn't specify one. */
export const DEFAULT_MAX_OUTPUT_TOKENS = 512;

/**
 * Galileo broker's published nominal rate as of 2026-05.
 * Real rates are returned by `broker.inference.getServiceMetadata` per provider —
 * this is the offline fallback so `.estimate()` never has to round-trip.
 */
export const DEFAULT_FEE_WEI_PER_TOKEN = 1_000_000_000n;

/**
 * Rough character-to-token estimator. OpenAI's documented heuristic
 * ("English ≈ 4 chars/token") is good enough for ballpark cost estimates; an
 * exact tokenizer adds megabytes of vocab files and we never claim precision.
 */
export function countTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}

export interface ComputeEstimateBreakdown {
  readonly inputTokens: number;
  readonly outputTokensMax: number;
  readonly model: string;
  readonly [k: string]: string | number | bigint | undefined;
}

export interface ComputeEstimate extends Estimate {
  readonly kind: "compute";
  readonly breakdown: ComputeEstimateBreakdown;
}

export function makeComputeEstimate(args: {
  messages: ChatMessage[];
  model?: string;
  maxOutputTokens?: number;
  feeWeiPerToken?: bigint;
}): ComputeEstimate {
  const inputTokens = args.messages.reduce((acc, m) => acc + countTokens(m.content), 0);
  const outputTokensMax = args.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const rate = args.feeWeiPerToken ?? DEFAULT_FEE_WEI_PER_TOKEN;
  const fee = BigInt(inputTokens + outputTokensMax) * rate;
  return {
    kind: "compute",
    gas: 0n,
    fee,
    breakdown: {
      inputTokens,
      outputTokensMax,
      model: args.model ?? "(provider default)",
    },
    expectedSeconds: 5,
  };
}
