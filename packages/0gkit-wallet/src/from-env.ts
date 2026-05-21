import type { Signer } from "@foundryprotocol/0gkit-core";
import type { FromEnvOptions } from "./types.js";

export async function fromEnv(_opts?: FromEnvOptions): Promise<Signer> {
  throw new Error("fromEnv: implemented in task 5");
}
