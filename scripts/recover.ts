import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {read,safeError} from '../server/store.ts';

import {clearDeadLocks} from '../server/lock.ts';
export {clearDeadLocks};

async function main(){
 if(!read('.local/journal.json'))throw new Error('No existing collection mandate to recover; this command never creates one.');
 const released=clearDeadLocks();
 const {runAgent}=await import('../server/agent.ts');
 const j=await runAgent();
 console.log(JSON.stringify({releasedLocks:released,status:j.status,mandateId:j.mandateId,paymentTx:j.paymentTx,claimTx:j.claimTx,receivedAtoms:j.receivedAtoms,reconciliation:j.reconciliation},null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(safeError(e));process.exitCode=1;});
