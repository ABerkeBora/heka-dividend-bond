import fs from 'node:fs';
import path from 'node:path';
export const root = path.resolve(import.meta.dirname,'..');
export function read<T=any>(name:string,fallback:T=null as T):T {try{return JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));}catch(e:any){if(e.code==='ENOENT')return fallback;throw e;}}
export function write(name:string,data:unknown){const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,(_k,v)=>typeof v==='bigint'?v.toString():v,2)+'\n',{mode:0o600});fs.renameSync(tmp,file);}
export const now=()=>Math.floor(Date.now()/1000);
export function safeError(e:any){return String(e.shortMessage||e.message||e).slice(0,500);}
