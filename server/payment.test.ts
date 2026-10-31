import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {encodeAbiParameters,encodeEventTopics,toHex} from 'viem';
import {policy,requestHash} from './config.ts';
import {guardRequirement,validateMandate,committedUsage,buyData,buyDiscoveryData,paymentSummary,verifyPaymentResult,reconcilePayment} from './payment.ts';
import {publicClient} from './chain.ts';
import {now,root,write} from './store.ts';
import {withLock} from './lock.ts';
import {clearDeadLocks} from '../scripts/recover.ts';

const mandate=()=>({...policy,mandateId:'guard-unit-test',expiresAt:now()+1800,actions:0,reservedAtoms:'0'});
const offer=()=>({scheme:'exact',network:policy.network,amount:'5000',asset:policy.asset,payTo:policy.payee,maxTimeoutSeconds:300,extra:{name:'AirnodeHub USD',version:'1'}});
test('approved EODHD offer reserves the exact 5000 aUSD atoms',()=>assert.equal(guardRequirement(offer(),mandate()),5000n));
test('an exact per-call cap is accepted and one atom above it is rejected',()=>{const m={...mandate(),perCallCapAtoms:'5000'};assert.equal(guardRequirement(offer(),m),5000n);assert.throws(()=>guardRequirement({...offer(),amount:'5001'},m),/budget/);});
test('total budget includes already-reserved amounts, including unknown payments',()=>{const m={...mandate(),dataBudgetAtoms:'10000',reservedAtoms:'5000'};assert.equal(guardRequirement(offer(),m),5000n);assert.throws(()=>guardRequirement(offer(),{...m,reservedAtoms:'5001'}),/budget/);});
test('maximum data action count rejects before a payment can be signed',()=>assert.throws(()=>guardRequirement(offer(),{...mandate(),actions:2}),/Maximum/));
for(const [name,change] of Object.entries({recipient:{payTo:'0x0000000000000000000000000000000000000001'},asset:{asset:'0x0000000000000000000000000000000000000001'},network:{network:'eip155:1'},scheme:{scheme:'upto'},domain:{extra:{name:'USDC',version:'1'}},version:{extra:{name:'AirnodeHub USD',version:'2'}},paymentFlow:{extra:{name:'AirnodeHub USD',version:'1',paymentFlow:'escrow'}}})){
 test(`rejects unapproved ${name}`,()=>assert.throws(()=>guardRequirement({...offer(),...change},mandate())));
}
for(const amount of ['0','-1','0.005','1e4','',undefined,5000])test(`rejects nonpositive or noninteger string price ${String(amount)}`,()=>assert.throws(()=>guardRequirement({...offer(),amount},mandate())));
test('expired mandate rejects before challenge payment',()=>assert.throws(()=>guardRequirement(offer(),{...mandate(),expiresAt:now()-1}),/expiry|expired/));
test('authorization cannot outlive a still-active mandate',()=>assert.throws(()=>guardRequirement(offer(),{...mandate(),expiresAt:now()+100}),/outlive/));
for(const timeout of [0,301,1.5,NaN,undefined])test(`invalid payment timeout ${String(timeout)} rejects`,()=>assert.throws(()=>guardRequirement({...offer(),maxTimeoutSeconds:timeout},mandate())));
for(const change of [{expiresAt:undefined},{expiresAt:NaN},{expiresAt:now()+1900},{actions:-1},{actions:0.5},{actions:undefined},{maxActions:undefined},{maxActions:3},{maxActions:0},{reservedAtoms:'-1'},{dataBudgetAtoms:'50001'},{perCallCapAtoms:'10001'},{mandateId:'../escape'},{requestHash:'0xwrong'},{sourceUrl:'https://attacker.invalid/'},{payee:'0x0000000000000000000000000000000000000001'}]){
 test(`malformed or broadened mandate fails closed: ${JSON.stringify(change)}`,()=>assert.throws(()=>validateMandate({...mandate(),...change})));
}
test('request hash, source, recipient and asset cannot be changed by the caller',()=>{for(const key of ['requestHash','sourceUrl','network','signer','asset','payee'])assert.throws(()=>validateMandate({...mandate(),[key]:''}));});
test('payment summary excludes payment authorization, signature and raw body',()=>{const p=paymentSummary({intentId:'x',status:'UNKNOWN',payload:{payload:{authorization:{from:'payer',nonce:'secret'},signature:'secret'}},rawBody:'raw'});assert.ok(p);assert.equal(p.payer,'payer');assert.equal(JSON.stringify(p).includes('secret'),false);assert.equal('payload' in p,false);assert.equal('rawBody' in p,false);});
test('cross-process lock excludes a concurrent invocation and releases after exceptions',async()=>{const id='unit-'+randomUUID();let release!:()=>void;let entered!:()=>void;const enteredPromise=new Promise<void>(r=>{entered=r;});const held=withLock(id,async()=>{entered();await new Promise<void>(r=>{release=r;});});await enteredPromise;await assert.rejects(withLock(id,async()=>{}),/busy|interrupted/);release();await held;await assert.rejects(withLock(id,async()=>{throw new Error('expected');}),/expected/);await withLock(id,async()=>{});});
test('another Node process cannot enter the held filesystem lock',async()=>{const id='process-'+randomUUID();await withLock(id,async()=>{const script=`import {withLock} from './server/lock.ts'; try{await withLock(${JSON.stringify(id)},async()=>{});process.exit(2);}catch(e){if(!e.message.includes('busy or interrupted'))throw e;console.log('blocked');}`;const result=await promisify(execFile)(process.execPath,['--import','tsx','--input-type=module','-e',script],{cwd:root});assert.equal(result.stdout.trim(),'blocked');});});
test('an interrupted lock stays blocked until an operator reconciles it',async()=>{const id='stale-'+randomUUID();const directory=path.join(root,'.local','locks',id+'.lock');fs.mkdirSync(directory,{mode:0o700});try{await assert.rejects(withLock(id,async()=>{}),/busy|interrupted/);assert.equal(fs.existsSync(directory),true);}finally{fs.rmSync(directory,{recursive:true});}});
test('recovery cannot remove a live process lock',async()=>{const id='recovery-live-'+randomUUID();await withLock(id,async()=>{assert.throws(()=>clearDeadLocks([id]),/live/);assert.equal(fs.existsSync(path.join(root,'.local','locks',id+'.lock')),true);});});
test('recovery releases only a lock whose process is proven dead',()=>{const id='recovery-dead-'+randomUUID();const directory=path.join(root,'.local','locks',id+'.lock');fs.mkdirSync(directory,{mode:0o700});fs.writeFileSync(path.join(directory,'owner.json'),JSON.stringify({pid:2147483647,token:randomUUID()}),{mode:0o600});try{assert.deepEqual(clearDeadLocks([id]),[id]);assert.equal(fs.existsSync(directory),false);}finally{fs.rmSync(directory,{recursive:true,force:true});}});
test('recovery does not infer safety from an old lock with no owner',()=>{const id='recovery-unknown-'+randomUUID();const directory=path.join(root,'.local','locks',id+'.lock');fs.mkdirSync(directory,{mode:0o700});try{assert.throws(()=>clearDeadLocks([id]),/establish owner/);assert.equal(fs.existsSync(directory),true);}finally{fs.rmSync(directory,{recursive:true});}});
test('an interrupted payment reserves budget even when the mandate convenience journal was not written',()=>{const id='usage-'+randomUUID();const f=`.local/payments/${id}.json`;write(f,{intentId:id,mandateId:id,amountAtoms:'5000',status:'UNKNOWN'});try{assert.deepEqual(committedUsage(id),{reservedAtoms:'5000',actions:1});}finally{fs.unlinkSync(path.join(root,f));}});
test('a persisted unknown intent blocks a second authorization before reading wallets or fetching',async()=>{const id='unknown-'+randomUUID();const f=`.local/payments/${id}.json`;write(f,{intentId:id,mandateId:id,requestHash,amountAtoms:'5000',status:'UNKNOWN'});try{await assert.rejects(buyData(id,{...mandate(),mandateId:id}),/reconciliation/);}finally{fs.unlinkSync(path.join(root,f));}});
test('technical discovery cannot accept a product mandate or arbitrary request override',async()=>{await assert.rejects(buyDiscoveryData('discovery-invalid-'+randomUUID(),mandate()),/discovery/);});

