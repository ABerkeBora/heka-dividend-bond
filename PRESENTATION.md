# Dividend Bond — 2:30 presentation outline

This is a recording plan, not a completed video. Record only actual states and receipts. Do not present a saved stale proof as freshly accepted or read-only rejection simulations as broadcast transactions.

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:20 | Funded AAPL.US obligation, beneficiary, 100 test units and 50 tdUSD cap | “An issuer promises a dividend-linked payment. If its own backend also decides the amount and whether to pay, the beneficiary still depends on it. Dividend Bond locks one obligation and lets an independent agent collect it.” |
| 0:20–0:50 | Review bounded mandate, authorize once, data-purchase receipt | “The agent can buy only this exact EODHD request, on Base Sepolia, in aUSD, from this payee. The per-call cap is 0.01 aUSD, total cap 0.05, with two data actions, one claim and thirty minutes. The observed request costs 0.005 aUSD.” |
| 0:50–1:15 | Verification, claim transaction, `Claimed` event and beneficiary token increase | “The deployed contract checks the expected signer, exact request and timing. EODHD's declared 0.26 USD multiplied by 100 fixed test units yields 26 tdUSD. The agent submits the permissionless claim; the recipient was fixed before funding. API payment, gas and payout are separate receipts.” |
| 1:15–2:05 | Run four tamper cases; display exact rejection and unchanged protected state | “Edit the value: rejected. Replay an authentic stale envelope: rejected. Submit a real response to another request, signed by the same Airnode: rejected. Sign with a different key: rejected. These calls exercise the deployed verifier through read-only `eth_call`; contract tests also check rejected claims cannot change reserves or the consumed flag.” |
| 2:05–2:30 | Run reconciliation, unchanged payment/claim hashes, trust note | “Re-running this intent reads the receipt. It does not purchase again or pay the dividend twice. This is a historical synthetic test position. The signature authenticates EODHD's response; it does not prove real brokerage ownership or guarantee upstream truth.” |

## Before recording

- Use a fresh named funded scenario for the authorization-to-payout recording. Preserve the prior chain evidence. Confirm the mandate, API price, gas budget and beneficiary before authorizing.
- Keep one genuine earlier response for the stale case and preserve its original timestamp. Run `npm run tamper:live -- /absolute/path/to/fresh-response.json` while the fresh proof is timely if the recording needs a valid static comparison too.
- Show the real payout transaction and beneficiary increase. `evidence/preflight.json` proves only a technical data purchase; it cannot stand in for collection.
- Keep the whole video at or below 150 seconds. Use the receipt hashes already in the UI or evidence files; never type invented hashes or success states.

## Current evidence to open

- Bond: [Base Sepolia contract](https://sepolia.basescan.org/address/0x4b6a7feb8f0e9bb1ba51ad7921f352e0a4ee6e5b).
- Reserve: [funding transaction](https://sepolia.basescan.org/tx/0x377c4ad760b40272256d9e3ecab1e33d2ccf61d790a26dcdadb1dc13796df483).
- `evidence/request-manifest.json`: exact operation, projection, signer and terms.
- Prior bond-01 data purchase: [0.005 aUSD transaction](https://sepolia.basescan.org/tx/0x27c20b26877615683243a7701aa9f16c8e8f56a4397e056c017710352d8a90a2).
- Prior bond-01 collection: [agent-submitted 26 tdUSD claim](https://sepolia.basescan.org/tx/0x95fa0be4bb9e8b6e4ddae7d47dd6ef7f892948191cdb0f657aef29fb109cb374); its archive is `evidence/scenarios/bond-01/collection.json`.
- Selected bond-02 was funded after the raw-event uniqueness check. Its own [0.005 aUSD data payment](https://sepolia.basescan.org/tx/0x0baa356f7a5ed239fdd6dc220c191f28f2c501111d362d5168c328c248e1bc14) and [26 tdUSD collection](https://sepolia.basescan.org/tx/0xf4419dba4bdd1f320074257d4f618bf7120136ab563c251c417b4218edc7acd3) are recorded in `evidence/collection.json`.
- `evidence/tamper-live.json`: four genuine-data rejection cases and recorded state/balance reads; `broadcastTransactions` identifies the read-only method.

## Submission boundary

The official general deadline is 31 October 2026, 15:00 Europe/Berlin, subject to the final rule recheck. One Devfolio submission is allowed per team. This task prepares source, evidence, draft copy and this outline; the user records and submits the competition entry separately.
