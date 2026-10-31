import {buyDiscoveryData,paymentSummary} from '../server/payment.ts';
import {policy,discoveryRequest,discoveryRequestHash,discoveryPurpose,signer,requestHash} from '../server/config.ts';
import {read,write,now} from '../server/store.ts';

// One fixed technical setup purchase, not a product claim or an arbitrary request interface.
const id='eodhd-cardinality-aapl-20250811-01';
const file=`.local/mandates/${id}.json`;
const mandate=read(file)||{...policy,requestHash:discoveryRequestHash,purpose:discoveryPurpose,mandateId:id,dataBudgetAtoms:'10000',perCallCapAtoms:'10000',maxActions:1,createdAt:now(),expiresAt:now()+1800,actions:0,reservedAtoms:'0'};
write(file,mandate);
write('evidence/discovery-recipe.json',{purpose:discoveryPurpose,request:discoveryRequest,requestHash:discoveryRequestHash,signer,productRequestHashUnchanged:requestHash,maxActions:1,perCallCapAtoms:'10000',totalCapAtoms:'10000',feeAsset:policy.asset,payee:policy.payee,network:policy.network});
const payment=await buyDiscoveryData(id,mandate);
const records=JSON.parse(payment.response.data);
const record=Array.isArray(records)&&records.length===1?records[0]:null;
const unique=Boolean(record&&record.date==='2025-08-11'&&record.paymentDate==='2025-08-14'&&record.recordDate==='2025-08-11'&&record.currency==='USD'&&String(record.unadjustedValue)==='0.26');
const report={checkedAt:new Date().toISOString(),purpose:discoveryPurpose,request:discoveryRequest,requestHash:discoveryRequestHash,signer,recordCount:Array.isArray(records)?records.length:null,uniqueExpectedEvent:unique,status:unique?'PASS':'FAIL',payment:paymentSummary(payment),records,productRequestHashUnchanged:requestHash,limitation:'This signed discovery snapshot establishes one matching record before the next obligation is funded; a later upstream revision remains inherited source risk.'};
write('evidence/event-discovery.json',report);
console.log(JSON.stringify({status:report.status,recordCount:report.recordCount,uniqueExpectedEvent:unique,feeAtoms:payment.amountAtoms,transaction:payment.settlement.transaction,requestHash:discoveryRequestHash},null,2));
if(!unique)process.exitCode=1;
