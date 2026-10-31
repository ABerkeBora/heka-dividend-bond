import fs from 'node:fs';
import path from 'node:path';
import {decodeEventLog,parseEventLogs,type Address} from 'viem';
import {runV2} from '../server/v2-launcher.ts';
import {read,write,root} from '../server/store.ts';
import {publicClient,tokenAbi,artifact} from '../server/chain.ts';
import {asset,payee} from '../server/config.ts';

const setup=read('evidence/v2/setup.json');const j=read('evidence/v2/collection.json');
if(!j?.claimTx||!setup?.setupComplete)throw new Error('Complete one real independent collection first');
const payment=read(`.local/v2/payments/${j.mandateId}-data-01.json`);if(!payment?.response||payment.status!=='CONFIRMED')throw new Error('Missing confirmed V2 data purchase');
const collector=setup.collector as Address;const issuer=setup.issuer as Address;
async function snapshot(){return {issuerNonce:await publicClient.getTransactionCount({address:issuer,blockTag:'pending'}),collectorNonce:await publicClient.getTransactionCount({address:collector,blockTag:'pending'}),collectorAUSD:String(await publicClient.readContract({address:asset,abi:tokenAbi,functionName:'balanceOf',args:[collector]})),collectorETH:String(await publicClient.getBalance({address:collector})),collectorPayout:String(await publicClient.readContract({address:setup.tokenAddress,abi:tokenAbi,functionName:'balanceOf',args:[collector]})),state:String(await publicClient.readContract({address:setup.contractAddress,abi:artifact('DividendBond').abi,functionName:'state'})),paymentIntents:fs.readdirSync(path.join(root,'.local/v2/payments')).filter(x=>x.endsWith('.json')).sort()};}
const before=await snapshot();
const claim=await publicClient.getTransaction({hash:j.claimTx});const receipt=await publicClient.getTransactionReceipt({hash:j.claimTx});const dataReceipt=await publicClient.getTransactionReceipt({hash:j.paymentTx});
const authorization=payment.payload.payload.authorization;
const transferAbi=[{type:'event',name:'Transfer',inputs:[{name:'from',type:'address',indexed:true},{name:'to',type:'address',indexed:true},{name:'value',type:'uint256',indexed:false}]}] as const;
const dataTransfers=dataReceipt.logs.filter(log=>log.address.toLowerCase()===asset.toLowerCase()).flatMap(log=>{try{return [decodeEventLog({abi:transferAbi,topics:log.topics,data:log.data}).args];}catch{return [];}});
const exactDataTransfer=dataTransfers.some(t=>t.from.toLowerCase()===collector.toLowerCase()&&t.to.toLowerCase()===payee.toLowerCase()&&t.value===5000n);
const claimEvent=(parseEventLogs({abi:artifact('DividendBond').abi,logs:receipt.logs,eventName:'Claimed'}) as any[]).find(x=>x.args.beneficiary.toLowerCase()===collector.toLowerCase());
const runProof=read('evidence/v2/collection-runtime.json')||read('evidence/v2/runtime-run.json');if(!runProof?.runtimeRestricted||!runProof?.issuerReadDenied||!runProof?.collectorSecretOnly)throw new Error('Actual payment process lacked required key isolation');
const blocked=await runV2('reject-check');
const restartOne=await runV2('run');const restartTwo=await runV2('recover');
const after=await snapshot();
const noSecondChargeOrPayout=JSON.stringify(before)===JSON.stringify(after);
const checks={payerIsCollector:authorization.from.toLowerCase()===collector.toLowerCase(),authorizationExactValue:String(authorization.value)==='5000',authorizationExactPayee:authorization.to.toLowerCase()===payee.toLowerCase(),authorizationNonceConsumed:await publicClient.readContract({address:asset,abi:tokenAbi,functionName:'authorizationState',args:[collector,authorization.nonce]}),exactDataTransfer,claimFromCollector:claim.from.toLowerCase()===collector.toLowerCase(),claimTargetsV2:claim.to?.toLowerCase()===setup.contractAddress.toLowerCase(),claimNonceStartsAtHandoff:claim.nonce===setup.collectorNonceAtHandoff,claimEventSubmitterIsCollector:claimEvent?.args.submitter.toLowerCase()===collector.toLowerCase(),immutableBeneficiaryPaid:claimEvent?.args.amount===26000000n&&after.collectorPayout==='26000000',issuerDidNotAct:before.issuerNonce===setup.issuerNonceAtHandoff&&after.issuerNonce===setup.issuerNonceAtHandoff,issuerKeyReadDenied:runProof.issuerReadDenied,onlyCollectorKeyPresent:runProof.collectorSecretOnly,noSecondChargeOrPayout};
if(Object.values(checks).some(x=>x!==true))throw new Error('Independent collector acceptance mismatch: '+JSON.stringify(checks));
write('evidence/v2/acceptance.json',{checkedAt:new Date().toISOString(),scope:'v2',status:'PASS',setupCompletedAt:setup.setupCompletedAt,issuer,collector,beneficiary:setup.beneficiary,contractAddress:setup.contractAddress,dataPayment:{hash:j.paymentTx,payer:collector,feeAtoms:'5000',payee,authorization:{from:authorization.from,to:authorization.to,value:authorization.value,nonce:authorization.nonce,validAfter:authorization.validAfter,validBefore:authorization.validBefore},receiptStatus:dataReceipt.status,facilitatorPaysSettlementGas:true},claim:{hash:j.claimTx,from:claim.from,to:claim.to,nonce:claim.nonce,receiptStatus:receipt.status,payoutAtoms:j.receivedAtoms,gasSpentWei:j.gasSpentWei},checks,blocked,before,after,restart:{freshRestrictedProcess:restartOne.status,recoveryProcess:restartTwo.status||restartTwo.result?.status,createdNewMandate:false,submittedNewPayment:false},isolationEvidence:'evidence/v2/collection-runtime.json',limits:'API caps application-level; hard L2 transaction bound with separately estimated Base L1 fee. Node permissions protect trusted-code filesystem access, not hostile same-user code.'});
console.log(JSON.stringify({status:'PASS',checks,issuerNonce:after.issuerNonce,collectorNonce:after.collectorNonce},null,2));
