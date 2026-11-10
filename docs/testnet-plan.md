# Proposed external proof — not authorized or executed

Proposed destination: NEAR Testnet, RPC `https://test.rpc.fastnear.com`, new account/contract `dungeon-economy-demo-20261110.testnet`. This is a proposed name, not an owned or provisioned account. No existing franchise-agent accounts or credentials are reused.

Prepare a fresh artifact manifest locally:

```sh
node scripts/testnet-proof.mjs > docs/testnet-proposal.json
```

The tool is deliberately read-only and rejects `--apply`/`--execute`. It pins the current WASM hash and enumerates the planned lifecycle. Bounds: one 30-minute proof, at most 20 transaction attempts, 2,200 Tgas total (300 deploy + at most 19 × 100), and at most 10 **testnet** NEAR for funding/storage/gas. No mainnet, real-money spend, inference, hosting, notifications, or public submission.

Before requesting execution approval: verify control/availability of the proposed account; finish the executable bounded runner and its local sandbox rehearsal; confirm the pinned hash is the reviewed build; prepare the exact account creation/funding/deploy and proof actions. A generated JSON proposal is not a testnet proof. M44 remains in progress until those details are concrete; M45 remains unstarted.
