import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import os from 'node:os';
import {scopedPath} from './store.ts';

/** Cross-process lock. Interrupted locks remain for explicit operator inspection; never silently break them. */
export async function withLock<T>(name:string,fn:()=>Promise<T>):Promise<T>{
 if(!/^[A-Za-z0-9_-]{1,160}$/.test(name))throw new Error('Invalid lock name');
 const directory=scopedPath(`.local/locks/${name}.lock`);
 fs.mkdirSync(path.dirname(directory),{recursive:true,mode:0o700});
 try{fs.mkdirSync(directory,{mode:0o700});}catch(e:any){if(e.code==='EEXIST')throw new Error(`Workflow is busy or interrupted. Inspect .local/locks/${name}.lock before retrying.`);throw e;}
 const token=randomUUID();
 try{
  fs.writeFileSync(path.join(directory,'owner.json'),JSON.stringify({pid:process.pid,hostname:os.hostname(),token,createdAt:new Date().toISOString()})+'\n',{mode:0o600});
  return await fn();
 }finally{
  // The directory was created exclusively by this call, and no other call can enter it.
  fs.rmSync(directory,{recursive:true});
 }
}

/** Explicit recovery only: remove a lock only after its same-host owner is proven dead. */
export function clearDeadLocks(names=['workflow','data-payments']){
 const dead:Array<{directory:string,token:string,pid:number,name:string}>=[];
 for(const name of names){
  if(!/^[A-Za-z0-9_-]{1,160}$/.test(name))throw new Error('Invalid recovery lock name');
  const directory=scopedPath(`.local/locks/${name}.lock`);if(!fs.existsSync(directory))continue;
  let owner:any;try{owner=JSON.parse(fs.readFileSync(path.join(directory,'owner.json'),'utf8'));}catch{throw new Error(`Cannot establish owner of ${name}.lock; inspect it manually without starting another worker.`);}
  if(!Number.isSafeInteger(owner.pid)||owner.pid<=0||typeof owner.token!=='string'||!owner.token||(owner.hostname!==undefined&&owner.hostname!==os.hostname()))throw new Error(`Invalid or foreign owner for ${name}.lock; recovery stopped.`);
  try{process.kill(owner.pid,0);throw new Error(`Owner PID ${owner.pid} for ${name}.lock is live; recovery stopped.`);}catch(e:any){if(e.code!=='ESRCH')throw e;}
  dead.push({directory,token:owner.token,pid:owner.pid,name});
 }
 for(const lock of dead){const owner=JSON.parse(fs.readFileSync(path.join(lock.directory,'owner.json'),'utf8'));if(owner.token!==lock.token||owner.pid!==lock.pid)throw new Error('Lock owner changed; recovery stopped.');fs.rmSync(lock.directory,{recursive:true});}
 return dead.map(x=>x.name);
}
