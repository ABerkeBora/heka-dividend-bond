import './style.css';

type Json = Record<string, any>;
type Step = { name: string; status?: string; at?: string | number; detail?: string; txHash?: string };
type AppState = {
  network?: { name?: string; chainId?: number; explorer?: string };
  deployment?: { contractAddress?: string; tokenAddress?: string; txHash?: string } | null;
  agreement?: Json | null;
  policy?: Json;
  journal?: (Json & { steps?: Step[] }) | null;
  balances?: Json;
  evidence?: Json;
  independence?: Json;
  updatedAt?: string | number;
  error?: string;
};

const isIndependent = window.location.pathname === '/next' || window.location.pathname === '/next/';
const apiPrefix = isIndependent ? '/api/v2' : '/api';
if (isIndependent) document.title = 'Dividend Bond — Independent collector';
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="shell topbar">
    <div class="brand"><svg viewBox="0 0 28 34" fill="none" aria-hidden="true"><path d="M6 3h5c9 0 13 6 13 14s-4 14-13 14H6V3Z" stroke="currentColor" stroke-width="1.6"/><path d="M2 12h13M2 22h13" stroke="currentColor" stroke-width="1.6"/></svg><span>Dividend Bond</span></div>
    <span class="network" id="network">Connecting to chain</span>
  </header>
  <nav class="shell route-nav" aria-label="Collection flows"><a href="/"${!isIndependent ? ' aria-current="page"' : ''}>V1 collection</a><a href="/next"${isIndependent ? ' aria-current="page"' : ''}>Independent collector</a></nav>
  <main class="shell${isIndependent ? ' independent-flow' : ''}" data-ui>
    <div class="titlebar">
      <div><h1>${isIndependent ? 'Independent collection' : 'Dividend collection'}</h1><p id="finding">A funded obligation. One bounded collection mandate.</p></div>
      <div class="freshness"><span id="freshness">Loading account</span><button class="text-button" id="refresh">Refresh status</button><button class="mobile-review" id="review-mandate">Review mandate</button></div>
    </div>
    <div class="error" id="connection-error" role="alert" hidden></div>
    ${isIndependent ? '<section class="panel independence-overview" aria-labelledby="independence-heading"><div class="independence-heading"><h2 id="independence-heading">Issuer setup & collector</h2><span id="independence-summary" class="small muted">Awaiting role evidence</span></div><div class="role-columns" id="role-columns"></div></section>' : ''}
    <div class="workspace">
      <section class="panel statement" aria-labelledby="obligation-heading">
        <div class="statement-head"><div><h2 class="ticker" id="obligation-heading">Dividend obligation</h2><p class="statement-kind">Historical event · Test synthetic position</p></div><span class="status" id="agreement-status">Loading</span></div>
        <div class="amount-row"><div><span class="amount-label" id="amount-label">Amount to collect</span><div class="amount" id="payout"><span class="loading-value">00.00</span> <span class="unit">tdUSD</span></div><p class="calculation" id="calculation">Awaiting authenticated dividend value</p></div><div class="reserve"><span class="muted" id="reserve-label">Funded payout cap</span><span class="value" id="reserve-value">—</span></div></div>
        <p class="rate-note" id="rate-note">A fresh authenticated proof is required to collect.</p>
        <dl class="event-dates"><div><dt>Ex-dividend</dt><dd id="event-date">—</dd></div><div><dt>Record date</dt><dd id="record-date">—</dd></div><div><dt>Payment date</dt><dd id="payment-date">—</dd></div></dl>
        <div class="settlement-terms" id="settlement-terms"></div>
        <div class="reserve-distribution" id="reserve-distribution"></div>
        <div class="recipient-row"><div><small class="muted">Fixed beneficiary</small><div id="beneficiary" class="address">—</div></div><div class="recipient"><small class="muted">Payment goes directly here</small><div id="claim-link" class="small">No collection submitted</div></div></div>
      </section>
      <section class="panel mandate" aria-labelledby="mandate-heading">
        <div class="panel-head"><h2 id="mandate-heading">${isIndependent ? 'Collector mandate' : 'Collection mandate'}</h2><span class="status" id="mandate-status">Not authorized</span></div>
        <div class="panel-body"><dl class="terms" id="mandate-terms"></dl><p class="gas-scope">L2 transaction cost is capped. The additional L1 data fee is estimated separately.</p><div class="mandate-actions"><button class="primary" id="authorize" disabled>Authorize collection</button><p class="action-caption" id="action-caption">Loading the funded obligation and its fixed terms.</p><p class="mandate-id" id="mandate-id" hidden></p></div></div>
      </section>
      <section class="panel ledger" aria-labelledby="ledger-heading">
        <div class="panel-head"><h2 id="ledger-heading">Collection ledger</h2><span class="muted small" id="ledger-mode">No mandate yet</span></div>
        <div class="panel-body"><ol class="ledger-list" id="ledger-list"></ol></div>
      </section>
      <section class="panel budget" aria-labelledby="budget-heading">
        <div class="panel-head"><h2 id="budget-heading">Costs & reserve</h2><span class="muted small">Separate funds</span></div>
        <div class="panel-body" id="budget-body"></div>
      </section>
    </div>
    <section class="proof-section" aria-label="Response verification and evidence">
      <details id="proof-details"><summary>Verify a response & inspect evidence</summary><div class="detail-content"><div class="detail-grid">
        <div><h2>Response check</h2><p class="verification-intro">Submit the original signed envelope to the deployed verifier. This read-only check cannot release funds.</p><form id="verify-form"><label for="response-input">Signed response JSON</label><textarea id="response-input" spellcheck="false" placeholder='{"timestamp":"…","data":"…","signature":"0x…"}' required aria-describedby="response-hint"></textarea><p id="response-hint" class="small muted" style="margin-top:6px">Keep the signed data string exactly as received.</p><div class="verify-controls"><button type="submit" id="verify">Check response</button><button type="button" class="text-button" id="load-response">Load saved response</button></div></form><div id="verify-result" class="verify-result" role="status" hidden></div></div>
        <div><h2>Fixed source & on-chain evidence</h2><dl class="source-list" id="source-list"></dl><p class="proof-note">An Airnode signature authenticates the exact response. EODHD remains the source of the dividend record; it does not prove external share ownership or backing.</p></div>
      </div></div></details>
    </section>
    ${isIndependent ? '<section class="independence-detail" aria-label="Collector independence evidence"><details><summary>Collector independence evidence</summary><div class="detail-content"><p class="verification-intro">The issuer funds the obligation first. This runtime uses the collector wallet to buy data and submit the claim.</p><dl class="independence-checks" id="independence-checks"></dl><p class="proof-note">The checks describe the recorded collector process and this collection window. Application guards bound API spending; the deployed contract fixes the beneficiary and enforces the proof and one-claim rule.</p></div></details></section>' : ''}
    <footer class="footer"><p>Test assets on Base Sepolia. Quantity and beneficiary are fixed by the funded contract. A paid data request may incur a fee even when a later proof is rejected.</p><a href="https://github.com/ABerkeBora/heka-dividend-bond" target="_blank" rel="noreferrer">Source & setup ↗</a></footer>
  </main>`;

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const short = (value: unknown, start = 7, end = 5) => {
  const text = String(value ?? '');
  return text.length > start + end + 2 ? `${text.slice(0, start)}…${text.slice(-end)}` : text || '—';
};
const integer = (value: unknown): bigint | null => {
  try { return value !== undefined && value !== null && value !== '' ? BigInt(String(value)) : null; } catch { return null; }
};
function units(value: unknown, decimals = 6, minimum = 2): string {
  const atoms = integer(value);
  if (atoms === null) return '—';
  const negative = atoms < 0n;
  const abs = negative ? -atoms : atoms;
  const scale = 10n ** BigInt(decimals);
  const whole = (abs / scale).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  let fraction = (abs % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  fraction = fraction.padEnd(Math.min(minimum, decimals), '0');
  return `${negative ? '−' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}
