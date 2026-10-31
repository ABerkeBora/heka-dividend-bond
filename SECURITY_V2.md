# V2 security and independence boundary

V2 changes the executor and its key access, while preserving the V1 contract's proof policy. This is an implementation review and evidence map, not a professional audit or production custody claim.

## Issuer setup and collector execution

The trusted issuer setup process reads the project's isolated test roles, deploys a separate tdUSD and DividendBond, locks 50 tdUSD and allocates 50,000 aUSD atoms to a different collector address. It writes a `0600`, ignored collector-only key file under `.local/v2/`. That file has `testOnly`, chain 84532, project `dividend-bond`, scope `v2`, and one `collector` role. It contains no issuer, deployer, buyer or counterparty role map.

The collector runs in a separate native Node 24 process. V2 `payerAccount()` reads only the collector capability; `roles()` throws before issuer-key access. The collector must match the funded setup identity and differ from the issuer before an economic operation. A stored recipient or proposed amount cannot redirect the immutable contract payout.

The launcher passes a sanitized environment, not the parent environment. `WALLET_FILE` and `NODE_OPTIONS` are absent. The issuer path is passed only as a denial probe string, never its contents. V2 configuration does not load the parent `.env`. The worker's actual `fs.readFileSync` attempt on the original issuer file returns `ERR_ACCESS_DENIED`; `.env`, V1 journal and V1 public deployment reads are also denied in that process.

## Permission scope and limits

The launched worker has read capabilities for `server/`, `node_modules/`, `artifacts/`, `package.json`, `.local/v2/` and `evidence/v2/`. Its write capabilities cover only `.local/v2/` and `evidence/v2/`. It is not granted child-process, worker-thread or native-addon permission. TypeScript executes directly in Node 24; a TSX loader is not given broader worker filesystem access.

This is the Node permission model's trusted-code seat belt. It does **not** claim to contain hostile dependencies, malicious code under the same OS user, operating-system compromise or an operator who deliberately copies the issuer key into an allowed file. It is also not a network allowlist or a separate OS user/container. The application still pins the data host, request, asset and payee in deterministic execution guards. These limits follow the [official Node documentation](https://nodejs.org/docs/latest-v24.x/api/permissions.html).

The parent web/setup process remains trusted and can access the issuer role file when configured. The narrower claim is demonstrated: the actual collector process bought data and claimed using its own key while its issuer-file read was denied, and the issuer did not submit another transaction in that window.

## State and retry isolation

V1 retains its original paths and default runtime. `DIVIDEND_SCOPE=v2` maps shared helper reads/writes from `.local/...` and `evidence/...` into `.local/v2/...` and `evidence/v2/...`. Direct payment reservation scans and lock paths use the same scoped resolver. V2 rejects path traversal outside its namespaces and reads bundled contract artifacts rather than `out/`.

Private keys, signed EIP-3009 authorizations and signed raw transactions remain ignored. Public evidence includes receipt data, public addresses, consumed nonce observations and original Airnode attestations, never key material or payment signatures. Public collector schema evidence lists field names only.

State polling and read-only verification workers have no public-evidence write grant. They return current checks and replace only one ignored `.local/v2/runtime-last-read.json` diagnostic; they neither grow history nor rewrite recorded payment/runtime/independence evidence. Public proof recording is reserved for explicit probe, authorize, run, recover and reject-check commands. The first collection proof remains separately preserved in `collection-runtime.json`.

Payment authorization is persisted before the paid request, and each signed authorization reserves its whole amount. Unknown settlement cannot produce another authorization for the same intent. Saved body plus exact confirmed transfer can be reconciled; missing body is not invented. The consuming contract independently rechecks freshness. Claims persist the signed transaction hash before broadcast and reconcile the same receipt on retry. File writes use unique process/random temporary names and atomic rename, avoiding collisions between state and collection workers.

Workflow/payment locks are scoped separately from V1. Recovery requires an existing mandate and removes only a same-host lock with an owner proven dead by `ESRCH`; live, foreign or unknown ownership fails closed. It never creates a mandate or resets payment uncertainty. A clean checkout may reconcile the already consumed obligation without any signing key.

Keyless review labels original key-scope findings as recorded evidence only after checking the consumed chain state, matching recorded payment/claim hashes and collector identity, actual claim sender and the confirmed exact aUSD transfer. It reports `currentCollectorKeyAvailable: false`, a recorded timestamp and separate current runtime flags. An active economic action still requires the collector key and the funded setup identity.

## Funds, authority and fees

API caps and allowed execution tools are application-level guards, not an on-chain API allowance. Collector funding is small and isolated, but its full ETH balance is not claimed as a hard mandate cap. L2 gas/maxFee are bounded in the transaction; Base L1 data fee is estimated with margin and the actual receipt cost is recorded. API fees already settled and gas for broadcast reverted transactions are not undone by a later proof rejection.

On-chain authority remains the immutable expected Airnode, exact request hash, event/payment dates, currency, quantity, cap, timing checks and single-claim state. Only the recorded beneficiary receives the payout. Unused cap returns to the issuer after a valid claim, or the unclaimed cap becomes recoverable under the pre-agreed deadline-plus-grace rule. An Airnode signature authenticates source and bytes, not brokerage ownership or the absolute truth of EODHD's record.

## Evidence to inspect

- [collection-runtime.json](evidence/v2/collection-runtime.json): preserved first successful economic worker, collector-only schema and actual issuer read denial. Later runtime/reconciliation observations do not replace this evidence.
- [independence.json](evidence/v2/independence.json): issuer nonce **15 → 15**, collector **0 → 1**, actual data payer and claim `from` matching the collector.
- [acceptance.json](evidence/v2/acceptance.json): fourteen checks including a 5,000-atom aUSD transfer, consumed EIP-3009 authorization nonce, collector claim sender, 26,000,000-atom beneficiary payout and unchanged retry/restart balances.
- [reject-check.json](evidence/v2/reject-check.json): over-budget, wrong recipient and expired mandate rejected in the restricted process without an authorization or broadcast.
- [tamper-before-claim.json](evidence/v2/tamper-before-claim.json) and [tamper-live.json](evidence/v2/tamper-live.json): edited, stale, different-real-request and wrong-signer proof rejections against V2. These are explicitly read-only contract simulations; successful payout has a separate real transaction.
- `server/v2-runtime.test.ts`: seven tests covering actual permission-process denial, collector schema validation, namespace escape checks, bundled artifact access, scoped dead/live lock recovery and state/verification calls preserving public evidence bytes. The 64-test V1 suite is retained; combined final results are recorded in the handoff.

V1 preservation has its own `evidence/v2/v1-regression.json` and final handoff status. Public source, browser/build verification and the final rule recheck are reconciled by the parent delivery workflow; this security document does not promote unfinished submission items to PASS.
