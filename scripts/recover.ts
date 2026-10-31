import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {root,read,safeError} from '../server/store.ts';

/** Only proven-dead local owners can release known workflow locks. No age-based/stale timeout bypass. */
export function clearDeadLocks(names=['workflow','data-payments']){
 const dead:Array<{directory:string,token:string,pid:number,name:string}>=[];
 for(const name of names){
  if(!/^[A-Za-z0-9_-]{1,160}$/.test(name))throw new Error('Invalid recovery lock name');
  const directory=path.join(root,'.local','locks',name+'.lock');
  if(!fs.existsSync(directory))continue;
  let owner:any;try{owner=JSON.parse(fs.readFileSync(path.join(directory,'owner.json'),'utf8'));}catch{throw new Error(`Cannot establish owner of ${name}.lock; inspect it manually without starting another worker.`);}
  if(!Number.isSafeInteger(owner.pid)||owner.pid<=0||typeof owner.token!=='string'||!owner.token||(owner.hostname!==undefined&&owner.hostname!==os.hostname()))throw new Error(`Invalid or foreign owner for ${name}.lock; recovery stopped.`);
  try{process.kill(owner.pid,0);throw new Error(`Owner PID ${owner.pid} for ${name}.lock is live; recovery stopped.`);}catch(e:any){if(e.code!=='ESRCH')throw e;}
  dead.push({directory,token:owner.token,pid:owner.pid,name});
 }
 // Validate every owner before removing any lock. Confirm identity again immediately before each removal.
 for(const lock of dead){const owner=JSON.parse(fs.readFileSync(path.join(lock.directory,'owner.json'),'utf8'));if(owner.token!==lock.token||owner.pid!==lock.pid)throw new Error('Lock owner changed; recovery stopped.');fs.rmSync(lock.directory,{recursive:true});}
 return dead.map(x=>x.name);
}

async function main(){
 if(!read('.local/journal.json'))throw new Error('No existing collection mandate to recover; this command never creates one.');
 const released=clearDeadLocks();
 const {runAgent}=await import('../server/agent.ts');
 const j=await runAgent();
 console.log(JSON.stringify({releasedLocks:released,status:j.status,mandateId:j.mandateId,paymentTx:j.paymentTx,claimTx:j.claimTx,receivedAtoms:j.receivedAtoms,reconciliation:j.reconciliation},null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(safeError(e));process.exitCode=1;});
