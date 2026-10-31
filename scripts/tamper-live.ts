import fs from 'node:fs';
import path from 'node:path';
import {encodePacked,keccak256,toHex,type Address} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {artifact,publicClient,tokenAbi} from '../server/chain.ts';
import {requestHash,signer} from '../server/config.ts';
import {read,write,root} from '../server/store.ts';
import {deriveRequestHash,verifySignedResponse,type SignedResponse} from '../server/vendor/airnode-v2.ts';

// Read-only against the real deployed Base Sepolia contract. No wallet role or signing wallet is loaded.
// The sole signing operation below uses the public integer-1 LOCAL TEST key to create a negative case.
const deployment=read('evidence/deployment.json');
if(!deployment)throw new Error('Deploy and fund the obligation first.');
const abi=artifact('DividendBond').abi;
const contractAddress=deployment.contractAddress as Address;
const tokenAddress=deployment.tokenAddress as Address;
const beneficiary=deployment.terms.beneficiary as Address;
if(deployment.terms.requestHash!==requestHash||deployment.terms.airnode.toLowerCase()!==signer.toLowerCase()){
  throw new Error('Deployed terms differ from the independently pinned source configuration.');
}
const preflight=read('evidence/preflight.json');
if(!preflight?.response)throw new Error('Capture a genuine EODHD response first.');
const staleProof=preflight.response as SignedResponse;
const collection=read('evidence/collection.json');
const selectedFile=process.argv[2];
const selected=selectedFile?JSON.parse(fs.readFileSync(path.resolve(root,selectedFile),'utf8')):collection?.response;
const proof=(selected?.response||selected||staleProof) as SignedResponse;
const wrongRequest=read('test/fixtures/real-eodhd-wrong-request.json') as SignedResponse;
if(!wrongRequest)throw new Error('Missing real wrong-request fixture.');
await verifySignedResponse(staleProof,signer,requestHash);
await verifySignedResponse(proof,signer,requestHash);
const differentHash=deriveRequestHash({operation:'searchInstruments',parameters:{query:'AAPL',limit:1}});
await verifySignedResponse(wrongRequest,signer,differentHash);
if(differentHash===requestHash)throw new Error('Wrong-request test must use a different real request.');

