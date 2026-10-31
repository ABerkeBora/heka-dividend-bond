# Dividend Bond

## Short description

An agent collects one prefunded dividend obligation using paid EODHD data authenticated by API3 on-chain. The issuer fixes the beneficiary, event, quantity and cap before funding; a valid signed response determines the payout without an issuer-controlled settlement button.

## Problem and intended users

A platform offering a synthetic equity or total-return position may owe a dividend-linked cash payment. When that platform's backend determines both the external event and whether to release funds, the beneficiary still depends on the counterparty to act fairly and remain available.

Dividend Bond targets this narrow settlement problem. It does not acquire or custody real shares, prove brokerage ownership or claim regulated securities backing. Its working example is one historical AAPL.US event and one isolated test synthetic position.

## What we built

The issuer deploys an immutable obligation for a fixed beneficiary and 100 eligible test units, then locks a 50 tdUSD cap. The event is Apple's ex-dividend date of 11 August 2025, with payment on 14 August. An EODHD `dividendHistory` response reports the unadjusted declared dividend as 0.26 USD per unit, yielding 26 tdUSD under the pre-agreed formula and cap.

The beneficiary authorizes a bounded collection mandate once. A deterministic agent then obtains the x402 price, checks the pinned host, operation, asset, network, recipient, fee caps and expiry, signs the allowed test-aUSD authorization, verifies the returned attestation and submits a permissionless contract claim. The contract transfers the payout to its immutable beneficiary; callers cannot choose another recipient or amount. The remaining reserve returns to the issuer. After the fixed 24-hour claim period plus one claimable hour of grace, an unclaimed obligation can be voided under the predetermined rule.

The UI is a compact financial statement: one event, fixed terms, mandate, collection ledger and separate costs/reserve. A secondary response panel and documented script let judges submit their own envelopes to the deployed verifier without a backend signing key.

## Why API3 is essential

The core payout cannot happen without the response from the pinned Airnode. The contract uses the official starter's `AirnodeV2Attestation` and `ProjectedJson` helpers. It verifies the expected EODHD signer, the exact request hash and envelope timing before reading the declared amount, currency and event dates. A signature for a different request cannot authorize this obligation. Removing authenticated AirnodeHub data materially prevents collection; there is no admin settlement override.

The exact request pins ticker, ex-date range and projection before exposure. A separate fixed technical discovery request checks the raw, unprojected date-filtered array; the signed snapshot returned exactly one matching event before the next obligation was funded. `unadjustedValue` is used because EODHD distinguishes it from the split-adjusted `value`. The contract checks that the payment date has passed, envelope age is at most 300 seconds, future skew at most 60 seconds, event/payment dates match and the record date is valid. Payout arithmetic uses fixed-point integers and rounds down to token atoms. A consumed obligation cannot be paid twice.

## Agentic payment and retry behavior

The payer is the beneficiary-delegated test agent wallet, the service recipient is the pinned EODHD Airnode payee, and the purchased result is an authenticated response to one dividend request. The agent's economic action is both the bounded API purchase and the permissionless claim that transfers the issuer-funded obligation to the beneficiary.

The mandate allows Base Sepolia aUSD only, 0.01 aUSD per call, 0.05 aUSD in total, at most two data purchases, one claim and a thirty-minute expiry. The configured claim budget is 0.0002 test ETH, with L2 transaction limits and a separate L1 data-fee estimate. API fees, setup gas, claim gas and collateral/payout are distinct. API spending controls live in application code and an isolated wallet; the payout proof, recipient, reserve and one-claim protection are enforced on-chain. We do not describe this as a new session-key or general account-abstraction system.

Signed payment authorizations and transaction hashes are persisted before submission. Unknown settlement blocks a fresh authorization; the agent does not silently pay twice to recover a lost response. Cross-process locks, authoritative reservation records and receipt reconciliation protect restarts and duplicate calls. Re-running a collected intent is an economic no-op.

## Data users, forgery impact and remaining trust

