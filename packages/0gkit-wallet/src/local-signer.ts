import type { Signer } from "@foundryprotocol/0gkit-core";

export function buildLocalSigner(
  _pk: `0x${string}`,
  _source: Signer["source"]
): Signer {
  throw new Error("buildLocalSigner: implemented in task 3");
}