const block=await publicClient.getBlock();
if(block.number===null)throw new Error('Latest block is not confirmed.');
async function snapshot(blockNumber?:bigint){
  const [state,claimedAmount,reserveAtoms,beneficiaryAtoms]=await Promise.all([
    publicClient.readContract({address:contractAddress,abi,functionName:'state',blockNumber}),
    publicClient.readContract({address:contractAddress,abi,functionName:'claimedAmount',blockNumber}),
    publicClient.readContract({address:tokenAddress,abi:tokenAbi,functionName:'balanceOf',args:[contractAddress],blockNumber}),
    publicClient.readContract({address:tokenAddress,abi:tokenAbi,functionName:'balanceOf',args:[beneficiary],blockNumber})
  ]);
  return {state:Number(state),claimedAmount:String(claimedAmount),reserveAtoms:String(reserveAtoms),beneficiaryAtoms:String(beneficiaryAtoms)};
}
const before=await snapshot(block.number);
const functionName=before.state===1?'claimFor':'validateResponse';
function errorDetail(error:unknown){
  let current:any=error;
  for(let i=0;current&&i<12;i++,current=current.cause){
    if(current.data?.errorName)return {errorName:String(current.data.errorName),args:current.data.args||[],message:String(current.shortMessage||current.message).slice(0,300)};
  }
  return {errorName:null,args:[],message:String((error as any)?.shortMessage||(error as any)?.message||error).slice(0,400)};
}
type TestResult={name:string,status:'PASS'|'FAIL'|'PENDING',expected:string,actual?:unknown,proofTimestamp?:string,detail?:string};
const cases:TestResult[]=[];
async function reject(name:string,response:SignedResponse,expected:string){
  try{
    await publicClient.simulateContract({address:contractAddress,abi,functionName,
      args:[BigInt(response.timestamp),toHex(response.data),response.signature],
      account:beneficiary,blockNumber:block.number!});
    cases.push({name,status:'FAIL',expected,actual:'ACCEPTED',proofTimestamp:response.timestamp});
  }catch(error){
    const detail=errorDetail(error);
    cases.push({name,status:detail.errorName===expected?'PASS':'FAIL',expected,actual:detail,proofTimestamp:response.timestamp});
  }
}
const parsed=JSON.parse(proof.data);
if(typeof parsed.declaredDividend!=='number'&&typeof parsed.declaredDividend!=='string')throw new Error('Unexpected genuine dividend schema.');
const edited={...proof,data:proof.data.replace(/("declaredDividend"\s*:\s*)("[^"\\]*"|-?\d+(?:\.\d+)?)/,(_match,prefix:string)=>`${prefix}0.99`)};
if(edited.data===proof.data||JSON.parse(edited.data).declaredDividend===parsed.declaredDividend)throw new Error('Could not produce the edited-value case.');
await reject('edited-value',edited,'NotSignedByAirnode');
if(block.timestamp>BigInt(staleProof.timestamp)+300n){
  await reject('real-stale-response',staleProof,'ResponseTooOld');
}else{
  cases.push({name:'real-stale-response',status:'PENDING',expected:'ResponseTooOld',proofTimestamp:staleProof.timestamp,
    detail:`Genuine response has not aged beyond 300 seconds at block ${block.number}. Rerun after Unix ${BigInt(staleProof.timestamp)+301n}; timestamp was not edited.`});
}
await reject('different-real-request',wrongRequest,'NotSignedByAirnode');
const localTestAccount=privateKeyToAccount(toHex(1n,{size:32}));
const forged={...proof,timestamp:String(block.timestamp)};
forged.signature=await localTestAccount.signMessage({message:{raw:keccak256(encodePacked(
  ['bytes32','uint256','bytes'],[requestHash,block.timestamp,toHex(forged.data)]))}});
await reject('local-wrong-signer',forged,'NotSignedByAirnode');

// A valid static response check is useful only while the genuine proof is timely. The actual payout is separate evidence.
let validCase:Record<string,unknown>;
const proofAge=block.timestamp-BigInt(proof.timestamp);
if(proofAge<=300n&&proofAge>=-60n){
  try{
    const result=await publicClient.readContract({address:contractAddress,abi,functionName:'validateResponse',
      args:[BigInt(proof.timestamp),toHex(proof.data),proof.signature],blockNumber:block.number}) as [bigint,bigint];
    validCase={status:'PASS',method:'validateResponse eth_call',dividendE18:String(result[0]),payoutAtoms:String(result[1]),proofTimestamp:proof.timestamp};
  }catch(error){validCase={status:'FAIL',...errorDetail(error)};}
}else{
  validCase={status:'PENDING',method:'validateResponse eth_call',detail:'Selected genuine proof is outside the freshness window. Supply a fresh captured response as the script argument; no data purchase is initiated by this script.',proofTimestamp:proof.timestamp};
}
const after=await snapshot();
const unchanged=JSON.stringify(before)===JSON.stringify(after);
const previousReport=read('evidence/tamper-live.json');
const earlierTimelyValidation=previousReport?.validCase?.status==='PASS'
  ?{blockNumber:previousReport.blockNumber,blockTimestamp:previousReport.blockTimestamp,...previousReport.validCase}
  :previousReport?.earlierTimelyValidation||null;
const report={checkedAt:new Date().toISOString(),network:{chainId:84532,name:'Base Sepolia'},contractAddress,
  method:`${functionName} via read-only eth_call simulation`,broadcastTransactions:false,
  blockNumber:String(block.number),blockTimestamp:String(block.timestamp),requestHash,expectedSigner:signer,
  explanation:functionName==='claimFor'?'All rejection cases simulated the actual claim calldata while the obligation was Active. No transaction was broadcast.':'The obligation was already consumed or inactive; proof-policy checks use validateResponse so InvalidState does not mask tamper rejection. No transaction was broadcast.',
  validCase,earlierTimelyValidation,cases,before,after,protectedStateUnchanged:unchanged,
  status:cases.every(x=>x.status==='PASS')&&unchanged?'PASS':cases.some(x=>x.status==='FAIL')||!unchanged?'FAIL':'PENDING',
  caveat:unchanged?'Static calls cannot mutate chain state; before/after balances and consumption flag were also read from the real deployment.':'State changed between snapshots. Another transaction may have occurred; inspect chain history before attributing the change to this read-only script.'};
write('evidence/tamper-live.json',report);
console.log(JSON.stringify(report,(_key,value)=>typeof value==='bigint'?String(value):value,2));
if(report.status==='FAIL')process.exitCode=1;
