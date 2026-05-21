import type { Signer } from "@foundryprotocol/0gkit-core";
import type { FromFileOptions } from "./types.js";

export async function fromFile(_path: string, _opts: FromFileOptions): Promise<Signer> {
  throw new Error("fromFile: implemented in task 4");
}
