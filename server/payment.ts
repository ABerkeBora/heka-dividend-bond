import {x402Client} from '@x402/core/client';
import {decodePaymentRequiredHeader,decodePaymentResponseHeader,encodePaymentSignatureHeader} from '@x402/core/http';
import {ExactEvmScheme} from '@x402/evm';
import {decodeEventLog,isAddressEqual} from 'viem';
import fs from 'node:fs';
import path from 'node:path';
import {policy,sourceUrl,request,requestHash,signer,discoveryRequest,discoveryRequestHash,discoveryPurpose} from './config.ts';
import {payerAccount,publicClient,tokenAbi} from './chain.ts';
import {read,write,now,scopedPath} from './store.ts';
import {withLock} from './lock.ts';
import {verifySignedResponse,type SignedResponse} from './vendor/airnode-v2.ts';

const integer=(v:unknown)=>typeof v==='string'&&/^\d+$/.test(v);
const safeId=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
const sameAddress=(a:unknown,b:string)=>typeof a==='string'&&a.toLowerCase()===b.toLowerCase();
function validateBaseMandate(m:any){
 if(!m||!safeId(m.mandateId))throw new Error('Invalid mandate identity');
 if(m.network!==policy.network||m.sourceUrl!==sourceUrl||!sameAddress(m.signer,signer)||!sameAddress(m.asset,policy.asset)||!sameAddress(m.payee,policy.payee))throw new Error('Mandate does not match pinned source policy');
 if(!Number.isSafeInteger(m.expiresAt)||m.expiresAt<now()||m.expiresAt>now()+policy.expirySeconds)throw new Error('Mandate expired or invalid expiry');
 if(!integer(m.perCallCapAtoms)||!integer(m.dataBudgetAtoms)||BigInt(m.perCallCapAtoms)<=0n||BigInt(m.dataBudgetAtoms)<=0n||BigInt(m.perCallCapAtoms)>BigInt(policy.perCallCapAtoms)||BigInt(m.dataBudgetAtoms)>BigInt(policy.dataBudgetAtoms))throw new Error('Invalid mandate data caps');
 if(!Number.isSafeInteger(m.actions)||m.actions<0||!Number.isSafeInteger(m.maxActions)||m.maxActions<1||m.maxActions>policy.maxActions||m.actions>m.maxActions||!integer(m.reservedAtoms))throw new Error('Invalid mandate usage counters');
}
export function validateMandate(m:any){validateBaseMandate(m);if(m.requestHash!==requestHash)throw new Error('Mandate does not match pinned request');}
function validateDiscoveryMandate(m:any){validateBaseMandate(m);if(m.requestHash!==discoveryRequestHash||m.purpose!==discoveryPurpose||m.maxActions!==1||BigInt(m.dataBudgetAtoms)>10000n||BigInt(m.perCallCapAtoms)>10000n)throw new Error('Invalid fixed technical discovery mandate');}
function guardOffer(r:any,mandate:any,validate:(m:any)=>void){
 validate(mandate);
 if(r.scheme!=='exact'||r.network!==policy.network||r.asset?.toLowerCase()!==policy.asset.toLowerCase()||r.payTo?.toLowerCase()!==policy.payee.toLowerCase())throw new Error('Unapproved payment destination, asset, network or scheme');
 if(!integer(r.amount))throw new Error('Invalid integer price');
 const amount=BigInt(r.amount);if(amount<=0n||amount>BigInt(mandate.perCallCapAtoms)||amount+BigInt(mandate.reservedAtoms||'0')>BigInt(mandate.dataBudgetAtoms))throw new Error('Data budget exceeded');
 if(mandate.actions>=mandate.maxActions)throw new Error('Maximum data purchases reached');
 if(!Number.isInteger(r.maxTimeoutSeconds)||r.maxTimeoutSeconds<1||r.maxTimeoutSeconds>300||now()+r.maxTimeoutSeconds>mandate.expiresAt)throw new Error('Payment authorization would outlive mandate');
 if(r.extra?.name!=='AirnodeHub USD'||r.extra?.version!=='1'||r.extra?.paymentFlow!==undefined)throw new Error('Unexpected token domain or payment flow');
 return amount;
}
export function guardRequirement(r:any,mandate:any){return guardOffer(r,mandate,validateMandate);}
/** Every signed authorization reserves its full amount even if its outcome is unknown or rejected. */
export function committedUsage(mandateId:string){
 if(!safeId(mandateId))throw new Error('Invalid mandate identity');
 const directory=scopedPath('.local/payments');let reserved=0n;let actions=0;
 if(!fs.existsSync(directory))return {reservedAtoms:'0',actions:0};
 for(const name of fs.readdirSync(directory).filter(x=>x.endsWith('.json'))){
  const p=read(`.local/payments/${name}`);
  if(p.mandateId!==mandateId&&!(p.mandateId===undefined&&p.intentId===mandateId))continue;
  if(!integer(p.amountAtoms))throw new Error('Payment journal contains invalid reserved amount');
  reserved+=BigInt(p.amountAtoms);actions++;
 }
 return {reservedAtoms:reserved.toString(),actions};
}
const transferAbi=[{type:'event',name:'Transfer',inputs:[{name:'from',type:'address',indexed:true},{name:'to',type:'address',indexed:true},{name:'value',type:'uint256',indexed:false}]}] as const;
/** Reconcile saved bytes and exact settled transfer; freshness remains the consuming contract's independent check. */
export async function verifyPaymentResult(p:any,receipt:any){
 const payer=p.payer||p.payload?.payload?.authorization?.from;
 if(!integer(p.amountAtoms)||BigInt(p.amountAtoms)<=0n||!payer||!p.settlement?.success||p.settlement.network!==policy.network||!sameAddress(p.settlement.payer,payer)||!sameAddress(receipt.transactionHash,p.settlement.transaction)||receipt.status!=='success')throw new Error('Payment receipt or settlement mismatch');
 if(p.requestHash!==requestHash&&p.requestHash!==discoveryRequestHash)throw new Error('Payment request is outside the fixed recipe allowlist');
 const amount=BigInt(p.amountAtoms);
 const transfer=receipt.logs.some((log:any)=>{if(!isAddressEqual(log.address,policy.asset))return false;try{const event=decodeEventLog({abi:transferAbi,data:log.data,topics:log.topics});return sameAddress(event.args.from,payer)&&sameAddress(event.args.to,policy.payee)&&event.args.value===amount;}catch{return false;}});
 if(!transfer)throw new Error('Receipt does not contain the exact approved aUSD transfer');
 if(typeof p.rawBody!=='string')throw new Error('Paid response body is unavailable; do not authorize another payment');
 const response=JSON.parse(p.rawBody) as SignedResponse;await verifySignedResponse(response,signer,p.requestHash);return response;
}
async function buyDataUnlocked(intentId:string,mandate:any,recipe:'product'|'discovery'='product'){
 if(!safeId(intentId))throw new Error('Invalid intent identity');
 const selectedRequest=recipe==='product'?request:discoveryRequest;
 const selectedHash=recipe==='product'?requestHash:discoveryRequestHash;
 const validate=recipe==='product'?validateMandate:validateDiscoveryMandate;
 validate(mandate);
 const filename=`.local/payments/${intentId}.json`;let p=read(filename);
 if(p&&p.mandateId!==mandate.mandateId&&!(p.mandateId===undefined&&p.intentId===mandate.mandateId))throw new Error('Intent belongs to another mandate');
 if(p&&p.requestHash!==selectedHash)throw new Error('Intent belongs to another fixed request');
 if(p?.response)return p;
 if(p)throw new Error('Payment outcome needs reconciliation; no second authorization issued');
 // Committed payment records are authoritative if a crash interrupted the convenience mandate write.
 Object.assign(mandate,committedUsage(mandate.mandateId));
 const challenge=await fetch(sourceUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(selectedRequest),redirect:'error',signal:AbortSignal.timeout(20000)});
 if(challenge.status!==402)throw new Error(`Expected priced operation challenge, received ${challenge.status}`);
 const h=challenge.headers.get('PAYMENT-REQUIRED');if(!h)throw new Error('Missing x402 challenge');
 const required=decodePaymentRequiredHeader(h);
 if(required.x402Version!==2||required.resource?.url!==sourceUrl)throw new Error('Wrong x402 resource');
 const requirements=required.accepts.filter(r=>{try{guardOffer(r,mandate,validate);return true;}catch{return false;}});
 if(requirements.length!==1)throw new Error('No single approved x402 offer within mandate');
 const amount=guardOffer(requirements[0],mandate,validate);
 if(await publicClient.getChainId()!==84532)throw new Error('RPC must be Base Sepolia');
 const payer=payerAccount();
 const client=new x402Client().register(policy.network as any,new ExactEvmScheme(payer)).setSpendControls({allowedAssets:[{network:policy.network as any,asset:policy.asset,maxAmountPerPayment:mandate.perCallCapAtoms}],maxAmountPerPayment:'$0.01'});
 const payload=await client.createPaymentPayload({...required,accepts:requirements});
 const authorization=(payload.payload as any).authorization;
 if(!authorization||!sameAddress(authorization.from,payer.address)||!sameAddress(authorization.to,policy.payee)||!integer(authorization.value)||BigInt(authorization.value)!==amount||!integer(authorization.validBefore)||BigInt(authorization.validBefore)>BigInt(mandate.expiresAt))throw new Error('Signed authorization exceeds mandate');
 p={intentId,mandateId:mandate.mandateId,payer:payer.address,status:'AUTHORIZED',requestHash:selectedHash,recipe,amountAtoms:amount.toString(),at:now(),requirements:requirements[0],payload};
 // Persist before any paid request. A crash here deliberately requires reconciliation.
 write(filename,p);mandate.actions++;mandate.reservedAtoms=(BigInt(mandate.reservedAtoms||'0')+amount).toString();
 write(`.local/mandates/${mandate.mandateId}.json`,mandate);
 try{
  p.status='SUBMITTED';write(filename,p);
  const paid=await fetch(sourceUrl,{method:'POST',headers:{'Content-Type':'application/json','PAYMENT-SIGNATURE':encodePaymentSignatureHeader(payload)},body:JSON.stringify(selectedRequest),redirect:'error',signal:AbortSignal.timeout(45000)});
  const settlementHeader=paid.headers.get('PAYMENT-RESPONSE');p.settlement=settlementHeader?decodePaymentResponseHeader(settlementHeader):null;p.httpStatus=paid.status;
  p.rawBody=await paid.text();write(filename,p);
  if(!paid.ok||!p.settlement?.success||!p.settlement.transaction||p.settlement.network!==policy.network||!sameAddress(p.settlement.payer,payer.address))throw new Error(`Paid request outcome requires reconciliation (HTTP ${paid.status})`);
  const receipt=await publicClient.waitForTransactionReceipt({hash:p.settlement.transaction,timeout:45000});
  const response=await verifyPaymentResult(p,receipt);
  p.response=response;p.status='CONFIRMED';p.receipt={transactionHash:receipt.transactionHash,blockNumber:receipt.blockNumber.toString(),status:receipt.status};write(filename,p);return p;
 }catch(e){p.status='UNKNOWN';write(filename,p);throw e;}
}
export async function buyData(intentId:string,mandate:any){return withLock('data-payments',()=>buyDataUnlocked(intentId,mandate));}
/** Fixed technical CLI discovery only. No arbitrary URL, operation, parameters, projection or expected hash is accepted. */
export async function buyDiscoveryData(intentId:string,mandate:any){return withLock('data-payments',()=>buyDataUnlocked(intentId,mandate,'discovery'));}
/** Never expose an EIP-3009 payment authorization or its signature to UI/public evidence. */
export function paymentSummary(p:any){if(!p)return null;return {intentId:p.intentId,mandateId:p.mandateId,status:p.status,requestHash:p.requestHash,payer:p.payer||p.payload?.payload?.authorization?.from,amountAtoms:p.amountAtoms,payee:policy.payee,httpStatus:p.httpStatus,settlement:p.settlement?{success:p.settlement.success,transaction:p.settlement.transaction,network:p.settlement.network,payer:p.settlement.payer}:null,receipt:p.receipt,response:p.response};}
export async function reconcilePayment(intentId:string){return withLock('data-payments',async()=>{
 if(!safeId(intentId))throw new Error('Invalid intent identity');const filename=`.local/payments/${intentId}.json`;const p=read(filename);if(!p)return null;
 if(await publicClient.getChainId()!==84532)throw new Error('RPC must be Base Sepolia');
 const nonce=p.payload?.payload?.authorization?.nonce;if(nonce)p.authorizationUsed=await publicClient.readContract({address:policy.asset,abi:tokenAbi,functionName:'authorizationState',args:[p.payer||p.payload.payload.authorization.from,nonce]});
 if(p.settlement?.transaction){const receipt=await publicClient.getTransactionReceipt({hash:p.settlement.transaction});p.receipt={status:receipt.status,transactionHash:receipt.transactionHash,blockNumber:receipt.blockNumber.toString()};
  try{p.response=await verifyPaymentResult(p,receipt);p.status='CONFIRMED';p.reconciledAt=now();delete p.reconciliationError;}catch(e:any){p.status='UNKNOWN';p.reconciliationError=String(e.message).slice(0,300);}
 }
 write(filename,p);return p;
 });}
