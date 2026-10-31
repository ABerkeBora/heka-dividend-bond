# Dividend Bond V2 — independent collection

The issuer funds the obligation, then stops acting. A separate collector buys the EODHD proof with its own aUSD and submits `claimFor` with its own transaction key. The beneficiary receives **26 tdUSD** without another issuer transaction.

- **V1:** [localhost:3103/](http://localhost:3103/) — preserved financial statement and receipts.
- **V2:** [localhost:3103/next](http://localhost:3103/next) — independent collector and its evidence.
- **Source:** [ABerkeBora/heka-dividend-bond](https://github.com/ABerkeBora/heka-dividend-bond), V2 branch `codex/next`.
- **Baseline:** [`v1-baseline`](https://github.com/ABerkeBora/heka-dividend-bond/tree/v1-baseline), commit [`3a177521c49a32b07ccbc1be3985df8a86eab0c8`](https://github.com/ABerkeBora/heka-dividend-bond/commit/3a177521c49a32b07ccbc1be3985df8a86eab0c8).

This is one historical synthetic test position on **Base Sepolia, chain 84532**. It does not prove real share ownership or securities backing. The EODHD operation, signer, request hash, dividend semantics and immutable contract policy are unchanged from V1; V2 has a separate contract, collateral token, mandate, payment, transaction and evidence namespace.

## Open the application

V2 requires **Node.js 24**, tested with **24.21.0**, because its collector runs TypeScript directly in a Node permission process. Use npm and Foundry for the following source setup:

```sh
git clone --branch codex/next https://github.com/ABerkeBora/heka-dividend-bond.git
cd heka-dividend-bond
npm ci
forge build
npm run build
npm start
```

Both URLs use port 3103. No signing wallet is needed to review saved evidence, current public chain state or read-only verification. Bundled artifacts also let the collector read its ABI without access to Foundry's `out/` directory.

The shipped V2 obligation is already collected. **Run reconciliation** checks that receipt; it does not start a second purchase. The source includes one idempotent setup scenario, `independent-01`. There is no general fresh-V2-scenario helper; deleting journals or reusing V1 receipts is not a reset workflow.

## What proves independence

| Check | Observed V2 result |
| --- | --- |
| Issuer | `0x1e3bD1fD6e463bc410E99298d20274dbE252d6E0` |
| Collector and immutable beneficiary | `0x4d299E20B77a197950cE862b311aB34B4237Fbec` |
| Paid data | 5,000 aUSD atoms transferred from collector to the pinned EODHD payee |
| Claim transaction sender | Collector; normal transaction nonce 0 |
| Issuer nonce during collection | **15 → 15** |
| Collector normal transaction count | **0 → 1** |
| Beneficiary payout | **26,000,000 tdUSD atoms** |
| Issuer file access in actual collection process | `fs.readFileSync` rejected with **ERR_ACCESS_DENIED** |
| Key schema visible to collector | Only `collector: {address, privateKey}`; issuer roles unavailable |
| Retry, fresh-process restart and recovery | No second data charge, mandate or payout |

The EIP-3009 **payment authorization nonce** is separate from the collector's normal transaction nonce. The x402 facilitator submits the aUSD settlement transaction and pays its gas. The collector is nevertheless the token payer, proven by the exact `Transfer` event and consumed authorization nonce; it also sends and pays gas for the claim transaction.

The first successful economic process is preserved in [collection-runtime.json](evidence/v2/collection-runtime.json). [independence.json](evidence/v2/independence.json) links that runtime proof to the payment, claim sender and nonce observations. [acceptance.json](evidence/v2/acceptance.json) records all fourteen acceptance checks, including the exact transfer, consumed authorization, actual claim sender, fixed beneficiary and unchanged issuer nonce. Later state/reconciliation processes are separate observations.

UI state polling and read-only response verification do not rewrite public evidence, recorded payments or the first economic-process proof. They keep only one ignored local diagnostic file, `.local/v2/runtime-last-read.json`, without growing a runtime history. Explicit probe, authorization, execution, recovery and rejection-check commands may record their own evidence.

## Live receipts

| Step | Base Sepolia evidence |
| --- | --- |
| Separate DividendBond | [`0x020c8bc7c9d4e3fdde1af6d9ad31a284850289ba`](https://sepolia.basescan.org/address/0x020c8bc7c9d4e3fdde1af6d9ad31a284850289ba) |
| Separate tdUSD collateral | [`0xc61371f8c5508cbd9862b76173eac5e6ef479478`](https://sepolia.basescan.org/address/0xc61371f8c5508cbd9862b76173eac5e6ef479478) |
| Issuer locks 50 tdUSD reserve | [Funding transaction](https://sepolia.basescan.org/tx/0xf73c3815cfe411207d72067379fe878a82f5db5c984d69844550db6d5e367004) |
| Initial collector allocation, 50,000 aUSD atoms | [Setup transfer](https://sepolia.basescan.org/tx/0x112592c42f5658ee4d92ec1ccbe15c8aaecbbc035e88e475e29ba20a9d695380) |
| Collector buys exact EODHD proof, 5,000 aUSD atoms | [Data payment](https://sepolia.basescan.org/tx/0x84a9bd85caec8f0d30974545c56c4633ec1ffe80deef8e34f8928829dabce7b3) |
| Collector triggers 26 tdUSD beneficiary payout | [Claim transaction](https://sepolia.basescan.org/tx/0x9dc93dca56d5c3b5418d9d31f6bc613abebc487897f3a2ce49419c296c6ca4d4) |

The setup allocation is preparation, not the customer payment result. The actual result is the subsequent external data purchase and funded contract claim. V1's historical raw-event discovery snapshot is reused only to pin the unique event before V2 funding. It is **not** represented as V2's data purchase or claim receipt.

## Bounded mandate and runtime

The initial mandate pins the funded contract, beneficiary, exact EODHD request, signer, Base Sepolia, aUSD asset and EODHD payee. It permits at most 10,000 aUSD atoms per call, 50,000 in total, two data purchases and one claim, for 1,800 seconds. Claim gas budget is 200,000,000,000,000 wei, excluding setup. The observed collector started with 50,000 aUSD atoms and 0.001 test ETH; 45,000 aUSD atoms remained after the data purchase.

API spending limits are application guards, not an on-chain allowance. The transaction bounds L2 gas/maxFee; Base's extra L1 data fee is estimated with margin and separately recorded from the receipt. It has no equivalent absolute transaction-level cap. Neither the wallet's entire gas balance nor a model suggestion expands the mandate.

The launcher starts a separate **native Node 24** worker with a sanitized environment. It does not forward `WALLET_FILE`, `NODE_OPTIONS` or the parent `.env`. Read access is limited to `server/`, `node_modules/`, bundled `artifacts/`, `package.json`, `.local/v2/` and `evidence/v2/`; write access is limited to the two V2 namespaces. Child processes, worker threads and native addons are not permitted. The worker actually attempts the denied issuer-file read and checks the permission boundary before acting.

Node's permission model is a filesystem seat belt for this trusted application. It is **not a hostile-code sandbox or isolation from malicious code running as the same operating-system owner**. The parent setup process can read issuer credentials; the collector process is deliberately launched without that capability. See [SECURITY_V2.md](SECURITY_V2.md) and the [official Node permission documentation](https://nodejs.org/docs/latest-v24.x/api/permissions.html).

## Commands and credentials

Read-only review:

```sh
npm run v2:state
npm run v2:probe
npm run v2:tamper
```

The V2 UI's response panel submits an original signed envelope to the V2 verifier read-only. Genuine saved envelopes become stale after 300 seconds; a stale rejection is expected. The `data` string must remain byte-for-byte unchanged. The four rejection cases are recorded both while the V2 contract was active and after consumption in [tamper-before-claim.json](evidence/v2/tamper-before-claim.json) and [tamper-live.json](evidence/v2/tamper-live.json). They are `eth_call` simulations against the actual deployment, not broadcast reverted transactions. The valid live action has its separate claim receipt above.

For the configured isolated test setup, `.env` points `WALLET_FILE` to the project's test-only role file as described in `.env.example`. `npm run v2:setup` runs in the issuer setup process, locks its separate reserve and allocates 0.05 aUSD to the buyer/collector. It creates ignored `0600` `.local/v2/collector-wallet.json` containing only the collector role. It expects that collector's initial aUSD balance to be zero and uses the existing prepared test gas; it does not automatically top up a previously funded wallet. Setup replay reconciles the named scenario's transactions.

```sh
# Economic setup/collection: use only your isolated test funds.
npm run v2:setup
npm run v2:collect
# Existing mandate only; release only locks with proven-dead local owners.
npm run v2:recover
```

`v2:collect` authorizes only if no mandate journal exists, then runs the same bounded agent. On an already claimed obligation it reconciles without another charge. Unknown payments block new authorizations until saved nonce/receipt/body are reconciled. `v2:recover` cannot create a mandate, cannot remove a live owner's lock and cannot silently pay again for a lost response. Never publish either wallet file or delete journals to bypass uncertainty.

A clean checkout can review and reconcile the consumed obligation without a collector key. Its new read-only runtime probe will correctly report that no collector wallet is available; the preserved first economic-process proof above records the key capability actually used during collection.

For that keyless review, the claimed transaction must match the recorded collection evidence. The worker reads the actual claim sender and the data payment's confirmed aUSD `Transfer`, then labels the linked key-scope findings **recorded successful collection**. `currentCollectorKeyAvailable: false` describes the present review process separately; recorded key access is never presented as a key currently available to that process.

## Verification and remaining submission work

```sh
npm run check
npm test
npm run contracts:test
npm run build
npm run v2:acceptance
npm run v2:regression
```

The server suite retains **64 V1 tests** and adds **seven V2 tests** for namespaces, permissions, recovery and read-only evidence preservation. Full final results, responsive browser QA, the V1 regression recheck and rule reconciliation are recorded in `MORNING_HANDOFF_V2.md` and `TRACK_REQUIREMENTS_V2.md`; consult their final statuses rather than treating this command list as proof every later check passed.

[PRESENTATION_V2.md](PRESENTATION_V2.md) provides a 150-second recording plan. **Video recording and Devfolio submission remain pending.** Only API3 is selected. General rules allow one Devfolio submission per team and publish a 31 October 2026, 15:00 Europe/Berlin deadline, subject to the final recheck. Source, contract evidence and an outline are not a completed competition submission.
