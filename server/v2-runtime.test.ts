import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import http from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {privateKeyToAccount} from 'viem/accounts';
import {root,scopedPath} from './store.ts';

const exec=promisify(execFile);
const scopeRoot=path.join(root,'.local/v2');
function args(script:string){const reads=['server','node_modules','artifacts','evidence/v2','.local/v2','package.json'].map(x=>path.join(root,x));return ['--permission',...reads.map(x=>`--allow-fs-read=${x}`),`--allow-fs-write=${path.join(root,'.local/v2')}`,`--allow-fs-write=${path.join(root,'evidence/v2')}`,'--no-warnings','--input-type=module','-e',script];}
const env=(extra:Record<string,string>={})=>({DIVIDEND_SCOPE:'v2',NODE_ENV:'production',RPC_URL:'https://sepolia.base.org',...extra});
test('default V1 store paths are unchanged',()=>{assert.equal(scopedPath('.local/journal.json'),path.join(root,'.local/journal.json'));assert.equal(scopedPath('evidence/deployment.json'),path.join(root,'evidence/deployment.json'));});
test('V2 store maps canonical local/evidence names once and rejects escapes',async()=>{
 const code=`import assert from 'node:assert/strict';import path from 'node:path';import {scopedPath,root} from './server/store.ts';assert.equal(scopedPath('.local/journal.json'),path.join(root,'.local/v2/journal.json'));assert.equal(scopedPath('evidence/deployment.json'),path.join(root,'evidence/v2/deployment.json'));assert.equal(scopedPath('.local/v2/journal.json'),path.join(root,'.local/v2/journal.json'));assert.throws(()=>scopedPath('evidence/../.env'));assert.throws(()=>scopedPath('../escape'));console.log('pass');`;
 const result=await exec(process.execPath,args(code),{cwd:root,env:env()});assert.equal(result.stdout.trim(),'pass');
});
test('V2 roles() fails before issuer key access and bundled artifacts work without out permission',async()=>{
 const code=`import assert from 'node:assert/strict';import {roles,artifact} from './server/chain.ts';assert.throws(()=>roles(),/unavailable/);assert.equal(artifact('DividendBond').contractName??'DividendBond','DividendBond');console.log('pass');`;
 const result=await exec(process.execPath,args(code),{cwd:root,env:env({WALLET_FILE:'/not-readable-issuer.json'})});assert.equal(result.stdout.trim(),'pass');
});
test('native collector worker proves actual filesystem denial and accepts collector-only schema without leaking key',async()=>{
 const id=randomUUID();const fixtureDir=path.join(scopeRoot,'tests',id);const sentinelDir=path.join(root,'.local/v2-test-sentinels',id);fs.mkdirSync(fixtureDir,{recursive:true,mode:0o700});fs.mkdirSync(sentinelDir,{recursive:true,mode:0o700});
 const collectorFile=path.join(fixtureDir,'collector-wallet.json');const denyFile=path.join(sentinelDir,'issuer.json');const key=('0x'+'0'.repeat(63)+'1') as `0x${string}`;const account=privateKeyToAccount(key);
 fs.writeFileSync(collectorFile,JSON.stringify({testOnly:true,chainId:84532,project:'dividend-bond',scope:'v2',collector:{address:account.address,privateKey:key}}),{mode:0o600});fs.writeFileSync(denyFile,'issuer-sentinel',{mode:0o600});
 const reads=['server','node_modules','artifacts','evidence/v2','.local/v2','package.json'].map(x=>path.join(root,x));const workerArgs=['--permission',...reads.map(x=>`--allow-fs-read=${x}`),`--allow-fs-write=${scopeRoot}`,`--allow-fs-write=${path.join(root,'evidence/v2')}`,'--no-warnings',path.join(root,'server/v2-worker.ts'),'probe'];
 try{
  const result=await exec(process.execPath,workerArgs,{cwd:root,env:env({COLLECTOR_WALLET_FILE:collectorFile,DENY_PROBE:denyFile,DENY_PROBE_CONFIGURED:'true',V2_TEST_MODE:'1'})});const wrapper=JSON.parse(result.stdout);const proof=wrapper.result;
  assert.equal(wrapper.ok,true);assert.equal(proof.runtimeRestricted,true);assert.equal(proof.issuerReadDenied,true);assert.equal(proof.issuerReadErrorCode,'ERR_ACCESS_DENIED');assert.equal(proof.parentEnvReadDenied,true);assert.equal(proof.v1JournalReadDenied,true);assert.equal(proof.v1EvidenceReadDenied,true);assert.equal(proof.collectorSecretOnly,true);assert.equal(proof.collector,account.address);assert.deepEqual(proof.collectorSchema.roleFields,['collector']);assert.equal(proof.childProcessAllowed,false);assert.equal(proof.workerThreadsAllowed,false);assert.equal(proof.nativeAddonsAllowed,false);assert.equal(result.stdout.includes(key),false);assert.equal(result.stdout.includes(denyFile),false);
  // The worker's own ignored test proof is separate from public live runtime evidence.
  const testProof=path.join(scopeRoot,'runtime-proof-test.json');assert.equal(JSON.parse(fs.readFileSync(testProof,'utf8')).issuerReadDenied,true);fs.unlinkSync(testProof);
 }finally{fs.rmSync(fixtureDir,{recursive:true});fs.rmSync(sentinelDir,{recursive:true});}
});
test('collector wallet rejects an issuer-role schema even inside the allowed directory',async()=>{
 const directory=path.join(scopeRoot,'tests',randomUUID());fs.mkdirSync(directory,{recursive:true,mode:0o700});const file=path.join(directory,'wrong-wallet.json');fs.writeFileSync(file,JSON.stringify({testOnly:true,chainId:84532,project:'dividend-bond',scope:'v2',collector:{address:'0x1',privateKey:'0x1'},roles:{deployer:{}}}),{mode:0o600});
 try{const code=`import assert from 'node:assert/strict';import {collectorWallet} from './server/chain.ts';assert.throws(()=>collectorWallet(),/schema/);console.log('pass');`;const result=await exec(process.execPath,args(code),{cwd:root,env:env({COLLECTOR_WALLET_FILE:file})});assert.equal(result.stdout.trim(),'pass');}finally{fs.rmSync(directory,{recursive:true});}
});
test('restricted V2 recovery releases only its scoped dead lock and refuses a live owner',async()=>{
 const id='scope-recovery-'+randomUUID();
 const code=`import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {scopedPath} from './server/store.ts';import {clearDeadLocks,withLock} from './server/lock.ts';const id=${JSON.stringify(id)};const directory=scopedPath('.local/locks/'+id+'.lock');fs.mkdirSync(directory,{recursive:true,mode:0o700});fs.writeFileSync(path.join(directory,'owner.json'),JSON.stringify({pid:2147483647,token:'dead-unit-owner'}),{mode:0o600});assert.deepEqual(clearDeadLocks([id]),[id]);assert.equal(fs.existsSync(directory),false);await withLock(id,async()=>assert.throws(()=>clearDeadLocks([id]),/live/));console.log('pass');`;
 const result=await exec(process.execPath,args(code),{cwd:root,env:env()});assert.equal(result.stdout.trim(),'pass');
});
test('state polling and response verification leave public evidence bytes and runtime history unchanged',async()=>{
 const server=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;const requests=JSON.parse(body);function respond(item:any){
  let result:any='0x'+'0'.repeat(64);
  if(item.method==='eth_getTransactionCount')result='0x0';
  if(item.method==='eth_chainId')result='0x14a34';
  if(item.method==='eth_getTransactionByHash')result={hash:item.params[0],from:'0x4d299e20b77a197950ce862b311ab34b4237fbec',to:'0x020c8bc7c9d4e3fdde1af6d9ad31a284850289ba',nonce:'0x0',gas:'0x100000',gasPrice:'0x1',value:'0x0',input:'0x',type:'0x0',blockHash:'0x'+'1'.repeat(64),blockNumber:'0x1',transactionIndex:'0x0',v:'0x1b',r:'0x'+'1'.repeat(64),s:'0x'+'2'.repeat(64)};
  return {jsonrpc:'2.0',id:item.id,result};
 }res.setHeader('Content-Type','application/json');res.end(JSON.stringify(Array.isArray(requests)?requests.map(respond):respond(requests)));});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const port=(server.address() as any).port;
 function snapshot(directory:string){const files:Record<string,string>={};function visit(current:string){if(!fs.existsSync(current))return;for(const entry of fs.readdirSync(current,{withFileTypes:true})){const file=path.join(current,entry.name);if(entry.isDirectory())visit(file);else files[path.relative(directory,file)]=createHash('sha256').update(fs.readFileSync(file)).digest('hex');}}visit(directory);return files;}
 const publicDirectory=path.join(root,'evidence/v2');const historyDirectory=path.join(scopeRoot,'runtime-proofs');const before=snapshot(publicDirectory);const historyBefore=fs.existsSync(historyDirectory)?fs.readdirSync(historyDirectory).sort():[];
 try{
  const code=`import {runV2} from './server/v2-launcher.ts';const state=await runV2('state');const response=await runV2('verify',{});console.log(JSON.stringify({chainId:state.network.chainId,valid:response.valid}));`;
  const result=await exec(process.execPath,['--input-type=module','-e',code],{cwd:root,env:{...process.env,RPC_URL:`http://127.0.0.1:${port}`,COLLECTOR_WALLET_FILE:path.join(scopeRoot,'tests','missing-read-only-wallet.json'),WALLET_FILE:'/private/unit-issuer-probe.json'}});
  assert.deepEqual(JSON.parse(result.stdout),{chainId:84532,valid:false});assert.deepEqual(snapshot(publicDirectory),before);
  const historyAfter=fs.existsSync(historyDirectory)?fs.readdirSync(historyDirectory).sort():[];assert.deepEqual(historyAfter,historyBefore);
  const lastRead=JSON.parse(fs.readFileSync(path.join(scopeRoot,'runtime-last-read.json'),'utf8'));assert.equal(lastRead.command,'verify');assert.equal(lastRead.issuerReadDenied,true);
 }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
