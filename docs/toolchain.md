# Verified local contract smoke — M06

Verified 2026-11-10 UTC on this Apple Silicon Mac. This is an isolated sandbox, not testnet. It is not connected to browser gameplay.

- Node22.23.1, npm10.9.8.
- Rust1.93.0 and wasm32-unknown-unknown, repository override only.
- near-sdk5.29.1; lockfile pins near-sdk-core4.2.3, near-sdk-env0.1.6, near-sys0.2.14. Latest transitive env0.1.9 required Rust1.95; initial build failed until pinned. Commit Cargo.lock; use --locked.
- near-sandbox0.3.4, binary2.13.4 native macOS arm64; near-api-js7.4.0.
- tar7.5.22 override addresses advisories in sandbox's pinned tar7.5.13. Final npm audit: zero known vulnerabilities.

```sh
npm ci
npm run build:contract
npm run test:contract
```

Initial WASM compile: 9.90 seconds after compatible resolution. First missing-WASM test to passing sandbox proof: 151 seconds wall time, including debugging (file timestamps; dependency setup before that is excluded). Successful sandbox test: 2.21 seconds; full test process 2.39 seconds. These are observed local times, not fresh-machine promises.

Actual WASM size219423 bytes. SHA256:
`cbcb72c7d4f5b30a921429d5a5a2f1545d2e2a3ac89904a9aecfc697abcf142c`

Proof: deploy WASM, initialize10 demo credits once; reinitialization rejected; debit3 with stable ID twice; conflicting same ID/amount4 rejected; final buyer7/bank3. Payload uses Borsh then SHA256. Logs in contract-test.txt. Sandbox is torn down in finally. Only package-provided public local genesis credentials used; no production/testnet credentials.

Setup pitfall: Sandbox.start already inserts GenesisAccount.createDefault(). Supplying that same account in additionalAccounts creates duplicate genesis records and startup timeout. Removing duplicate fixed it. No child sandbox remained running after the failed startup check.

Limits: temporary buyer-only smoke command, 128 receipt limit, integer string balances, one operator. This is not Publish/Admit, not M07 protocol parity, and not authorization/security completion. The production-sized economy is unimplemented. Initialization should be deployed atomically with init before any external exposure; no external deployment prepared or authorized.
