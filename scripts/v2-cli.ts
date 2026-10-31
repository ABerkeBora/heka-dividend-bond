import {runV2} from '../server/v2-launcher.ts';
const command=process.argv[2];
if(command==='collect'){
 const state=await runV2('state');if(!state.journal)await runV2('authorize');
 const j=await runV2('run');console.log(JSON.stringify({scope:'v2',status:j.status,paymentTx:j.paymentTx,claimTx:j.claimTx,payoutAtoms:j.receivedAtoms,reconciliation:j.reconciliation},null,2));
}else if(command==='state'||command==='probe'||command==='recover')console.log(JSON.stringify(await runV2(command),null,2));
else throw new Error('Use v2:state, v2:probe or v2:collect');
