# Dividend Bond

Collect one funded dividend obligation through an agent, with the payment amount authenticated by API3 on-chain.

An issuer fixes a beneficiary, eligible test quantity, historical dividend event and payout cap, then locks the full reserve. The beneficiary authorizes one bounded collection mandate. The agent buys the exact EODHD response through x402, verifies it, and submits a permissionless claim. The contract sends funds only to the beneficiary fixed before funding; the issuer has no override that can approve a forged proof or redirect the payout.

This is one **test synthetic position**, not actual shares, brokerage ownership or a backed security. API fees use Base Sepolia aUSD. Collateral and payout use a separate six-decimal test token, **tdUSD**.

[Public repository](https://github.com/ABerkeBora/heka-dividend-bond) · [API3 requirements and evidence](TRACK_REQUIREMENTS.md) · [Security review](SECURITY_REVIEW.md) · [Presentation outline](PRESENTATION.md)

## Run locally

Requires Node.js **22.18 or later** and npm. [Foundry](https://getfoundry.sh/) is required to compile or test Solidity; the shipped ABI and bytecode in `artifacts/` allow a read-only review without it. Solidity dependencies are included in `lib/`; no parent repository or shared local files are required.

```sh
git clone https://github.com/ABerkeBora/heka-dividend-bond.git
cd heka-dividend-bond
npm ci
npm run build
npm start
```

Open [localhost:3103](http://localhost:3103). `npm run dev` starts the development server. The server binds to `127.0.0.1`; it is intended for local use.

Reviewing deployed terms, balances, saved evidence and read-only response verification needs an available Base Sepolia RPC, **not a private key**. The default RPC is `https://sepolia.base.org`; an optional `.env` can override `RPC_URL`. Keep port3103. The server prefers freshly compiled artifacts when available and otherwise uses the included artifacts. Recompile contract changes with `forge build` before deploying them.

To deploy or collect with your own isolated **test-only** wallets, copy `.env.example` to `.env`, set `WALLET_FILE` to a local JSON file, and protect it with `chmod 600 /absolute/path/to/test-wallets.json`. Use the schema in `.env.example`: `testOnly: true`, `chainId: 84532`, `project: "dividend-bond"`, and separate `deployer`, `buyer` and `counterparty` roles. The deployer pays setup and collection gas and EODHD fees; buyer is the immutable beneficiary. Use aUSD from the [official event faucet](https://api3dao.github.io/airnodehub-hackathon/faucet/) and test ETH only. Keys, signed payment authorizations and local journals are ignored by Git. Never paste keys into the UI or model context.

## The collection

The shipped obligation uses AAPL.US, ex-dividend/record date **11 August 2025**, payment date **14 August 2025**, and **100 eligible test units**. EODHD returned an unadjusted declared dividend of **0.26 USD per unit**. The payout formula is `min(quantity × declaredDividend, cap)`, rounded down to six-decimal token atoms; this event yields **26.00 tdUSD** against a **50.00 tdUSD** funded cap. Quantity and declared dividend are parsed as integers/fixed point; JavaScript floating point does not authorize the transfer.

1. Review the fixed beneficiary, event, contract and mandate on the first screen.
2. Select **Authorize collection** once. The agent then purchases data, verifies the proof and submits the claim without a new manual payment click at every step.
3. Inspect **Data purchase → Verification → Claim sent → Funds received** and the separate API fee, gas and payout receipts.
4. Select **Run reconciliation** after collection. The same logical obligation produces no new API purchase or second payout.

| Delegated term | Bound |
| --- | --- |
| Network / API asset | Base Sepolia, chain 84532 / aUSD `0xbeA34973e5f67F18F656A2C6070C64326C791808` |
| Allowed data service | `https://airnode-eodhd.fly.dev/`, pinned `dividendHistory` request below |
| Data fee recipient | `0x1505FD562AC2Fb4307B85BC6c672FfeafB4d57A7` |
| Advertised / observed data price | 5,000 aUSD atoms = 0.005 aUSD per call |
| Per-call / total data cap | 10,000 / 50,000 aUSD atoms = 0.01 / 0.05 aUSD |
| Maximum data purchases / claims | 2 / 1; no automatic top-up |
| Mandate duration | 1,800 seconds |
| Claim gas budget | 200,000,000,000,000 wei = 0.0002 test ETH; setup gas excluded |
| Collection destination | Only the configured DividendBond contract; payout only to its immutable beneficiary |

API budgets, allowed tools and wallet execution are guarded by application code and an isolated funded wallet. The contract enforces the proof policy, immutable payout recipient, reserve and one-claim rule. **The mandate is not an on-chain API spending allowance.** The transaction has a hard L2 gas/maxFee bound. Base's additional L1 data fee is checked using an estimate with margin and recorded from the actual receipt; it has no equivalent absolute EIP-1559 transaction cap.

Signed payment authorizations are journaled before sending the paid request. Every signed authorization reserves its full amount, including an uncertain outcome. An unknown payment blocks another authorization for the same intent. A confirmed response is reused. Workflow and payment filesystem locks prevent concurrent processes from paying twice. The claim transaction is signed and its hash recorded before broadcast; receipt reconciliation precedes a retry of the same transaction.

If a process stops during collection, run `npm run recover`. It resumes the existing mandate and only releases locks whose local owning process is provably dead. Live, foreign or unknown owners remain blocked. It does not create a new mandate or silently pay again for an unknown response. See [the recovery details](SECURITY_REVIEW.md).

## Deployed evidence

Network: **Base Sepolia**, chain ID **84532**. The selected obligation is **bond-02**, funded after the signed raw-event cardinality check. The first completed run is retained under `evidence/scenarios/bond-01/`.

| Evidence | Link |
| --- | --- |
| DividendBond | [`0x4b6a7feb8f0e9bb1ba51ad7921f352e0a4ee6e5b`](https://sepolia.basescan.org/address/0x4b6a7feb8f0e9bb1ba51ad7921f352e0a4ee6e5b) |
| tdUSD collateral token | [`0x1c94037d2c84879ae78e66d29a9d5e03856440ae`](https://sepolia.basescan.org/address/0x1c94037d2c84879ae78e66d29a9d5e03856440ae) |
| Bond deployment | [Confirmed transaction](https://sepolia.basescan.org/tx/0xbfd70e31ba7dac293cd5ecc38b1a1877beca7d81f04ce7650df532ffcca3015a) |
| 50 tdUSD reserve funding | [Confirmed transaction](https://sepolia.basescan.org/tx/0x377c4ad760b40272256d9e3ecab1e33d2ccf61d790a26dcdadb1dc13796df483) |
| Technical EODHD preflight fee | [0.005 aUSD transaction](https://sepolia.basescan.org/tx/0x19538f247ce1bddba16649310a63cf0aa7a64f6512ed4a418824da49c5af69d2) |
| Technical raw-event cardinality check | [0.005 aUSD transaction](https://sepolia.basescan.org/tx/0x81388a8e85e7fa97009f1ccdcbc57630688c366a230ece3e398bb6efbbcf2f11), one matching raw record in `evidence/event-discovery.json` |
| First run's customer data purchase | [0.005 aUSD transaction](https://sepolia.basescan.org/tx/0x27c20b26877615683243a7701aa9f16c8e8f56a4397e056c017710352d8a90a2), archived with bond-01 |
| First run's collection / payout | [Confirmed 26 tdUSD claim](https://sepolia.basescan.org/tx/0x95fa0be4bb9e8b6e4ddae7d47dd6ef7f892948191cdb0f657aef29fb109cb374), reconciled in `evidence/scenarios/bond-01/collection.json` |
| Selected bond-02 customer data purchase | [0.005 aUSD transaction](https://sepolia.basescan.org/tx/0x0baa356f7a5ed239fdd6dc220c191f28f2c501111d362d5168c328c248e1bc14) |
| Selected bond-02 collection | [Confirmed 26 tdUSD claim](https://sepolia.basescan.org/tx/0xf4419dba4bdd1f320074257d4f618bf7120136ab563c251c417b4218edc7acd3), reconciled in `evidence/collection.json` |

The selected `evidence/collection.json` records the real delegated flow from one initial authorization: a separate 0.005 aUSD customer data purchase, verified proof, agent-submitted claim and beneficiary increase of 26,000,000 tdUSD atoms. The first run's corresponding evidence remains archived. `evidence/deployment.json` records immutable terms and setup transactions; `evidence/request-manifest.json` pins source semantics and request identity; `evidence/preflight.json` preserves the earlier technical paid response and its separate data payment. `evidence/event-discovery.json` contains a second fixed technical request without projection, confirming exactly one matching raw event before funding bond-02. Its distinct discovery request hash does not change the product's pinned request. These saved responses naturally become stale; their original timestamps are preserved.

`evidence/tamper-live.json` records all four required rejection cases against the actual deployed verifier, with token balances and consumption state. Rejections are **read-only `eth_call` simulations**, not broadcast reverted transactions. While the bond was active, the test simulated `claimFor`; after consumption it uses `validateResponse` so `InvalidState` does not mask the actual proof rejection. Contract tests additionally exercise rejected claim state/fund invariants. Successful live payout evidence is separate.

## Judges: submit your own response

Open **Verify a response & inspect evidence**, paste the signed envelope and select **Check response**. Or save it as JSON and run:

```sh
npm run submit-response -- /absolute/path/to/response.json
```

The envelope must contain `airnode`, `requestHash`, `timestamp`, `data` and `signature`. Keep `data` exactly as the Airnode returned it, including whitespace and number representation. This script verifies off-chain and calls the deployed `validateResponse` read-only; it cannot release funds and needs no signing wallet. A stale saved response should reject with `ResponseTooOld`, even if its signature remains authentic.

```sh
# Four negative cases from genuine captured responses; no paid API call or broadcast.
npm run tamper:live
# Optionally select a fresh envelope already obtained from the pinned request.
npm run tamper:live -- /absolute/path/to/fresh-response.json
```

The wrong-request fixture is a genuine, independently verified EODHD `searchInstruments` response signed by the same expected Airnode. The wrong-signer fixture uses a clearly labeled public local test key; it never holds funds. The stale case ages a genuine envelope without editing its timestamp. The edited-value case changes the dividend while preserving the original signature.

The deployed `claimFor(timestamp, dataBytes, signature)` is permissionless for anyone using their own wallet. It accepts one valid claim only, while the obligation is active, and always pays the stored beneficiary. The read-only script is the default judging path; the agent collection is the actual transaction path.

## Exact data request and trust model

```json
{
  "operation": "dividendHistory",
  "parameters": {"ticker": "AAPL.US", "from": "2025-08-11", "to": "2025-08-11"},
  "responseProjection": {
    "eventDate": "/0/date",
    "recordDate": "/0/recordDate",
    "paymentDate": "/0/paymentDate",
    "declaredDividend": "/0/unadjustedValue",
    "currency": "/0/currency"
  }
}
```

Expected signer: `0xDaF9D3493e556e9f25b34A3c366795F81e90c6fe`. Independently derived request hash: `0x126a0237bcd5538d8833c4ed4605d2e5be13b37157c3de50a32ed8e0b43ec299`.

EODHD's `from`/`to` filter is based on the **ex-dividend date**. `unadjustedValue` is the declared amount; `value` can be adjusted for subsequent splits. The contract checks exact event and payment dates, a valid record date, USD, a positive bounded amount, envelope age at most 300 seconds and future clock skew at most 60 seconds. It also requires the payment date to have passed. This historical record has no separate upstream update timestamp; a fresh signature does not establish that a historical event can never be revised.

Before funding a fresh scenario, the fixed CLI discovery recipe checks the same date-filtered raw array and requires exactly one matching event. It has a separate 10,000-atom total cap and one data action, and cannot accept arbitrary request parameters. The captured snapshot returned exactly one record. This check prevents choosing an arbitrary first record from an observed ambiguous dataset; later upstream revisions remain source risk.

The beneficiary relies on the signed amount to collect the issuer's reserve. A forged amount could overpay or drain it; an issuer-controlled fake amount could underpay the beneficiary. Removing authenticated AirnodeHub data prevents this contract from claiming. There is no admin settlement bypass.

A signature authenticates the exact response from the pinned Airnode. It does not independently prove EODHD's underlying facts, real securities ownership, eligibility at a broker, withholding tax or external backing. The test quantity comes from this agreement. Missing fields, null dates, API errors and schema changes fail closed. The API does not provide brokerage ownership evidence; the application does not invent it.

The whole cap is locked before activation. On a successful 26 tdUSD claim the remaining 24 tdUSD returns to the issuer. After the fixed 24-hour deadline plus one additional claimable hour, an unclaimed obligation can be voided permissionlessly and its reserve returned to the issuer. That is a test contract expiry rule, not a claim about legal dividend rights. A paid API fee or reverted transaction gas is not refunded by a later proof failure.

## Verification and fresh scenarios

```sh
npm run check
npm test
npm run contracts:test
npm run build
```

The server suite covers mandate caps, exact recipients/assets/network, malformed policies, expiry, unknown-intent blocking, reservation recovery and actual subprocess lock contention. Foundry tests cover fixed-point rounding/cap, reserve protection, permissionless payout, double claim, expiry, missing data and the four proof rejection cases. Genuine-response fixtures are labeled separately from synthetic local-signer policy tests.

`npm run acceptance` records a real collected-intent rerun alongside deterministic blocked-policy checks in `evidence/acceptance.json`; it verifies no second data purchase or payout. It does not buy a fresh response. The original successful chain receipts remain separate from these guard checks.

Deployment uses only the configured isolated test roles. To open a new sample after the current obligation is claimed or void:

```sh
# Choose an unused scenario name; this deploys and funds another isolated test obligation.
npm run fresh -- bond-next
```

The helper refuses to hide an active reserve. It archives the previous public evidence under `evidence/scenarios/<id>/`, preserves named deployment/transaction journals under `.local/`, archives the old mandate journal, and selects the new funded bond without presenting an old receipt as its payout. Do not delete chain history to reset the view. `npm run deploy -- <id>` is the lower-level idempotent setup command; use `fresh` for an existing application's next sample. Running `npm run collect` performs the same initial authorization and autonomous collection from the CLI and spends test fees; do not run it merely to inspect a receipt. `npm run preflight` uses a cached technical intent and is not a request for a new fresh proof. `npm run discover-event` performs the single fixed, capped raw-event discovery setup; its receipt is separate from customer collection.

## Submission preparation

Only **API3** is selected. The [official API3 rules](https://hackathon.tum-blockchain.com/prizes#api3) require meaningful on-chain use of authenticated data, deployed signer/request/time verification, duplicate protection, the valid case and all four rejected cases, contract/network, a response-submission path and the data/trust explanation. [General rules](https://hackathon.tum-blockchain.com/prizes#how-to-submit) require a public repository, setup README, detailed description and a video of at most 2.5 minutes. The published deadline is 31 October 2026 at 15:00 Europe/Berlin; one Devfolio submission is permitted per team, with up to three partner tracks.

[PRESENTATION.md](PRESENTATION.md) is a timed outline and [SUBMISSION_DRAFT.md](SUBMISSION_DRAFT.md) is draft copy. **A video has not been recorded or a Devfolio entry submitted by this repository task.** See `TRACK_REQUIREMENTS.md` and `MORNING_HANDOFF.md` for the final PASS/PENDING/BLOCKED evidence reconciliation; an outline is not a completed competition video.

The Airnode client, attestation verifier and projected JSON helpers come from the [official API3 starter](https://github.com/api3dao/airnodehub-hackathon-starter), pinned at `52933ae1fb9371446a927338473466c3d320e19a`. Upstream licenses and pinned Solidity dependencies are retained. The product does not claim to register a new trusted API or to establish a new oracle network.
