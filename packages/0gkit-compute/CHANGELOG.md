# @foundryprotocol/0gkit-compute

## 0.2.0

### Minor Changes

- 63a297e: SP3: `0gkit-wallet` + `0gkit-wallet-react`. New `Signer` interface in
  `0gkit-core` adopted by every primitive — `new Storage({ signer })` replaces
  `new Storage({ privateKey })` (legacy stays for one minor with a deprecation
  warning). Loaders: `fromPrivateKey`, `fromFile` (keystore-v3), `fromEnv`
  (auto-picks KMS/file/PK), `fromKMS` (AWS KMS, secp256k1). SIWE: EIP-4361
  nonce/buildMessage/verify. React: `ZeroGWalletProvider` + `useWallet` /
  `useConnect` / `useSwitchNetwork` over wagmi v2.

### Patch Changes

- Updated dependencies [63a297e]
  - @foundryprotocol/0gkit-core@0.2.0

## 0.1.1

### Patch Changes

- 42dbc88: Align `ethers` peer dependency with the upstream `@0gfoundation/0g-*-ts-sdk` constraints so consumers can run `npm install` (strict peer resolution) without `ERESOLVE` errors.
  - `@foundryprotocol/0gkit-storage` peer `ethers`: `^6.16.0` → `6.13.1` (matches `@0gfoundation/0g-storage-ts-sdk@1.2.9`, which pins exactly `6.13.1`).
  - `@foundryprotocol/0gkit-compute` peer `ethers`: `^6.16.0` → `^6.13.1` (matches `@0gfoundation/0g-compute-ts-sdk`).
  - READMEs for both packages now recommend `ethers@6.13.1` in the install instructions.
