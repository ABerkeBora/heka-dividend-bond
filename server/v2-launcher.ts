import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {root} from './store.ts';
import {rpcUrl} from './config.ts';

export type V2Command='state'|'authorize'|'run'|'verify'|'probe'|'reject-check'|'recover';
const commands=new Set<V2Command>(['state','authorize','run','verify','probe','reject-check','recover']);
/** Launch trusted collector code with a narrow filesystem capability; this is not a hostile-code sandbox. */
export async function runV2(command:V2Command,input?:unknown):Promise<any>{
 if(!commands.has(command))throw new Error('Unsupported V2 command');
 if(Number(process.versions.node.split('.')[0])!==24)throw new Error('V2 collector requires Node.js 24');
 const inputJson=JSON.stringify(input??null);if(Buffer.byteLength(inputJson)>65536)throw new Error('V2 input exceeds64KiB');
 const privateRoot=path.join(root,'.local/v2');const publicRoot=path.join(root,'evidence/v2');
 fs.mkdirSync(privateRoot,{recursive:true,mode:0o700});fs.mkdirSync(publicRoot,{recursive:true});
 const collectorFile=path.resolve(process.env.COLLECTOR_WALLET_FILE||path.join(privateRoot,'collector-wallet.json'));
 if(!collectorFile.startsWith(privateRoot+path.sep))throw new Error('Collector wallet must be inside the V2 namespace');
 if(fs.existsSync(collectorFile)&&!fs.realpathSync(collectorFile).startsWith(fs.realpathSync(privateRoot)+path.sep))throw new Error('Collector wallet must not link outside the V2 namespace');
 const issuerProbe=process.env.WALLET_FILE||path.join(root,'.local','issuer-wallet-deny-probe.json');
 const env:Record<string,string>={DIVIDEND_SCOPE:'v2',NODE_ENV:'production',RPC_URL:rpcUrl,COLLECTOR_WALLET_FILE:collectorFile,DENY_PROBE:issuerProbe,DENY_PROBE_CONFIGURED:process.env.WALLET_FILE?'true':'false'};
 const reads=['server','node_modules','artifacts','evidence/v2','.local/v2','package.json'].map(x=>path.join(root,x));
 const publicWrites=command==='state'||command==='verify'?[]:[`--allow-fs-write=${publicRoot}`];
 const args=['--permission',...reads.map(x=>`--allow-fs-read=${x}`),`--allow-fs-write=${privateRoot}`,...publicWrites,'--no-warnings','--max-old-space-size=256',path.join(root,'server/v2-worker.ts'),command];
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,args,{cwd:root,env,stdio:['pipe','pipe','pipe']});let stdout='';let stderr='';let killed=false;
  const timer=setTimeout(()=>{killed=true;child.kill('SIGTERM');},180000);
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  child.stdout.on('data',chunk=>{stdout+=chunk;if(stdout.length>2_000_000){killed=true;child.kill('SIGTERM');}});
  child.stderr.on('data',chunk=>{stderr+=chunk;if(stderr.length>20000){killed=true;child.kill('SIGTERM');}});
  child.on('error',()=>{clearTimeout(timer);reject(new Error('V2 collector process could not start'));});
  child.on('close',code=>{clearTimeout(timer);if(killed)return reject(new Error('V2 collector stopped at runtime limit; reconcile its existing intent before retrying'));
   let result:any;try{result=JSON.parse(stdout.trim()||stderr.trim());}catch{return reject(new Error('V2 collector returned an invalid result'));}
   if(code!==0||result?.ok===false)return reject(new Error(result?.error||'V2 collector operation failed'));resolve(result.result);
  });
  child.stdin.on('error',()=>{});child.stdin.end(inputJson);
 });
}
