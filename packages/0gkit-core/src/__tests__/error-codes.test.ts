import { describe, expect, it } from "vitest";
import { ERROR_CODES, isErrorCode, errorNamespace } from "../error-codes.js";

describe("ERROR_CODES enum", () => {
  it("is a non-empty frozen tuple", () => {
    expect(ERROR_CODES.length).toBeGreaterThanOrEqual(30);
    expect(Object.isFrozen(ERROR_CODES)).toBe(true);
  });

  it("contains expected namespaces (one entry from each)", () => {
    for (const code of [
      "CONFIG_MISSING_ENV",
      "WALLET_KMS_SIGN_FAILED",
      "CHAIN_RPC_UNREACHABLE",
      "STORAGE_QUOTA_EXCEEDED",
      "COMPUTE_PROVIDER_UNREACHABLE",
      "DA_VERIFY_FAILED",
      "ATTESTATION_BAD_SIGNATURE",
      "CONTRACTS_REVERTED",
      "INDEXER_REORG_LIMIT_EXCEEDED",
      "JOBS_BACKEND_UNREACHABLE",
      "OBSERVABILITY_EXPORTER_FAILED",
    ] as const) {
      expect(ERROR_CODES).toContain(code);
    }
  });

  it("every code is SCREAMING_SNAKE, namespace-prefixed", () => {
    for (const c of ERROR_CODES) {
      expect(c).toMatch(/^[A-Z]+(_[A-Z0-9]+)+$/);
    }
  });

  it("has no duplicates", () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });

  it("isErrorCode accepts known codes and rejects strings", () => {
    expect(isErrorCode("STORAGE_QUOTA_EXCEEDED")).toBe(true);
    expect(isErrorCode("nope")).toBe(false);
  });

  it("errorNamespace splits on first underscore", () => {
    expect(errorNamespace("STORAGE_QUOTA_EXCEEDED")).toBe("STORAGE");
    expect(errorNamespace("CONFIG_MISSING_ENV")).toBe("CONFIG");
  });
});
