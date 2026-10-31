import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {toHex} from 'viem';
import {read,write,root,safeError} from '../server/store.ts';
import {publicClient,tokenAbi,roles,artifact} from '../server/chain.ts';
import {policy} from '../server/config.ts';
import {guardRequirement} from '../server/payment.ts';
import {runAgent,chainState} from '../server/agent.ts';
const j=read('.local/journal.json');if(!j?.claimTx)throw new Error('Complete a real collection first');
const mandate=read(`.local/mandates/${j.mandateId}.json`);const payer=roles().deployer.address;
async function snapshot(){return {chain:await chainState(),aUSDAtoms:String(await publicClient.readContract({address:policy.asset,abi:tokenAbi,functionName:'balanceOf',args:[payer]})),payerNonce:await publicClient.getTransactionCount({address:payer,blockTag:'pending'}),paymentIntents:fs.readdirSync(path.join(root,'.local/payments')).filter(x=>x.endsWith('.json')).sort()};}
const before=await snapshot();const blocked=[];
const offer={scheme:'exact',network:policy.network,asset:policy.asset,payTo:policy.payee,amount:'5000',maxTimeoutSeconds:300,extra:{name:'AirnodeHub USD',version:'1'}};
for(const [name,change] of [['over-budget',{amount:'10001'}],['wrong-recipient',{payTo:'0x0000000000000000000000000000000000000001'}]] as const){try{guardRequirement({...offer,...change},mandate);throw new Error('Guard unexpectedly accepted');}catch(e){const message=safeError(e);if(message==='Guard unexpectedly accepted')throw e;blocked.push({name,validatorDecision:'REJECT',message,transactionSubmitted:false});}}
await runAgent();
const restart=await promisify(execFile)(process.execPath,['--import','tsx','scripts/collect.ts'],{cwd:root,timeout:60000});
let duplicate:any;try{await publicClient.simulateContract({address:before.chain.deployment.contractAddress,abi:artifact('DividendBond').abi,functionName:'claimFor',args:[BigInt(j.response.timestamp),toHex(j.response.data),j.response.signature],account:payer});throw new Error('Duplicate unexpectedly accepted');}catch(e:any){if(e.message==='Duplicate unexpectedly accepted')throw e;duplicate={validatorDecision:'REJECT',message:safeError(e),method:'claimFor eth_call; no broadcast'};}
const after=await snapshot();const unchanged=before.aUSDAtoms===after.aUSDAtoms&&before.payerNonce===after.payerNonce&&JSON.stringify(before.paymentIntents)===JSON.stringify(after.paymentIntents)&&before.chain.balances?.beneficiaryAtoms===after.chain.balances?.beneficiaryAtoms;
if(!unchanged)throw new Error('Reconciliation changed protected funds or created a new economic action');
write('evidence/acceptance.json',{checkedAt:new Date().toISOString(),mandateId:j.mandateId,initialDelegatedAction:{paymentTx:j.paymentTx,claimTx:j.claimTx,payoutAtoms:j.receivedAtoms},blocked,before,after,sameProcessRetry:'PASS',freshProcessRestart:{status:'PASS',output:JSON.parse(restart.stdout)},duplicateClaim:duplicate,noSecondChargeOrPayout:unchanged,status:'PASS'});
console.log(JSON.stringify({status:'PASS',blocked,noSecondChargeOrPayout:unchanged},null,2));
