# Dividend Bond V2 — 150-second presentation

Recording outline only. The user still needs to record the video and submit the competition entry. Show original receipts and recorded denial results; do not present read-only simulations as broadcast transactions.

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:20 | V1 `/` beside V2 `/next`, new funded contract and fixed beneficiary | “V1 established a permissionless dividend claim. V2 tests the stronger promise: after the issuer funds the obligation, a different collector can complete collection without issuer-key access or another issuer transaction.” |
| 0:20–0:45 | Initial mandate: exact event/request, recipients, aUSD/gas caps and expiry | “Authorize this one collection. The agent can buy only the pinned EODHD response, spend at most 0.01 aUSD per call and 0.05 in total, and claim only this funded obligation for this beneficiary.” |
| 0:45–1:10 | Collector's data receipt, claim receipt and 26 tdUSD increase | “The collector pays 0.005 aUSD. The signed unadjusted dividend is 0.26 USD; 100 fixed test units yield 26 tdUSD under the cap. The collector then sends `claimFor` with its own transaction key.” |
| 1:10–1:45 | Preserved economic runtime proof, exact transfer payer, claim `from`, issuer/collector nonce comparison | “The actual collector process contains only its collector key. An actual issuer-file read fails with ERR_ACCESS_DENIED. Issuer nonce stays 15 to 15; collector moves 0 to 1. The payment authorization nonce is separate: the x402 facilitator submits settlement, but the tokens come from the collector.” |
| 1:45–2:15 | Four V2 tamper rejections and three mandate guard rejections | “Edited dividend, authentic stale envelope, real response to another request, and a different signer all reject. Over-budget, wrong-payee and expired mandates also reject before payment. These negative contract calls are read-only simulations against the deployed verifier.” |
| 2:15–2:30 | Retry/recovery report, unchanged receipt hashes/balances and trust note | “A new process reconciles the same intent without another fee or payout. This is a historical synthetic test position. API3 authenticates the response; it does not prove brokerage ownership. Node permissions are a trusted-code seat belt, not a hostile-code sandbox.” |

## Open these receipts

- [V2 contract](https://sepolia.basescan.org/address/0x020c8bc7c9d4e3fdde1af6d9ad31a284850289ba).
- [Collector's 0.005 aUSD data payment](https://sepolia.basescan.org/tx/0x84a9bd85caec8f0d30974545c56c4633ec1ffe80deef8e34f8928829dabce7b3).
- [Collector's 26 tdUSD claim](https://sepolia.basescan.org/tx/0x9dc93dca56d5c3b5418d9d31f6bc613abebc487897f3a2ce49419c296c6ca4d4).
- `evidence/v2/collection-runtime.json`, `independence.json`, `acceptance.json` and the two tamper reports.

The shipped obligation is already consumed. Reconciliation can be recorded directly; a complete new authorization-to-payout take needs a separately prepared fresh obligation, for which there is no general V2 reset helper. Do not delete journals, replay the old receipt as a new payment or spend again merely to refresh a screen. Retain the original live capture/evidence for the successful path.

The video must be at most 150 seconds. API3 is the selected partner track. General rules permit one Devfolio submission per team; the published deadline is 31 October 2026 at 15:00 Europe/Berlin, subject to the final rule recheck. No video or Devfolio submission is claimed complete here.