const transferAbi=[{type:'event',name:'Transfer',inputs:[{name:'from',type:'address',indexed:true},{name:'to',type:'address',indexed:true},{name:'value',type:'uint256',indexed:false}]}] as const;
function reconciliationFixture(){
 const response=JSON.parse(fs.readFileSync(path.join(root,'test/fixtures/real-eodhd-dividend.json'),'utf8'));
 const payer='0x1111111111111111111111111111111111111111' as const;const transaction=toHex(1n,{size:32});
 const p={status:'UNKNOWN',requestHash,amountAtoms:'5000',payer,rawBody:JSON.stringify(response),settlement:{success:true,network:policy.network,payer,transaction}};
 // Synthetic receipt solely for payment validation unit tests; the envelope itself is genuine captured Airnode data.
 const receipt={status:'success',transactionHash:transaction,blockNumber:1n,logs:[{address:policy.asset,topics:encodeEventTopics({abi:transferAbi,eventName:'Transfer',args:{from:payer,to:policy.payee}}),data:encodeAbiParameters([{type:'uint256'}],[5000n])}]};return {p,receipt,response};
}
test('saved authentic response plus exact successful transfer can be reconciled after signature freshness expires',async()=>{const {p,receipt,response}=reconciliationFixture();assert.deepEqual(await verifyPaymentResult(p,receipt),response);});
for(const kind of ['wrong-network','wrong-payer','wrong-transaction','reverted','wrong-asset','wrong-recipient','wrong-amount','unknown-request','missing-body','edited-body'])test(`payment reconciliation rejects ${kind}`,async()=>{
 const {p,receipt}=reconciliationFixture();
 if(kind==='wrong-network')p.settlement.network='eip155:1';
 if(kind==='wrong-payer')p.settlement.payer='0x2222222222222222222222222222222222222222' as any;
 if(kind==='wrong-transaction')receipt.transactionHash=toHex(2n,{size:32});
 if(kind==='reverted')receipt.status='reverted';
 if(kind==='wrong-asset')receipt.logs[0].address='0x2222222222222222222222222222222222222222';
 if(kind==='wrong-recipient')receipt.logs[0].topics=encodeEventTopics({abi:transferAbi,eventName:'Transfer',args:{from:p.payer,to:'0x2222222222222222222222222222222222222222'}});
 if(kind==='wrong-amount')receipt.logs[0].data=encodeAbiParameters([{type:'uint256'}],[5001n]);
 if(kind==='unknown-request')p.requestHash=toHex(2n,{size:32});
 if(kind==='missing-body')delete (p as any).rawBody;
 if(kind==='edited-body'){const envelope=JSON.parse(p.rawBody);envelope.data=envelope.data.replace('0.26','0.99');p.rawBody=JSON.stringify(envelope);}
 await assert.rejects(verifyPaymentResult(p,receipt));
});
test('recovery finalizes a durably saved response from its receipt without another paid request',async()=>{
 const id='reconcile-'+randomUUID();const file=`.local/payments/${id}.json`;const {p,receipt,response}=reconciliationFixture();write(file,{...p,intentId:id,mandateId:id});
 const originalChain=publicClient.getChainId;const originalReceipt=publicClient.getTransactionReceipt;const originalFetch=globalThis.fetch;let fetches=0;
 (publicClient as any).getChainId=async()=>84532;(publicClient as any).getTransactionReceipt=async()=>receipt;globalThis.fetch=async()=>{fetches++;throw new Error('No network allowed in reconciliation unit test');};
 try{const reconciled=await reconcilePayment(id);assert.equal(reconciled.status,'CONFIRMED');assert.deepEqual(reconciled.response,response);assert.equal(fetches,0);}finally{(publicClient as any).getChainId=originalChain;(publicClient as any).getTransactionReceipt=originalReceipt;globalThis.fetch=originalFetch;fs.unlinkSync(path.join(root,file));}
});
