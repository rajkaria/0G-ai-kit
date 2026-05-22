import { getContract, type Abi, type AbiEvent, type Address } from "viem";
import { ConfigError, ChainError, type Receipt } from "@foundryprotocol/0gkit-core";
import type { DryRunResult } from "@foundryprotocol/0gkit-core";
import { buildClients } from "./clients.js";
import { makeContractEstimate, type ContractEstimate } from "./estimate.js";
import type { TypedContractOptions, EventOptions, WriteOptions } from "./types.js";

/**
 * The wrapped contract handle returned by `createTypedContract`.
 *
 * - `read.<method>(args)` — view/pure namespace. The runtime delegate is
 *   `viem.getContract(...).read`, so when callers pass an `as const` ABI
 *   literal directly (the codegen output does this), full IntelliSense works.
 *   The generic factory exposes a `Record<string, ...>` so it compiles for
 *   arbitrary `Abi`-typed inputs.
 * - `write.<method>(args)` — submits + waits for a receipt; returns `Receipt`
 *   shape from `0gkit-core` (so callers get `txHash`, `blockNumber`,
 *   `latencyMs`).
 * - `events.<EventName>(opts?)` — pull-only via viem.getLogs; SP6 (indexer)
 *   adds live subscription with reorg safety.
 */
export interface TypedContract<TAbi extends Abi> {
  address: Address;
  abi: TAbi;
  read: Record<string, (...args: unknown[]) => Promise<unknown>>;
  write: Record<
    string,
    (...args: unknown[]) => Promise<Receipt | DryRunResult<Receipt>>
  >;
  estimate: Record<string, (...args: unknown[]) => Promise<ContractEstimate>>;
  events: Record<string, (opts?: EventOptions) => Promise<readonly unknown[]>>;
}

function listAbiEvents(abi: Abi): readonly AbiEvent[] {
  return abi.filter((item): item is AbiEvent => item.type === "event");
}

function listAbiWriteFunctions(abi: Abi): readonly string[] {
  return abi
    .filter(
      (item): item is Extract<Abi[number], { type: "function" }> =>
        item.type === "function" &&
        item.stateMutability !== "view" &&
        item.stateMutability !== "pure"
    )
    .map((fn) => fn.name);
}

function wrapChainError(err: unknown, action: string): never {
  const e = err as { shortMessage?: string; message?: string };
  const msg = e.shortMessage ?? e.message ?? String(err);
  throw new ChainError(
    `Contract ${action} failed: ${msg}`,
    `Check the args, that the account has gas, and that the network is reachable. Re-run with --json for the raw viem error.`
  );
}

/**
 * Build a typed, receipt-returning contract handle from an ABI literal.
 *
 * `read.*` and the underlying viem contract are fully inferred from the ABI's
 * `as const` literal — so `myContract.read.balanceOf(addr)` returns the right
 * return type with zero `any`.
 *
 * `write.*` is dynamic (we wrap each writable method to auto-wait for the
 * receipt). The runtime shape mirrors the ABI; static typing of args/return
 * values is deferred to a follow-up that emits a precise mapped type from
 * codegen.
 */
