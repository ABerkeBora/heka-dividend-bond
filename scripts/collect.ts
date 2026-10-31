import {authorize,runAgent} from '../server/agent.ts';
import {read} from '../server/store.ts';
if(!read('.local/journal.json'))await authorize();
const j=await runAgent();console.log(JSON.stringify({status:j.status,mandateId:j.mandateId,paymentTx:j.paymentTx,claimTx:j.claimTx,receivedAtoms:j.receivedAtoms,reconciliation:j.reconciliation},null,2));
