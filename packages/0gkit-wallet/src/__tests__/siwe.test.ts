import { describe, it, expect } from "vitest";
import * as siwe from "../siwe.js";
import { fromPrivateKey } from "../from-private-key.js";

const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

describe("siwe.generateNonce", () => {
  it("returns a 17-char alphanumeric string per spec", () => {
    const n = siwe.generateNonce();
    expect(n).toMatch(/^[A-Za-z0-9]{17,}$/);
  });
  it("returns unique nonces", () => {
    const a = siwe.generateNonce();
    const b = siwe.generateNonce();
    expect(a).not.toBe(b);
  });
});

describe("siwe.buildMessage + siwe.verify", () => {
  it("a self-signed message verifies", async () => {
    const signer = await fromPrivateKey(PK);
    const nonce = siwe.generateNonce();
    const message = siwe.buildMessage({
      domain: "0gkit.dev",
      address: signer.address,
      uri: "https://0gkit.dev/login",
      nonce,
      chainId: 16602,
      statement: "Sign in with 0G.",
      issuedAt: new Date("2026-05-21T00:00:00Z"),
    });
    const signature = await signer.signMessage(message);
    const r = await siwe.verify({ message, signature, expectedNonce: nonce });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.address.toLowerCase()).toBe(signer.address.toLowerCase());
  });

  it("returns ok:false for a nonce mismatch", async () => {
    const signer = await fromPrivateKey(PK);
    const nonce = siwe.generateNonce();
    const message = siwe.buildMessage({
      domain: "0gkit.dev",
      address: signer.address,
      uri: "https://0gkit.dev/login",
      nonce,
      chainId: 16602,
      issuedAt: new Date("2026-05-21T00:00:00Z"),
    });
    const signature = await signer.signMessage(message);
    const r = await siwe.verify({
      message,
      signature,
      expectedNonce: "differentnonce",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/nonce/i);
  });

  it("returns ok:false for a tampered message body", async () => {
    const signer = await fromPrivateKey(PK);
    const nonce = siwe.generateNonce();
    const message = siwe.buildMessage({
      domain: "0gkit.dev",
      address: signer.address,
      uri: "https://0gkit.dev/login",
      nonce,
      chainId: 16602,
      issuedAt: new Date("2026-05-21T00:00:00Z"),
    });
    const signature = await signer.signMessage(message);
    const tampered = message.replace("0gkit.dev", "evil.example");
    const r = await siwe.verify({
      message: tampered,
      signature,
      expectedNonce: nonce,
    });
    expect(r.ok).toBe(false);
  });

  it("returns ok:false when expirationTime has passed", async () => {
    const signer = await fromPrivateKey(PK);
    const nonce = siwe.generateNonce();
    const message = siwe.buildMessage({
      domain: "0gkit.dev",
      address: signer.address,
      uri: "https://0gkit.dev/login",
      nonce,
      chainId: 16602,
      issuedAt: new Date("2026-05-01T00:00:00Z"),
      expirationTime: new Date("2026-05-02T00:00:00Z"),
    });
    const signature = await signer.signMessage(message);
    const r = await siwe.verify({
      message,
      signature,
      expectedNonce: nonce,
      now: new Date("2026-05-20T00:00:00Z"),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/expired/i);
  });
});
