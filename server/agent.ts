import {encodeFunctionData,toHex,parseEventLogs,formatUnits,parseUnits} from 'viem';
import {policy,request,requestHash,signer} from './config.ts';
import {artifact,publicClient,tokenAbi,roles} from './chain.ts';
import {buyData,reconcilePayment,committedUsage} from './payment.ts';
import {withLock} from './lock.ts';
import {read,write,now,safeError} from './store.ts';
import {durableTransaction} from './transactions.ts';
import {verifySignedResponse,type SignedResponse} from './vendor/airnode-v2.ts';

const journalFile='.local/journal.json';
function save(j:any){write(journalFile,j);const {rawTransaction,...safe}=j;write('evidence/collection.json',safe);}
function step(j:any,name:string,status:string,detail:string,txHash?:string){let row=j.steps.find((x:any)=>x.name===name);if(!row){row={name};j.steps.push(row);}Object.assign(row,{status,detail,at:now(),...(txHash?{txHash}:{})});save(j);}
export async function chainState(){
 const d=read('evidence/deployment.json');if(!d)return {deployment:null,agreement:null,balances:null};
 const abi=artifact('DividendBond').abi;
 const [state,claimedAmount,declaredDividendE18,reserve,balance]=await Promise.all([
  publicClient.readContract({address:d.contractAddress,abi,functionName:'state'}),
  publicClient.readContract({address:d.contractAddress,abi,functionName:'claimedAmount'}),
  publicClient.readContract({address:d.contractAddress,abi,functionName:'declaredDividendE18'}),
  publicClient.readContract({address:d.tokenAddress,abi:tokenAbi,functionName:'balanceOf',args:[d.contractAddress]}),
  publicClient.readContract({address:d.tokenAddress,abi:tokenAbi,functionName:'balanceOf',args:[d.terms.beneficiary]})]);
 let observedDividend=BigInt(declaredDividendE18 as bigint);const preflight=read('evidence/preflight.json');
 if(observedDividend===0n&&preflight?.response){await verifySignedResponse(preflight.response,signer,requestHash);observedDividend=parseUnits(String(JSON.parse(preflight.response.data).declaredDividend),18);}
 const preview=BigInt(d.terms.quantityE18)*observedDividend/10n**30n;
 const t=d.terms;return {deployment:d,agreement:{id:d.id,ticker:t.ticker,eventDate:'2025-08-11',paymentDate:'2025-08-14',recordDate:'2025-08-11',quantityAtoms:'100',quantityDecimals:0,payoutCapAtoms:t.payoutCap,payoutDecimals:6,payoutSymbol:'tdUSD',beneficiary:t.beneficiary,issuer:preflight?.payer||null,status:['Awaiting funding','Active','Claimed','Void'][Number(state)],claimed:Number(state)===2,payoutAtoms:String(claimedAmount),declaredDividendAtoms:observedDividend>0n?String(observedDividend/1000000000000n):undefined,previewPayoutAtoms:observedDividend>0n?String(preview>BigInt(t.payoutCap)?BigInt(t.payoutCap):preview):undefined,reserveAtoms:String(reserve),claimDeadline:t.claimDeadline,voidGrace:t.voidGrace},balances:{beneficiaryAtoms:String(balance),reserveAtoms:String(reserve)}};
}
export async function getState(){const c=await chainState();const j=read(journalFile)||read('evidence/collection.json');if(j){const usage=committedUsage(j.mandateId);if(usage.actions>0){j.actions=usage.actions;j.dataSpentAtoms=usage.reservedAtoms;}}return {...c,network:{name:'Base Sepolia',chainId:84532,explorer:'https://sepolia.basescan.org'},policy,journal:j,evidence:{preflight:read('evidence/preflight.json'),tamper:read('evidence/tamper-live.json')},updatedAt:new Date().toISOString()};}
export async function authorize(){return withLock('workflow',async()=>{
 const c=await chainState();if(!c.deployment||!c.agreement)throw new Error('No funded obligation is configured');if(c.agreement.claimed)throw new Error('Already collected; no new mandate or data purchase');
 if(c.agreement.status!=='Active')throw new Error('Obligation is not active');const old=read(journalFile);if(old)throw new Error('A mandate already exists; resume it without creating a new intent');
 const id=`${c.deployment.id}-${c.deployment.contractAddress.toLowerCase()}`;
 const m={...policy,mandateId:id,agreementId:c.agreement.id,contractAddress:c.deployment.contractAddress,beneficiary:c.agreement.beneficiary,payer:roles().deployer.address,createdAt:now(),expiresAt:now()+policy.expirySeconds,actions:0,reservedAtoms:'0'};
 write(`.local/mandates/${id}.json`,m);const j={mandateId:id,status:'Authorized',createdAt:m.createdAt,expiresAt:m.expiresAt,dataSpentAtoms:'0',gasSpentWei:'0',actions:0,steps:[],mandate:m};save(j);return j;
 });}
