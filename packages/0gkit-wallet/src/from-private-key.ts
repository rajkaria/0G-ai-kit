import type { Signer } from "@foundryprotocol/0gkit-core";

export async function fromPrivateKey(_pk: string): Promise<Signer> {
  throw new Error("fromPrivateKey: implemented in task 3");
}
