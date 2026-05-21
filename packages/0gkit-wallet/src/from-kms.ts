import type { Signer } from "@foundryprotocol/0gkit-core";
import type { FromKMSOptions } from "./types.js";

export async function fromKMS(_opts: FromKMSOptions): Promise<Signer> {
  throw new Error("fromKMS: implemented in task 6");
}
