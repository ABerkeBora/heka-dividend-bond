import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {runtimeScope} from './config.ts';
export const root = path.resolve(import.meta.dirname,'..');
/** V1 paths remain identical. V2 only reads/writes its own local and public evidence namespaces. */
export function scopedPath(name:string){
 if(runtimeScope==='v1')return path.join(root,name);
 const normalized=path.normalize(name);
 let mapped:string;
 if(normalized==='.local'||normalized==='.local/v2'||normalized.startsWith('.local/v2/'))mapped=normalized==='.local'?'.local/v2':normalized;
 else if(normalized.startsWith('.local/'))mapped=path.join('.local/v2',normalized.slice('.local/'.length));
 else if(normalized==='evidence'||normalized==='evidence/v2'||normalized.startsWith('evidence/v2/'))mapped=normalized==='evidence'?'evidence/v2':normalized;
 else if(normalized.startsWith('evidence/'))mapped=path.join('evidence/v2',normalized.slice('evidence/'.length));
 else throw new Error('V2 store path must be inside its local or evidence namespace');
 const resolved=path.resolve(root,mapped);
 if(![path.join(root,'.local/v2'),path.join(root,'evidence/v2')].some(prefix=>resolved===prefix||resolved.startsWith(prefix+path.sep)))throw new Error('V2 store path escaped its namespace');
 return resolved;
}
export function read<T=any>(name:string,fallback:T=null as T):T {try{return JSON.parse(fs.readFileSync(scopedPath(name),'utf8'));}catch(e:any){if(e.code==='ENOENT')return fallback;throw e;}}
export function write(name:string,data:unknown){const file=scopedPath(name);fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=`${file}.${process.pid}.${randomUUID()}.tmp`;try{fs.writeFileSync(tmp,JSON.stringify(data,(_k,v)=>typeof v==='bigint'?v.toString():v,2)+'\n',{mode:0o600});fs.renameSync(tmp,file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}}
export const now=()=>Math.floor(Date.now()/1000);
export function safeError(e:any){return String(e.shortMessage||e.message||e).slice(0,500);}