export async function verifyResponse(response:SignedResponse){const d=read('evidence/deployment.json');if(!d)throw new Error('Deploy an obligation first');await verifySignedResponse(response,signer,requestHash);const result=await publicClient.readContract({address:d.contractAddress,abi:artifact('DividendBond').abi,functionName:'validateResponse',args:[BigInt(response.timestamp),toHex(response.data),response.signature]}) as [bigint,bigint];return {valid:true,payoutAtoms:result[1].toString(),message:`Proof accepted: ${formatUnits(result[1],6)} tdUSD for the immutable beneficiary`};}
export async function runAgent(){return withLock('workflow',async()=>{
 const j=read(journalFile)||read('evidence/collection.json');if(!j)throw new Error('Authorize a collection mandate first');const m=read(`.local/mandates/${j.mandateId}.json`)||j.mandate;if(!m)throw new Error('Mandate record missing');
 try{
  delete j.error;
  const c=await chainState();const d=c.deployment;if(!d||!c.agreement)throw new Error('No configured obligation');
  if(m.contractAddress!==d.contractAddress||m.beneficiary!==d.terms.beneficiary||m.requestHash!==requestHash)throw new Error('Mandate binding mismatch');
  if(c.agreement.claimed){
   const existing=read(`.local/transactions/${j.mandateId}-claim.json`);
   if(existing||j.claimTx){
    const tx=existing?await durableTransaction(`${j.mandateId}-claim`,{},'deployer'):{hash:j.claimTx,receipt:await publicClient.getTransactionReceipt({hash:j.claimTx})};
    j.claimTx=tx.hash;j.claimReceipt=tx.receipt;j.gasSpentWei=(BigInt(tx.receipt.gasUsed)*BigInt(tx.receipt.effectiveGasPrice)+BigInt(tx.receipt.l1Fee||0)).toString();
    const events=parseEventLogs({abi:artifact('DividendBond').abi,logs:tx.receipt.logs,eventName:'Claimed'}) as any[];
    const event=events.find(x=>x.args.beneficiary.toLowerCase()===m.beneficiary.toLowerCase());
    if(!event)throw new Error('Confirmed transaction lacks the expected beneficiary claim event');
    j.receivedAtoms=event.args.amount.toString();j.payoutAtoms=j.receivedAtoms;
    step(j,'Claim sent','confirmed','Receipt recovered from persisted transaction hash',tx.hash);
    step(j,'Funds received','confirmed',`${formatUnits(BigInt(j.receivedAtoms),6)} tdUSD confirmed by the claim event`,tx.hash);
   }
   j.status='Collected';j.reconciledAt=now();j.reconciliation='Already claimed on-chain; skipped data purchase and transaction';save(j);return j;
  }
  if(c.agreement.status!=='Active')throw new Error('Contract is not active');if(now()>m.expiresAt)throw new Error('Mandate expired; no new payment or transaction');
  const intentId=`${j.mandateId}-data-01`;
  j.status='Buying data';step(j,'Data purchase','pending','Checking the pinned EODHD offer against the approved budget');
  const savedPayment=read(`.local/payments/${intentId}.json`);if(savedPayment&&!savedPayment.response)await reconcilePayment(intentId);
  const payment=await buyData(intentId,m);j.dataSpentAtoms=payment.amountAtoms;j.paymentTx=payment.settlement.transaction;j.response=payment.response;j.actions=m.actions;
  step(j,'Data purchase','confirmed','0.005 aUSD paid to EODHD Airnode; payment receipt confirmed',j.paymentTx);
  j.status='Verifying';step(j,'Verification','pending','Checking exact request, expected signer and on-chain event policy');
  const verification=await verifyResponse(payment.response);j.payoutAtoms=verification.payoutAtoms;step(j,'Verification','confirmed','Signature, event, USD amount and timing accepted by the deployed contract');
  if(now()>m.expiresAt)throw new Error('Mandate expired before claim');
  const before=c.balances!.beneficiaryAtoms;j.beneficiaryBeforeAtoms=before;
  j.status='Submitting claim';step(j,'Claim sent','pending','Preparing a transaction to the approved contract and immutable beneficiary');
  const tx=await durableTransaction(`${j.mandateId}-claim`,{to:d.contractAddress,data:encodeFunctionData({abi:artifact('DividendBond').abi,functionName:'claimFor',args:[BigInt(payment.response.timestamp),toHex(payment.response.data),payment.response.signature]})},'deployer',BigInt(m.gasBudgetWei)/2n);
  j.claimTx=tx.hash;j.gasSpentWei=(BigInt(tx.receipt.gasUsed)*BigInt(tx.receipt.effectiveGasPrice)+BigInt(tx.receipt.l1Fee)).toString();j.claimReceipt=tx.receipt;
  step(j,'Claim sent','confirmed','Agent transaction confirmed',tx.hash);
  const after=await chainState();j.beneficiaryAfterAtoms=after.balances!.beneficiaryAtoms;j.receivedAtoms=(BigInt(j.beneficiaryAfterAtoms)-BigInt(before)).toString();
  if(j.receivedAtoms!==j.payoutAtoms||!after.agreement!.claimed)throw new Error('Receipt/balance reconciliation mismatch');
  j.status='Collected';step(j,'Funds received','confirmed',`${formatUnits(BigInt(j.receivedAtoms),6)} tdUSD delivered to the registered beneficiary`,tx.hash);save(j);return j;
 }catch(e){j.error=safeError(e);j.status=/reconciliation|outcome/.test(j.error)?'Needs reconciliation':'Rejected';save(j);throw e;}
 });}