export function createTypedContract<TAbi extends Abi>(
  opts: TypedContractOptions<TAbi>
): TypedContract<TAbi> {
  const publicClient =
    opts.publicClient ??
    buildClients({ network: opts.network, rpcUrl: opts.rpcUrl, signer: opts.signer })
      .publicClient;
  const walletClient =
    opts.walletClient ??
    buildClients({ network: opts.network, rpcUrl: opts.rpcUrl, signer: opts.signer })
      .walletClient;

  const viemContract = getContract({
    abi: opts.abi,
    address: opts.address,
    client: walletClient
      ? { public: publicClient, wallet: walletClient }
      : { public: publicClient },
  });

  // Build the write namespace dynamically.
  const writeMethods = listAbiWriteFunctions(opts.abi);
  const write: Record<
    string,
    (...args: unknown[]) => Promise<Receipt | DryRunResult<Receipt>>
  > = {};
  for (const name of writeMethods) {
    write[name] = async (
      ...input: unknown[]
    ): Promise<Receipt | DryRunResult<Receipt>> => {
      let callArgs = input;
      let writeOpts: WriteOptions | undefined;
      const last = input[input.length - 1];
      if (
        last !== null &&
        typeof last === "object" &&
        !Array.isArray(last) &&
        "dryRun" in (last as object)
      ) {
        writeOpts = last as WriteOptions;
        callArgs = input.slice(0, -1);
      }
      const positional = Array.isArray(callArgs[0])
        ? (callArgs[0] as unknown[])
        : callArgs;

      if (writeOpts?.dryRun) {
        try {
          const account =
            walletClient?.account?.address ??
            "0x0000000000000000000000000000000000000000";
          // viem's estimateContractGas/simulateContract want a precise
          // function-name literal; the factory is generic over arbitrary Abi,
          // so we erase to the runtime shape here (matches how write.* dispatch
          // is already untyped at the surface).
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const gas = await publicClient.estimateContractGas({
            address: opts.address,
            abi: opts.abi,
            functionName: name,
            args: positional as never,
            account,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);
          const gasPrice = await publicClient.getGasPrice();
          await publicClient.simulateContract({
            address: opts.address,
            abi: opts.abi,
            functionName: name,
            args: positional as never,
            account,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);
          const est = makeContractEstimate({ method: name, gas, gasPrice });
          return { dryRun: true, estimate: est, result: { latencyMs: 0 } };
        } catch (err) {
          wrapChainError(err, `dryRun.${name}`);
        }
      }

      if (!walletClient) {
        throw new ConfigError(
          `write.${name} requires a wallet client.`,
          `Pass { signer } when calling createTypedContract — a signer with an exposed privateKey (fromPrivateKey / fromFile / fromEnv) enables writes. For KMS / wagmi signers, use signer.sendTransaction directly.`
        );
      }
      const start = Date.now();
      try {
        const viemWrite = (
          viemContract as unknown as {
            write: Record<string, (...a: unknown[]) => Promise<`0x${string}`>>;
          }
        ).write;
        const hash = await viemWrite[name]!(...(positional as unknown[]));
        const rcpt = await publicClient.waitForTransactionReceipt({ hash });
        return {
          txHash: hash,
          blockNumber: rcpt.blockNumber,
          latencyMs: Date.now() - start,
        };
      } catch (err) {
        wrapChainError(err, `write.${name}`);
      }
    };
  }

  // Build the estimate namespace (one per writable method).
  const estimate: Record<string, (...args: unknown[]) => Promise<ContractEstimate>> =
    {};
  for (const name of writeMethods) {
    estimate[name] = async (...args: unknown[]): Promise<ContractEstimate> => {
      try {
        const account = walletClient?.account?.address;
        const gas = await publicClient.estimateContractGas({
          address: opts.address,
          abi: opts.abi,
          functionName: name,
          args: args as never,
          account: account ?? "0x0000000000000000000000000000000000000000",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        const gasPrice = await publicClient.getGasPrice();
        return makeContractEstimate({ method: name, gas, gasPrice });
      } catch (err) {
        wrapChainError(err, `estimate.${name}`);
      }
    };
  }

  // Build the events namespace.
  const eventDefs = listAbiEvents(opts.abi);
  const events: Record<string, (opts?: EventOptions) => Promise<readonly unknown[]>> =
    {};
  for (const evt of eventDefs) {
    events[evt.name] = async (eopts?: EventOptions): Promise<readonly unknown[]> => {
      try {
        return await publicClient.getLogs({
          address: opts.address,
          event: evt,
          fromBlock: eopts?.fromBlock,
          toBlock: eopts?.toBlock,
          args: eopts?.args as never,
        });
      } catch (err) {
        wrapChainError(err, `events.${evt.name}`);
      }
    };
  }

  return {
    address: opts.address,
    abi: opts.abi,
    read: (
      viemContract as unknown as {
        read: Record<string, (...args: unknown[]) => Promise<unknown>>;
      }
    ).read,
    write,
    estimate,
    events,
  };
}
