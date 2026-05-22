import { type ErrorCode, helpUrlFor, errorNamespace } from "./error-codes.js";

/**
 * Base error for everything 0gkit throws. Every error carries:
 * - a canonical `code` from the {@link ErrorCode} enum
 * - an actionable `hint` (the exact remedy)
 * - a `helpUrl` pointing at the docs page for that code
 *
 * No 0gkit code path ever fails silently.
 */
export class ZeroGError extends Error {
  readonly code: ErrorCode;
  readonly hint: string;
  readonly helpUrl: string;

  constructor(code: ErrorCode, message: string, hint: string) {
    super(message);
    this.name = "ZeroGError";
    this.code = code;
    this.hint = hint;
    this.helpUrl = helpUrlFor(code);
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      hint: this.hint,
      helpUrl: this.helpUrl,
    };
  }
}

export class ConfigError extends ZeroGError {
  constructor(
    message: string,
    hint: string,
    code: ErrorCode = "CONFIG_INVALID_ARGUMENT"
  ) {
    super(code, message, hint);
    this.name = "ConfigError";
  }
}

export class NetworkError extends ZeroGError {
  constructor(
    message: string,
    hint: string,
    code: ErrorCode = "CHAIN_RPC_UNREACHABLE"
  ) {
    super(code, message, hint);
    this.name = "NetworkError";
  }
}

export class ChainError extends ZeroGError {
  constructor(message: string, hint: string, code: ErrorCode = "CHAIN_TX_REVERTED") {
    super(code, message, hint);
    this.name = "ChainError";
  }
}

export class AttestationError extends ZeroGError {
  constructor(
    message: string,
    hint: string,
    code: ErrorCode = "ATTESTATION_BAD_SIGNATURE"
  ) {
    super(code, message, hint);
    this.name = "AttestationError";
  }
}

export { errorNamespace };
