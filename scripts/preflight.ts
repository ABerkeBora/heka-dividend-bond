import {buyData} from '../server/payment.ts';
import {policy,request,requestHash,signer} from '../server/config.ts';
import {read,write,now} from '../server/store.ts';
const id='eodhd-preflight-01';const m=read(`.local/mandates/${id}.json`)||{...policy,mandateId:id,expiresAt:now()+1800,actions:0,reservedAtoms:'0'};
write(`.local/mandates/${id}.json`,m);
const p=await buyData(id,m);
write('evidence/preflight.json',{checkedAt:new Date().toISOString(),request,requestHash,signer,payer:p.payload.payload.authorization.from,feeAtoms:p.amountAtoms,payee:policy.payee,settlement:p.settlement,receipt:p.receipt,response:p.response});
console.log(JSON.stringify({status:p.status,data:p.response.data,requestHash,settlement:p.settlement},null,2));