function time(value: unknown, includeDate = false): string {
  if (!value) return '—';
  const numeric = typeof value === 'number' || /^\d+$/.test(String(value));
  const date = new Date(numeric ? Number(value) * (Number(value) < 1e12 ? 1000 : 1) : String(value));
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', { ...(includeDate ? { day: '2-digit', month: 'short' as const } : {}), hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Berlin' }).format(date);
}
function dateLabel(value: unknown): string {
  if (!value) return '—';
  const numeric = typeof value === 'number' || /^\d+$/.test(String(value));
  const parsed = new Date(numeric ? Number(value) * (Number(value) < 1e12 ? 1000 : 1) : String(value));
  if (!Number.isFinite(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(parsed);
}
function statusClass(status: string): string {
  if (/confirmed|complete|claimed|received|valid|success/i.test(status)) return 'positive';
  if (/reject|fail|error|blocked|void/i.test(status)) return 'negative';
  if (/pending|running|unknown|reconcil|expir/i.test(status)) return 'warning';
  return '';
}
function statusLabel(status: unknown): string {
  if (!status) return '—';
  const text = String(status).replace(/[_-]/g, ' ').toLowerCase();
  return text[0].toUpperCase() + text.slice(1);
}
function setStatus(id: string, text: string) {
  el(id).textContent = text;
  el(id).className = `status ${statusClass(text)}`;
}
function explorerLink(kind: 'tx' | 'address', value: unknown, label?: string): string {
  const hash = String(value ?? '');
  if (!/^0x[0-9a-fA-F]+$/.test(hash)) return '—';
  const explorer = state?.network?.explorer?.replace(/\/$/, '') || 'https://sepolia.basescan.org';
  const safeExplorer = /^https:\/\/[a-z0-9.-]+$/i.test(explorer) ? explorer : 'https://sepolia.basescan.org';
  return `<a class="address-link" href="${safeExplorer}/${kind}/${hash}" title="${hash}" target="_blank" rel="noreferrer">${escapeHtml(label || short(hash))} ↗</a>`;
}
const term = (label: string, value: string, long = false) => `<div${long ? ' class="long"' : ''}><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`;
let state: AppState | null = null;
let pendingAction = false;
let actionError = '';
let evidenceCache: Json | null = null;
let fetching = false;

const canonicalSteps = ['Data purchase', 'Verification', 'Claim sent', 'Funds received'];
const stepDescriptions = [
  'Awaiting a mandate before purchasing EODHD data.',
  'Expected signer, exact request, event and timing are checked.',
  'The agent submits a permissionless claim within its gas cap.',
  'Payment is confirmed from the contract receipt and beneficiary balance.'
];

function render() {
  const agreement = state?.agreement || {};
  const policy = state?.policy || {};
  const journal = state?.journal;
  const deployment = state?.deployment;
  const independence = state?.independence || {};
  const claimed = Boolean(agreement.claimed || /claimed/i.test(agreement.status || ''));
  const symbol = agreement.payoutSymbol || 'tdUSD';
  const decimals = Number(agreement.payoutDecimals ?? 6);
  const rate = integer(agreement.declaredDividendAtoms);
  const quantity = integer(agreement.quantityAtoms);
  const cap = integer(agreement.payoutCapAtoms);
  const quantityDecimals = Number(agreement.quantityDecimals ?? 0);
  const expected = rate !== null && quantity !== null ? rate * quantity / 10n ** BigInt(quantityDecimals) : null;
  const calculated = expected !== null && cap !== null ? (expected < cap ? expected : cap) : null;
  const payout = claimed ? agreement.payoutAtoms : (agreement.previewPayoutAtoms ?? calculated);
  const reserveAtoms = integer(state?.balances?.reserveAtoms ?? agreement.reserveAtoms);
  const paidAtoms = claimed ? (integer(agreement.payoutAtoms) ?? 0n) : 0n;
  const returnedAtoms = integer(agreement.returnedAtoms) ?? (claimed && cap !== null ? cap - paidAtoms : /void/i.test(agreement.status || '') ? cap ?? 0n : 0n);
  const fundedAtoms = reserveAtoms !== null ? reserveAtoms + paidAtoms + returnedAtoms : null;
  if (calculated !== null && agreement.previewPayoutAtoms !== undefined) console.assert(integer(agreement.previewPayoutAtoms) === calculated, 'Payout must reconcile with quantity, declared rate and cap');

  el('network').textContent = state?.network?.name || 'Base Sepolia';
  el('freshness').textContent = state?.updatedAt ? `Updated ${time(state.updatedAt)}` : 'Awaiting account';
  el('obligation-heading').textContent = agreement.ticker ? `${agreement.ticker} dividend` : 'Dividend obligation';
  setStatus('agreement-status', agreement.status ? statusLabel(agreement.status) : 'Not deployed');
  el('amount-label').textContent = claimed ? 'Funds received' : 'Expected collection';
  el('payout').innerHTML = `${payout !== null && payout !== undefined ? escapeHtml(units(payout, decimals)) : '<span class="muted">—</span>'} <span class="unit">${escapeHtml(symbol)}</span>`;
  el('calculation').textContent = rate !== null && quantity !== null ? `${units(quantity, quantityDecimals, 0)} eligible units × ${units(rate, decimals)} USD declared per unit` : 'Awaiting authenticated dividend value';
  el('rate-note').textContent = claimed ? 'USD-denominated dividend, paid 1:1 in tdUSD test tokens.' : rate !== null ? 'Last authenticated rate. A fresh proof is rechecked before collection; USD is paid 1:1 in tdUSD test tokens.' : 'A fresh authenticated dividend proof is required to collect.';
  el('reserve-value').textContent = `${units(agreement.payoutCapAtoms, decimals)} ${symbol}`;
  el('event-date').textContent = dateLabel(agreement.eventDate);
  el('record-date').textContent = dateLabel(agreement.recordDate);
  el('payment-date').textContent = dateLabel(agreement.paymentDate);
  const graceSeconds = Number(agreement.voidGrace ?? 3600);
  const graceText = graceSeconds % 3600 === 0 ? `${graceSeconds / 3600} hour${graceSeconds === 3600 ? '' : 's'}` : `${Math.floor(graceSeconds / 60)} minutes`;
  el('settlement-terms').innerHTML = `<div><span class="small muted">Claim deadline</span><p class="num">${agreement.claimDeadline ? `${escapeHtml(dateLabel(agreement.claimDeadline))} · ${escapeHtml(time(agreement.claimDeadline))} Berlin` : '—'}</p></div><p class="small muted">${escapeHtml(graceText)} of additional claimable grace. After that, the issuer may reclaim the unused reserve.</p>`;
  const paidShare = fundedAtoms !== null && fundedAtoms > 0n ? Number(paidAtoms * 10000n / fundedAtoms) / 100 : 0;
  const returnedShare = fundedAtoms !== null && fundedAtoms > 0n ? Number(returnedAtoms * 10000n / fundedAtoms) / 100 : 0;
  el('reserve-distribution').innerHTML = `<div class="distribution-heading"><h3>Reserve distribution</h3><span class="small muted num">${units(fundedAtoms, decimals)} ${escapeHtml(symbol)} funded</span></div><div class="distribution-track" aria-hidden="true"><span class="distribution-paid" style="width:${paidShare}%"></span><span class="distribution-returned" style="width:${returnedShare}%"></span></div><dl class="distribution-values"><div><dt>Beneficiary paid</dt><dd class="num">${units(paidAtoms, decimals)} <span>${escapeHtml(symbol)}</span></dd></div><div><dt>Issuer surplus returned</dt><dd class="num">${units(returnedAtoms, decimals)} <span>${escapeHtml(symbol)}</span></dd></div><div><dt>Still locked</dt><dd class="num">${units(reserveAtoms, decimals)} <span>${escapeHtml(symbol)}</span></dd></div></dl>`;
  el('beneficiary').innerHTML = explorerLink('address', agreement.beneficiary);
  el('claim-link').innerHTML = journal?.claimTx ? explorerLink('tx', journal.claimTx, 'Collection receipt') : 'No collection submitted';

  const expires = journal?.expiresAt ? `${time(journal.expiresAt)} Berlin` : `${Math.floor(Number(policy.expirySeconds ?? 1800) / 60)} minutes`;
  el('mandate-terms').innerHTML = [
    term('Listed data price / call', `${units(policy.dataPriceAtoms ?? '5000', 6, 3)} aUSD`),
    term('Per-call data cap', `${units(policy.perCallCapAtoms ?? '10000', 6, 3)} aUSD`),
    term('Total data budget', `${units(policy.dataBudgetAtoms ?? '50000', 6, 3)} aUSD`),
    term('Claim gas budget', `${units(policy.gasBudgetWei ?? '200000000000000', 18, 0)} test ETH`),
    term('Maximum actions', `${escapeHtml(policy.maxActions ?? 2)} data · 1 claim`),
    term(journal?.expiresAt ? 'Mandate expires' : 'Authorization lasts', escapeHtml(expires)),
    term('EODHD fee recipient', `<span class="address">${explorerLink('address', policy.payee)}</span>`),
    term('Allowed collection contract', `<span class="address">${explorerLink('address', deployment?.contractAddress)}</span>`, true),
  ].join('');
  setStatus('mandate-status', journal ? statusLabel(journal.status || 'Authorized') : 'Not authorized');
  const action = el<HTMLButtonElement>('authorize');
  const isRunning = pendingAction || /running|purchasing|verifying|submitting|pending/i.test(journal?.status || '');
  action.textContent = pendingAction ? 'Collection in progress…' : claimed ? 'Run reconciliation' : journal ? 'Resume collection' : isIndependent ? 'Authorize independent collection' : 'Authorize collection';
  action.disabled = pendingAction || !deployment?.contractAddress || !agreement.beneficiary;
  el<HTMLButtonElement>('review-mandate').textContent = claimed ? 'Review collection' : 'Review mandate';
  el('action-caption').textContent = actionError || (claimed
    ? 'Already collected. Reconciliation checks the receipt without buying data or paying again.'
    : journal?.error || (isRunning ? 'The agent is buying data, checking proof and collecting within this mandate.'
      : journal ? 'Resume this intent. A settled purchase is reused; uncertain payments require reconciliation.'
        : deployment?.contractAddress ? 'Authorize once. The agent buys the proof and collects directly to the fixed beneficiary.' : 'The obligation must be deployed and funded before authorization.'));
  el('mandate-id').hidden = !journal?.mandateId;
  el('mandate-id').textContent = journal?.mandateId ? `Mandate ${short(journal.mandateId, 13, 6)}` : '';
  el('ledger-mode').textContent = journal ? 'Persistent intent' : 'No mandate yet';
  el('finding').textContent = isIndependent
    ? claimed ? independence.payerMatchesCollector === true && independence.claimFromMatchesCollector === true ? 'The collector paid its own costs and triggered payment to the fixed beneficiary.' : 'Payment reached the beneficiary. Collector payment evidence is pending.'
      : journal?.error ? 'Independent collection paused. Review the collector’s latest decision.'
      : journal ? 'Issuer reserve funded. The collector buys proof and claims for the fixed beneficiary.'
      : deployment?.contractAddress ? 'Issuer reserve funded. The collector pays for data and gas to collect for the beneficiary.'
      : 'The issuer funds the reserve before a separate collector buys proof and claims.'
    : claimed ? 'The dividend reached the fixed beneficiary.' : journal?.error ? 'Collection paused. Review the agent’s latest decision.' : journal ? 'Your agent is collecting within the approved terms.' : 'Collect a funded dividend without relying on the issuer to act.';
  if (isIndependent) {
    const collector = independence.collector;
    const payer = independence.payer || (independence.payerMatchesCollector === true ? collector : null);
    const claimFrom = independence.claimFrom || (independence.claimFromMatchesCollector === true ? collector : null);
    const funded = /active|claimed/i.test(agreement.status || '') && Boolean(deployment?.contractAddress);
    const isolated = independence.collectorSecretOnly === true && independence.issuerReadDenied === true && independence.runtimeRestricted === true;
    el('independence-summary').textContent = claimed && independence.payerMatchesCollector === true && independence.claimFromMatchesCollector === true ? 'Collection confirmed · Issuer setup complete' : !funded ? 'Issuer setup pending' : isolated ? 'Issuer setup complete · Collector ready' : 'Issuer setup complete · Collector checks pending';
    el('role-columns').innerHTML = `<div><span class="small muted">Issuer funds reserve</span><p class="address">${explorerLink('address', independence.issuer)}</p><p class="role-caption">${funded ? 'Reserve funded before collection' : 'Awaiting funded obligation'}</p></div><div><span class="small muted">Collector pays data & gas</span><p class="address">${explorerLink('address', collector)}</p><p class="role-caption">Data payer: ${payer ? explorerLink('address', payer) : '—'}</p></div><div><span class="small muted">Claim transaction sender</span><p class="address">${explorerLink('address', claimFrom)}</p><p class="role-caption">${independence.claimFromMatchesCollector === true ? 'Confirmed collector sender' : claimed ? 'Sender evidence pending' : 'No claim submitted yet'}</p></div>`;
    const check = (value: unknown, yes: string, no: string) => value === true ? `<span class="check-result positive">${yes}</span>` : value === false ? `<span class="check-result negative">${no}</span>` : '<span class="muted">—</span>';
    el('independence-checks').innerHTML = [
      term('Issuer', `<span class="address">${explorerLink('address', independence.issuer)}</span>`),
      term('Collector', `<span class="address">${explorerLink('address', collector)}</span>`),
      term('Actual data payer', `<span class="address">${explorerLink('address', payer)}</span>`),
      term('Actual claim sender', `<span class="address">${explorerLink('address', claimFrom)}</span>`),
      term('Issuer nonce before / after', `${escapeHtml(independence.issuerNonceBefore ?? '—')} / ${escapeHtml(independence.issuerNonceAfter ?? '—')}`),
      term('Issuer nonce unchanged', check(independence.issuerUnchanged, 'Confirmed', 'Changed')),
      term('Only collector wallet loaded', check(independence.collectorSecretOnly, 'Confirmed', 'Not confirmed')),
      term('Issuer key read denied', check(independence.issuerReadDenied, 'Confirmed', 'Not denied')),
      term('Restricted runtime', check(independence.runtimeRestricted, 'Confirmed', 'Not restricted')),
      term('Data payer is collector', check(independence.payerMatchesCollector, 'Confirmed', 'Mismatch')),
      term('Claim sender is collector', check(independence.claimFromMatchesCollector, 'Confirmed', 'Mismatch')),
    ].join('');
    if (!journal && !claimed && funded) el('action-caption').textContent = actionError || `Authorize once. The collector uses its own capped aUSD and gas budget. The payout goes directly to the fixed beneficiary.${isolated ? '' : ' Collector isolation evidence is pending.'}`;
  }

  const steps = journal?.steps || [];
  el('ledger-list').innerHTML = canonicalSteps.map((name, index) => {
    const matching = steps.filter(step => step.name === name);
    const step = matching.at(-1);
    const stepState = String(step?.status || 'waiting');
    const className = /complete|confirmed|success|valid|received/i.test(stepState) ? 'complete' : /fail|reject|error|blocked/i.test(stepState) ? 'failed' : /running|pending|submitted/i.test(stepState) ? 'running' : '';
    return `<li class="ledger-row ${className}"><span class="step-mark" aria-hidden="true"></span><div><div class="ledger-title">${name}</div><p class="ledger-detail">${escapeHtml(step?.detail || stepDescriptions[index])}</p>${step?.txHash ? `<span class="ledger-link">${explorerLink('tx', step.txHash, 'View transaction')}</span>` : ''}</div><div class="ledger-time">${step?.at ? time(step.at) : '<span class="muted">Waiting</span>'}</div></li>`;
  }).join('');

  const dataSpent = integer(journal?.dataSpentAtoms ?? '0') ?? 0n;
  const gasSpent = integer(journal?.gasSpentWei ?? '0') ?? 0n;
  const dataBudget = integer(policy.dataBudgetAtoms ?? '50000') ?? 50000n;
  const gasBudget = integer(policy.gasBudgetWei ?? '200000000000000') ?? 200000000000000n;
  const remainingData = dataBudget - dataSpent;
  const remainingGas = gasBudget - gasSpent;
  const percentage = dataBudget > 0 ? Math.max(0, Math.min(100, Number(dataSpent * 10000n / dataBudget) / 100)) : 0;
  el('budget-body').innerHTML = `
    <div class="budget-row"><div class="budget-line"><span>Data purchased</span><span class="num">${units(dataSpent, 6, 3)} aUSD</span></div><p class="budget-description">${units(remainingData, 6, 3)} aUSD remains of ${units(dataBudget, 6, 3)}</p><div class="budget-track" role="meter" aria-label="Data budget used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage}"><span style="width:${percentage}%"></span></div></div>
    <div class="budget-row"><div class="budget-line"><span>Claim gas spent</span><span class="num">${units(gasSpent, 18, 0)} test ETH</span></div><p class="budget-description">${units(remainingGas, 18, 0)} test ETH remains. Deployment gas excluded.</p></div>
    <div class="budget-row"><div class="budget-line"><span>Beneficiary payout</span><span class="num">${units(paidAtoms, decimals)} ${escapeHtml(symbol)}</span></div><p class="budget-description">${claimed ? 'Delivered to the fixed beneficiary by the claim transaction.' : 'No dividend payment has been made.'}</p></div>
    <div class="budget-row"><div class="budget-line"><span>Unused reserve returned</span><span class="num">${units(returnedAtoms, decimals)} ${escapeHtml(symbol)}</span></div><p class="budget-description">${returnedAtoms > 0n ? 'Returned to the issuer, separate from the beneficiary payment.' : 'No reserve has been returned to the issuer.'}</p></div>
    <div class="budget-row"><div class="budget-line"><span>Contract reserve</span><span class="num">${units(reserveAtoms, decimals)} ${escapeHtml(symbol)}</span></div><p class="budget-description">Issuer-funded collateral, separate from API fees.</p></div>`;
  const source = state?.evidence || {};
  el('source-list').innerHTML = [
    term('Source / operation', `EODHD · ${escapeHtml(policy.operation || 'dividendHistory')}`),
    term('Data payee', `<span class="address">${explorerLink('address', policy.payee)}</span>`),
    term('Expected Airnode signer', `<span class="address">${explorerLink('address', policy.signer)}</span>`),
    term('Exact request hash', `<span class="address">${escapeHtml(policy.requestHash || '—')}</span>`),
    term('Collection contract', `<span class="address">${explorerLink('address', deployment?.contractAddress)}</span>`),
    term('Payout token', `<span class="address">${explorerLink('address', deployment?.tokenAddress)}</span>`),
    term('Paid data receipt', journal?.paymentTx ? explorerLink('tx', journal.paymentTx, 'View x402 settlement') : 'No customer purchase recorded'),
    term('Saved integration evidence', source.available || Object.keys(source).length ? '<button type="button" class="text-button" id="view-evidence">Download evidence JSON</button>' : 'Awaiting integration evidence'),
  ].map(row => row.replace('<div', '<div')).join('');
  el('source-list').querySelector<HTMLButtonElement>('#view-evidence')?.addEventListener('click', downloadEvidence);
}

async function request(path: string, body?: Json): Promise<Json> {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({ error: `Server returned ${response.status}` }));
  if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status})`);
  return data;
}
async function refresh() {
  if (fetching) return;
  fetching = true;
  try {
    const data = await request(`${apiPrefix}/state`);
    state = (data.state || data) as AppState;
    el('connection-error').hidden = true;
    render();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    el('connection-error').innerHTML = `${escapeHtml(message)}${state?.updatedAt ? ` Last good status: ${escapeHtml(time(state.updatedAt))}.` : ''} <button type="button" class="text-button" id="retry-state">Retry status</button>`;
    el('connection-error').hidden = false;
    el('retry-state').addEventListener('click', refresh);
    el('freshness').textContent = state ? `Last good ${time(state.updatedAt)}` : 'Connection unavailable';
  } finally { fetching = false; }
}
async function collect() {
  if (pendingAction || !state) return;
  pendingAction = true;
  actionError = '';
  render();
  try {
    const data = await request(`${apiPrefix}/${state.journal || state.agreement?.claimed ? 'run' : 'authorize'}`, {});
    if (data.state) state = data.state;
    await refresh();
  } catch (error) {
    actionError = error instanceof Error ? error.message : String(error);
  } finally { pendingAction = false; render(); }
}
async function loadEvidence(): Promise<Json> {
  evidenceCache = await request(`${apiPrefix}/evidence`);
  return evidenceCache;
}
async function downloadEvidence() {
  try {
    const evidence = await loadEvidence();
    const href = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = isIndependent ? 'dividend-bond-independent-evidence.json' : 'dividend-bond-evidence.json';
    anchor.click();
    URL.revokeObjectURL(href);
  } catch (error) { showVerifyResult(false, error instanceof Error ? error.message : String(error)); }
}
function showVerifyResult(valid: boolean, message: string) {
  const result = el('verify-result');
  result.hidden = false;
  result.className = `verify-result ${valid ? 'positive' : 'negative'}`;
  result.textContent = message;
}
el('refresh').addEventListener('click', refresh);
el('review-mandate').addEventListener('click', () => {
  el('mandate-heading').scrollIntoView({ behavior: 'auto', block: 'start' });
  el('authorize').focus({ preventScroll: true });
});
el('authorize').addEventListener('click', collect);
el('verify-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = el<HTMLButtonElement>('verify');
  button.disabled = true;
  button.textContent = 'Checking…';
  try {
    const parsed = JSON.parse(el<HTMLTextAreaElement>('response-input').value);
    const response = parsed.response || parsed;
    if (!response.timestamp || typeof response.data !== 'string' || typeof response.signature !== 'string') throw new Error('Provide timestamp, the original data string and signature.');
    const result = await request(`${apiPrefix}/verify`, { response });
    const valid = Boolean(result.valid ?? result.accepted ?? result.ok);
    const message = result.message || result.error || (valid ? `Response accepted by the deployed verifier${result.payoutAtoms !== undefined ? ` · ${units(result.payoutAtoms, 6)} tdUSD` : ''}. Read-only check; no funds moved.` : 'Response rejected. Protected funds and claim state are unchanged.');
    showVerifyResult(valid, message);
  } catch (error) { showVerifyResult(false, error instanceof Error ? error.message : String(error)); }
  finally { button.disabled = false; button.textContent = 'Check response'; }
});
el('load-response').addEventListener('click', async () => {
  try {
    const evidence = await loadEvidence();
    const response = evidence.response || evidence.signedResponse || evidence.attestation || evidence.journal?.response || evidence.preflight?.response;
    if (!response) throw new Error('No saved signed response is available yet.');
    el<HTMLTextAreaElement>('response-input').value = JSON.stringify(response, null, 2);
    el('verify-result').hidden = true;
  } catch (error) { showVerifyResult(false, error instanceof Error ? error.message : String(error)); }
});
render();
void refresh();
setInterval(() => { if (!document.hidden) void refresh(); }, 5000);