The beneficiary relies on the dividend record to collect; the issuer relies on the signed amount and cap to protect its reserve. A forged amount could overpay, underpay or drain the bounded reserve. Edited values, stale authentic responses, real responses to another request and signatures from another key must reject before payout.

An Airnode attestation authenticates who signed the exact response to the exact request. It does not independently prove EODHD's underlying claim is true, prevent source revisions or verify external brokerage ownership. EODHD's historical record has no separate upstream update timestamp here; the event date is not presented as an observation-update time. Missing/null data and source errors halt payout, rather than proving no dividend exists. A paid API fee or reverted transaction gas may already have been spent and is not promised back.

We wanted independently verifiable brokerage eligibility and real position ownership, which this selected AirnodeHub integration does not establish. We therefore fix the eligible quantity inside the test agreement and make no ownership/backing claim. We also do not claim that the agent registers an arbitrary new trusted API.

## Evidence and judging path

- Source: [ABerkeBora/heka-dividend-bond](https://github.com/ABerkeBora/heka-dividend-bond).
- Network: Base Sepolia, chain ID 84532.
- Contract: [`0x4b6a7feb8f0e9bb1ba51ad7921f352e0a4ee6e5b`](https://sepolia.basescan.org/address/0x4b6a7feb8f0e9bb1ba51ad7921f352e0a4ee6e5b).
- Reserve funding: [confirmed transaction](https://sepolia.basescan.org/tx/0x377c4ad760b40272256d9e3ecab1e33d2ccf61d790a26dcdadb1dc13796df483).
- Technical paid data preflight: [0.005 aUSD transaction](https://sepolia.basescan.org/tx/0x19538f247ce1bddba16649310a63cf0aa7a64f6512ed4a418824da49c5af69d2).
- Raw event uniqueness discovery: [separate 0.005 aUSD transaction](https://sepolia.basescan.org/tx/0x81388a8e85e7fa97009f1ccdcbc57630688c366a230ece3e398bb6efbbcf2f11); `evidence/event-discovery.json` records cardinality one and the distinct technical request.
- First completed run's customer data purchase: [0.005 aUSD payment](https://sepolia.basescan.org/tx/0x27c20b26877615683243a7701aa9f16c8e8f56a4397e056c017710352d8a90a2), separate from the technical preflight.
- First completed run's customer collection: [agent-submitted claim transaction](https://sepolia.basescan.org/tx/0x95fa0be4bb9e8b6e4ddae7d47dd6ef7f892948191cdb0f657aef29fb109cb374); `evidence/scenarios/bond-01/collection.json` confirms its beneficiary increase of 26,000,000 tdUSD atoms and collection trace from the initial mandate.
- Selected bond-02: funded after the raw-event uniqueness snapshot; its own [0.005 aUSD customer data purchase](https://sepolia.basescan.org/tx/0x0baa356f7a5ed239fdd6dc220c191f28f2c501111d362d5168c328c248e1bc14) and [26 tdUSD claim](https://sepolia.basescan.org/tx/0xf4419dba4bdd1f320074257d4f618bf7120136ab563c251c417b4218edc7acd3) are confirmed in `evidence/collection.json`. Prior run receipts remain archived separately.
- Tamper results: `evidence/tamper-live.json`; genuine edited/stale/wrong-request/wrong-signer cases use read-only simulations against the actual deployment. Foundry tests additionally assert rejected claim funds/state invariants. The valid live payout is separate evidence.
- Judge submission: UI response panel or `npm run submit-response -- /absolute/path/to/response.json`, documented in the README.
- Video: PENDING recording, at most 2.5 minutes; a timed outline is provided in `PRESENTATION.md`.

## Current limits

One issuer, one beneficiary, one event, one token and one bounded reserve. No real securities trading, portfolio accounting, tax handling, market prediction, cross-chain bridge or production custody claim. This is a local application with testnet integrations, not a hosted deployment.

This is draft submission copy. No Devfolio entry has been submitted. The official rules require one submission per team and a completed video; the final `TRACK_REQUIREMENTS.md` status table must be consulted before making eligibility claims.
