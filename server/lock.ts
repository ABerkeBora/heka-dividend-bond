import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import os from 'node:os';
import {root} from './store.ts';

/** Cross-process lock. Interrupted locks remain for explicit operator inspection; never silently break them. */
export async function withLock<T>(name:string,fn:()=>Promise<T>):Promise<T>{
 if(!/^[A-Za-z0-9_-]{1,160}$/.test(name))throw new Error('Invalid lock name');
 const directory=path.join(root,'.local','locks',name+'.lock');
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
