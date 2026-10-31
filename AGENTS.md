# Dividend Bond contributor instructions

## Scope

This repository owns one locally runnable Dividend Bond application on port 3103 and Base Sepolia 84532. Work only inside this repository. The selected sponsor track is **API3 only**; BSV and Cardano are outside scope. Public source publishing is authorized for ABerkeBora/heka-dividend-bond; competition submission and hosted deployment are not part of this build.

## Authorized independent collector V2

V1 is frozen at tag `v1-baseline`, commit `3a177521c49a32b07ccbc1be3985df8a86eab0c8`; keep `/` and its receipts/state intact. V2 lives on branch `codex/next`, route `/next`, API `/api/v2`, `.local/v2/` and `evidence/v2/`. It uses a separate funded contract and token. The issuer setup command may load the selected project's test roles once; the collector runtime must not read issuer keys, parent `.env`, V1 journals or V1 evidence. Only its collector wallet is readable in a separate native Node24 permission process. Do not relax the read allowlist to the repository root or allow child processes/workers/addons. Node permissions are a trusted-code filesystem seat belt, not an adversarial sandbox.

After initial funding/mandate the collector pays EODHD and sends `claimFor` with its own signer; prove exact aUSD Transfer/authorization payer, actual claim sender, beneficiary and nonce changes. The issuer must submit no transaction during that collection window. Keep EIP-3009 authorization nonces distinct from EOA transaction nonces and facilitator gas. Preserve the first economic runtime proof separately from later reconciliation. Read-only state/verification must not overwrite public evidence or buy data. Reuse the shared policy/verifier/helpers; do not duplicate the whole application or build a general wallet platform. V2 needs fresh acceptance/rejection, retry/restart, tamper, V1 regression, browser QA and rule rechecks. Deliver `MORNING_HANDOFF_V2.md` and concise `REVIEW_SUMMARY.json` with both direct links and an evidence-based V1/V2 recommendation.

## Rules gates

Before changing the core application, open https://hackathon.tum-blockchain.com/prizes and select the actual **API3** tab. Read the complete selected section, submission evidence, judging guidance and the general How to submit tab. URL fragments can leave the default BSV content selected. Follow the official starter https://github.com/api3dao/airnodehub-hackathon-starter and linked guides. Record a Europe/Berlin timestamp and requirement-to-code-to-evidence table in TRACK_REQUIREMENTS.md before implementation. Reopen the rules at completion. Every mandatory item is PASS/PENDING/FAIL/BLOCKED; PASS needs real evidence. An outline does not count as a recorded submission video.

## Product constraints

One issuer, beneficiary, ticker, historical event and funded capped synthetic obligation at a time. No real share ownership/backing, security custody, investment advice or first-in-the-world claims. The issuer cannot alter the beneficiary, eligibility quantity, source, request hash, signer, dates or cap after funding. Authenticated unadjusted dividend drives a permissionless contract payout to the immutable beneficiary. No admin settlement bypass.

The initial bounded mandate delegates an actual economic action: the agent pays the pinned EODHD service in test aUSD, validates the response and initiates a claim from the issuer's funded reserve. A manual click for each payment is insufficient. Keep API fees, test ETH gas and tdUSD payout separate. Payer, recipient, asset/network, exact allowed tools/contracts, integer per-action/total caps, expiry and action count are explicit. The model never receives keys or arbitrary transaction authority. This implementation uses a deterministic agent; a runtime LLM is not claimed.

API spend/mandate guards are application-level with an isolated funded wallet; never label them on-chain allowances. The contract enforces immutable proof terms, reserve and one payout. The transaction bounds L2 gas and maxFee; Base L1 fees are estimated with margin and recorded, not absolutely capped by EIP-1559. No automatic top-ups. Unknown payment outcomes reserve budget and block a second authorization. Persist an intent and signed transaction hash before external action; reconcile receipts before retry. Never discard chain history to reset the sample.

## Source and trust

EODHD dividendHistory date filters are ex-dividend dates. Use unadjustedValue, not split-adjusted value. Confirm a unique raw event before opening a new obligation; a projected first element alone does not prove cardinality. Pin the recipe before exposure. Preserve original data UTF8 bytes and use the official API3 helpers. Verify stored signer, independently derived exact request and relevant dates/freshness. Missing/null fields, ambiguous source data or API errors fail closed. An Airnode signature authenticates a response, not upstream truth, broker eligibility or securities backing. Do not invent an upstream update timestamp.

## Security and verification

Use test assets only; no mainnet spend or new paid services without explicit authorization. Never request or publish private keys/recovery phrases. Wallet JSON and .env remain ignored and 0600. Do not change global Git identity. Verify repository-local author/committer maps to ABerkeBora before commits. Inspect the publishable tree for secrets and private material.

Run npm run check, npm test, forge test, npm run build and relevant actual integration checks. Prove a real delegated payment/payout, blocked budget/recipient action, duplicate/restart protection, and valid/edited/stale/wrong-request/wrong-signer cases with protected funds unchanged. Distinguish live eth_call rejection checks from broadcast transactions and local tests.

UI English; handoff Turkish. Use TasteSkill app-screen workflow when available. Keep the compact financial statement identity, primary collection task and meaningful honest states. Do not fabricate balances/hashes/success or copy another product's layout. Verify desktop/tablet/phone in a real browser, record screenshots and use authorized browser tooling. Deliver README, .env.example, lockfile, presentation outline, submission draft and honest MORNING_HANDOFF.md with incomplete competition items.
