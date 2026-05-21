import type { Signer } from "@foundryprotocol/0gkit-core";

export function generateNonce(): string {
  throw new Error("generateNonce: implemented in task 7");
}

export interface BuildMessageInput {
  domain: string;
  address: `0x${string}`;
  uri: string;
  version?: string;
  chainId: number;
  nonce: string;
  issuedAt?: string;
  statement?: string;
}

export function buildMessage(_input: BuildMessageInput): string {
  throw new Error("buildMessage: implemented in task 7");
}

export interface VerifyArgs {
  message: string;
  signature: `0x${string}`;
  expectedAddress?: `0x${string}`;
  expectedDomain?: string;
  expectedNonce?: string;
}

export interface VerifyResult {
  valid: boolean;
  address?: `0x${string}`;
  reason?: string;
  fields?: Record<string, string>;
}

export async function verify(_args: VerifyArgs): Promise<VerifyResult> {
  throw new Error("verify: implemented in task 7");
}

// Silence unused-import warning for Signer in this stub file.
export type _SignerRef = Signer;
