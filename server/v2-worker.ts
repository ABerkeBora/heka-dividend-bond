import fs from 'node:fs';
import path from 'node:path';

// Dependencies cannot add non-JSON output to the collector IPC channel.
console.log=()=>{};console.warn=()=>{};console.error=()=>{};
const projectRoot=path.resolve(import.meta.dirname,'..');
const command=process.argv[2];
function publicError(error:any){let message=String(error?.shortMessage||error?.message||'Collector operation failed').slice(0,500);for(const secretPath of [process.env.DENY_PROBE,process.env.COLLECTOR_WALLET_FILE])if(secretPath)message=message.split(secretPath).join('[private file]');return message;}
function deniedRead(file:string|undefined){if(!file)return {denied:false,code:'NO_PROBE_CONFIGURED'};try{fs.readFileSync(file);return {denied:false,code:'READ_SUCCEEDED'};}catch(error:any){return {denied:error.code==='ERR_ACCESS_DENIED',code:String(error.code||'UNKNOWN')};}}

async function main(){
 if(process.env.DIVIDEND_SCOPE!=='v2')throw new Error('Collector worker requires V2 scope');
 if(!['state','authorize','run','verify','probe','reject-check','recover'].includes(command))throw new Error('Unsupported collector command');
 let inputText='';if(command==='verify')for await(const chunk of process.stdin){inputText+=chunk;if(Buffer.byteLength(inputText)>65536)throw new Error('Collector input exceeds64KiB');}const input=JSON.parse(inputText||'null');
 const issuerRead=deniedRead(process.env.DENY_PROBE);const envRead=deniedRead(path.join(projectRoot,'.env'));
 const v1JournalRead=deniedRead(path.join(projectRoot,'.local/journal.json'));
 const v1EvidenceRead=deniedRead(path.join(projectRoot,'evidence/deployment.json'));
 const permission=(process as any).permission;
 const restricted=Boolean(permission&&issuerRead.denied&&envRead.denied&&v1JournalRead.denied&&v1EvidenceRead.denied&&!permission.has('child')&&!permission.has('worker')&&!permission.has('addons')&&!process.env.WALLET_FILE&&!process.env.NODE_OPTIONS);
 if(!restricted)throw new Error('Collector permission boundary is not active; no operation executed');
 const {read,write}=await import('./store.ts');
 const {collectorWallet,publicClient}=await import('./chain.ts');
 let collectorAddress:string|undefined;let collectorSecretOnly=false;let collectorSchema:any={available:false};
 try{
  const file=process.env.COLLECTOR_WALLET_FILE||path.join(projectRoot,'.local/v2/collector-wallet.json');
  const schema=JSON.parse(fs.readFileSync(file,'utf8'));collectorAddress=collectorWallet().address;collectorSecretOnly=true;
  collectorSchema={available:true,valid:true,topLevelFields:Object.keys(schema).sort(),roleFields:['collector'],collectorFields:Object.keys(schema.collector).sort()};
 }catch(error:any){if(error.code!=='ENOENT')throw error;}
 const runtimeProof:any={checkedAt:new Date().toISOString(),scope:'v2',command,node:process.version,nativeTypeScript:true,permissionEnabled:Boolean(permission),runtimeRestricted:restricted,collectorSecretOnly,collector:collectorAddress,collectorSchema,issuerProbeConfigured:process.env.DENY_PROBE_CONFIGURED==='true',issuerReadDenied:issuerRead.denied,issuerReadErrorCode:issuerRead.code,parentEnvReadDenied:envRead.denied,v1JournalReadDenied:v1JournalRead.denied,v1EvidenceReadDenied:v1EvidenceRead.denied,childProcessAllowed:permission.has('child'),workerThreadsAllowed:permission.has('worker'),nativeAddonsAllowed:permission.has('addons'),inheritedIssuerWalletEnvironment:false,claim:'Node permission model is a filesystem seat belt for this trusted collector code; it is not a hostile-code sandbox',documentation:'https://nodejs.org/docs/latest-v24.x/api/permissions.html'};
 function record(){if(command==='state'||command==='verify'){write('.local/runtime-last-read.json',runtimeProof);return;}if(process.env.V2_TEST_MODE==='1')write('.local/runtime-proof-test.json',runtimeProof);else{
  write('evidence/runtime-isolation.json',runtimeProof);
  const existing=command==='run'?read('evidence/runtime-run.json'):null;
  if(command!=='run'||existing?.runMode!=='collection'||runtimeProof.runMode==='collection')write(`evidence/runtime-${command}.json`,runtimeProof);
  write(`.local/runtime-proofs/${Date.now()}-${process.pid}-${command}.json`,runtimeProof);
 }}
 record();if(command==='probe')return runtimeProof;
 const setup=read('evidence/setup.json');
 let releasedLocks:string[]=[];
 if(command==='recover'){
  if(!read('.local/journal.json')&&!read('evidence/collection.json'))throw new Error('No existing V2 mandate to recover; a new mandate is never created');
  const {clearDeadLocks}=await import('./lock.ts');releasedLocks=clearDeadLocks();runtimeProof.releasedLocks=releasedLocks;
 }
 if(command==='reject-check'){
  const {guardRequirement}=await import('./payment.ts');const {policy}=await import('./config.ts');
  const journal=read('.local/journal.json')||read('evidence/collection.json');const mandate=journal?.mandateId?read(`.local/mandates/${journal.mandateId}.json`)||journal.mandate:null;
  if(!mandate)throw new Error('An existing V2 mandate is required for policy rejection checks');
  const offer={scheme:'exact',network:policy.network,amount:'5000',asset:policy.asset,payTo:policy.payee,maxTimeoutSeconds:300,extra:{name:'AirnodeHub USD',version:'1'}};
  const cases=[{name:'over-budget',offer:{...offer,amount:'10001'},mandate},{name:'wrong-recipient',offer:{...offer,payTo:'0x0000000000000000000000000000000000000001'},mandate},{name:'expired',offer,mandate:{...mandate,expiresAt:Math.floor(Date.now()/1000)-1}}].map(item=>{try{guardRequirement(item.offer,item.mandate);return {name:item.name,validatorDecision:'ACCEPT',broadcastTransactions:false};}catch(error){return {name:item.name,validatorDecision:'REJECT',message:publicError(error),broadcastTransactions:false};}});
  const result={checkedAt:new Date().toISOString(),scope:'v2',mandateId:mandate.mandateId,cases,broadcastTransactions:false,noPaymentAuthorizationCreated:true,status:cases.every(item=>item.validatorDecision==='REJECT')?'PASS':'FAIL',runtimeRestricted:restricted,issuerReadDenied:issuerRead.denied};
  write('evidence/reject-check.json',result);record();return result;
 }
 const agent=await import('./agent.ts');let result:any;
 const isRun=command==='run'||command==='recover';
 const beforeRun=isRun?await agent.getState():null;
 const economic=command==='authorize'||isRun&&!beforeRun?.agreement?.claimed;
 if(economic&&!collectorSecretOnly)throw new Error('Collector-only wallet is unavailable');
 if(economic&&(!setup?.setupComplete||collectorAddress?.toLowerCase()!==String(setup.collector).toLowerCase()||collectorAddress?.toLowerCase()===String(setup.issuer).toLowerCase()))throw new Error('Collector identity must match the funded V2 setup and differ from issuer');
 if(isRun)runtimeProof.runMode=beforeRun?.agreement?.claimed?'receipt-reconciliation':'collection';
 if(command==='state')result=await agent.getState();
 else if(command==='authorize')result=await agent.authorize();
 else if(isRun)result=await agent.runAgent();
 else{try{result=await agent.verifyResponse(input?.response||input);}catch(error){result={valid:false,message:publicError(error)};}}
 const journal=read('.local/journal.json')||read('evidence/collection.json');
 if(setup?.setupComplete){
  const collector=collectorAddress||setup.collector;const payment=journal?.mandateId?read(`.local/payments/${journal.mandateId}-data-01.json`):null;
  const [issuerNonce,collectorNonce,claim]=await Promise.all([publicClient.getTransactionCount({address:setup.issuer,blockTag:'pending'}),publicClient.getTransactionCount({address:collector,blockTag:'pending'}),journal?.claimTx?publicClient.getTransaction({hash:journal.claimTx}):Promise.resolve(null)]);
  let payer=payment?.settlement?.payer;const claimFrom=claim?.from;
  const recorded=read('evidence/independence.json');
  const chainClaimed=command==='state'?Boolean(result?.agreement?.claimed):isRun&&result?.status==='Collected';
  const matchingRecorded=Boolean(chainClaimed&&journal?.claimTx&&journal?.paymentTx&&recorded?.claimTransaction===journal.claimTx&&recorded?.paymentTransaction===journal.paymentTx&&String(recorded?.collector).toLowerCase()===String(setup.collector).toLowerCase()&&String(recorded?.issuer).toLowerCase()===String(setup.issuer).toLowerCase()&&claimFrom?.toLowerCase()===String(setup.collector).toLowerCase()&&recorded?.collectorSecretOnly===true&&recorded?.issuerReadDenied===true&&recorded?.runtimeRestricted===true);
  if(!payer&&matchingRecorded){
   // Public review has no private payment journal: recover the actual payer from its confirmed token Transfer.
   const [{decodeEventLog,isAddressEqual},{asset,payee}]=await Promise.all([import('viem'),import('./config.ts')]);
   const receipt=await publicClient.getTransactionReceipt({hash:journal.paymentTx});
   if(receipt.status==='success')for(const log of receipt.logs){if(!isAddressEqual(log.address,asset))continue;try{const event=decodeEventLog({abi:[{type:'event',name:'Transfer',inputs:[{name:'from',type:'address',indexed:true},{name:'to',type:'address',indexed:true},{name:'value',type:'uint256',indexed:false}]}] as const,data:log.data,topics:log.topics});if(event.args.from.toLowerCase()===collector.toLowerCase()&&isAddressEqual(event.args.to,payee)&&event.args.value===BigInt(journal.dataSpentAtoms)){payer=event.args.from;break;}}catch{}}
  }
  const useRecorded=matchingRecorded&&!collectorSecretOnly&&Boolean(payer)&&String(payer).toLowerCase()===collector.toLowerCase();
  const independence={issuer:setup.issuer,collector,payer,claimFrom,issuerNonceBefore:setup.issuerNonceAtHandoff,issuerNonceAfter:issuerNonce,collectorNonceBefore:setup.collectorNonceAtHandoff,collectorNonceAfter:collectorNonce,issuerUnchanged:setup.issuerNonceAtHandoff!==undefined?issuerNonce===setup.issuerNonceAtHandoff:undefined,collectorSecretOnly:useRecorded?recorded.collectorSecretOnly:collectorSecretOnly,issuerReadDenied:useRecorded?recorded.issuerReadDenied:issuerRead.denied,runtimeRestricted:useRecorded?recorded.runtimeRestricted:restricted,payerMatchesCollector:payer?String(payer).toLowerCase()===collector.toLowerCase():undefined,claimFromMatchesCollector:claimFrom?claimFrom.toLowerCase()===collector.toLowerCase():undefined,setupComplete:true,evidenceMode:useRecorded?'recorded successful collection':'current runtime observation',currentCollectorKeyAvailable:collectorSecretOnly,...(useRecorded?{recordedAt:recorded.checkedAt,currentRuntime:{collectorSecretOnly,issuerReadDenied:issuerRead.denied,runtimeRestricted:restricted}}:{})};
  runtimeProof.independence=independence;runtimeProof.completedAt=new Date().toISOString();if(result&&typeof result==='object')result.independence=independence;
  if(isRun&&runtimeProof.runMode==='collection')write('evidence/independence.json',{checkedAt:runtimeProof.completedAt,...independence,paymentTransaction:journal?.paymentTx,claimTransaction:journal?.claimTx,node:process.version,issuerReadErrorCode:issuerRead.code,nativeTypeScript:true});
 }
 if(command==='recover'&&result&&typeof result==='object')result.releasedLocks=releasedLocks;
 record();return result;
}
main().then(result=>process.stdout.write(JSON.stringify({ok:true,result},(_key,value)=>typeof value==='bigint'?value.toString():value)+'\n')).catch(error=>{process.stderr.write(JSON.stringify({ok:false,error:publicError(error)})+'\n');process.exitCode=1;});
