import fs from 'node:fs';
import path from 'node:path';
import {encodePacked,keccak256,toHex,type Address} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {artifact,publicClient,tokenAbi} from '../server/chain.ts';
import {requestHash,signer} from '../server/config.ts';
import {read,write,root} from '../server/store.ts';
import {deriveRequestHash,verifySignedResponse,type SignedResponse} from '../server/vendor/airnode-v2.ts';

// No roles(), wallet(), issuer key, paid API call or broadcast is used here.
// Integer 1 below is a public local test key, used solely to create a forged negative case.
const deployment=read('evidence/v2/deployment.json');
if(!deployment)throw new Error('V2 is not deployed. Run the separate V2 issuer setup first.');
const v1=read('evidence/deployment.json');
if(deployment.contractAddress?.toLowerCase()===v1?.contractAddress?.toLowerCase()
  ||deployment.tokenAddress?.toLowerCase()===v1?.tokenAddress?.toLowerCase()){
  throw new Error('V2 must have a separate contract and collateral asset.');
}
if(deployment.terms.requestHash!==requestHash||deployment.terms.airnode.toLowerCase()!==signer.toLowerCase()){
  throw new Error('V2 terms do not match the independently pinned EODHD request and signer.');
}
const abi=artifact('DividendBond').abi;
const contractAddress=deployment.contractAddress as Address;
const tokenAddress=deployment.tokenAddress as Address;
const beneficiary=deployment.terms.beneficiary as Address;
const staleProof=read('test/fixtures/real-eodhd-dividend.json') as SignedResponse;
const differentProof=read('test/fixtures/real-eodhd-wrong-request.json') as SignedResponse;
if(!staleProof||!differentProof)throw new Error('Missing genuine public EODHD fixture.');
const selectedFile=process.argv[2];
const selected=selectedFile?JSON.parse(fs.readFileSync(path.resolve(root,selectedFile),'utf8')):read('evidence/v2/collection.json');
const proof=(selected?.response||selected||staleProof) as SignedResponse;
await verifySignedResponse(staleProof,signer,requestHash);
await verifySignedResponse(proof,signer,requestHash);
const differentHash=deriveRequestHash({operation:'searchInstruments',parameters:{query:'AAPL',limit:1}});
await verifySignedResponse(differentProof,signer,differentHash);
if(differentHash===requestHash)throw new Error('Different request case must actually differ.');

const block=await publicClient.getBlock();
if(block.number===null)throw new Error('No confirmed Base Sepolia block.');
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
  let cursor:any=error;
  for(let i=0;cursor&&i<12;i++,cursor=cursor.cause){
    if(cursor.data?.errorName)return {errorName:String(cursor.data.errorName),args:cursor.data.args||[],message:String(cursor.shortMessage||cursor.message).slice(0,300)};
  }
  return {errorName:null,args:[],message:String((error as any)?.shortMessage||(error as any)?.message||error).slice(0,400)};
}
const cases:Array<Record<string,unknown>>=[];
async function reject(name:string,response:SignedResponse,expected:string){
  try{
    await publicClient.simulateContract({address:contractAddress,abi,functionName,
      args:[BigInt(response.timestamp),toHex(response.data),response.signature],account:beneficiary,blockNumber:block.number!});
    cases.push({name,status:'FAIL',expected,actual:'ACCEPTED',proofTimestamp:response.timestamp});
  }catch(error){
    const actual=errorDetail(error);
    cases.push({name,status:actual.errorName===expected?'PASS':'FAIL',expected,actual,proofTimestamp:response.timestamp});
  }
}
const edited={...proof,data:proof.data.replace(/("declaredDividend"\s*:\s*)("[^"\\]*"|-?\d+(?:\.\d+)?)/,(_match,prefix:string)=>`${prefix}0.99`)};
if(edited.data===proof.data||JSON.parse(edited.data).declaredDividend===JSON.parse(proof.data).declaredDividend){
  throw new Error('Cannot create edited value from the genuine source response.');
}
await reject('edited-value',edited,'NotSignedByAirnode');
if(block.timestamp>BigInt(staleProof.timestamp)+300n){
  await reject('real-stale-response',staleProof,'ResponseTooOld');
}else{
  cases.push({name:'real-stale-response',status:'PENDING',expected:'ResponseTooOld',detail:'Original signed timestamp has not naturally aged beyond 300 seconds; rerun later. No timestamp edits.'});
}
await reject('different-real-request',differentProof,'NotSignedByAirnode');
const localTest=privateKeyToAccount(toHex(1n,{size:32}));
const forged={...proof,timestamp:String(block.timestamp)};
forged.signature=await localTest.signMessage({message:{raw:keccak256(encodePacked(
  ['bytes32','uint256','bytes'],[requestHash,block.timestamp,toHex(forged.data)]))}});
await reject('local-wrong-signer',forged,'NotSignedByAirnode');

let validCase:Record<string,unknown>;
const age=block.timestamp-BigInt(proof.timestamp);
if(age<=300n&&age>=-60n){
  try{
    const result=await publicClient.readContract({address:contractAddress,abi,functionName:'validateResponse',
      args:[BigInt(proof.timestamp),toHex(proof.data),proof.signature],blockNumber:block.number}) as [bigint,bigint];
    validCase={status:'PASS',method:'validateResponse eth_call',dividendE18:String(result[0]),payoutAtoms:String(result[1]),proofTimestamp:proof.timestamp};
  }catch(error){validCase={status:'FAIL',...errorDetail(error)};}
}else{
  validCase={status:'PENDING',method:'validateResponse eth_call',detail:'No fresh V2 collection proof yet; this script does not purchase data. Actual payout is separate evidence.',proofTimestamp:proof.timestamp};
}
const after=await snapshot();
const unchanged=JSON.stringify(before)===JSON.stringify(after);
const report={version:'V2',checkedAt:new Date().toISOString(),network:{chainId:84532,name:'Base Sepolia'},contractAddress,tokenAddress,
  method:`${functionName} via read-only eth_call simulation`,broadcastTransactions:false,paidApiCalls:0,
  blockNumber:String(block.number),blockTimestamp:String(block.timestamp),requestHash,expectedSigner:signer,
  wrongRequestIndependentlyAuthenticated:{requestHash:differentHash,signer,operation:'searchInstruments'},
  explanation:functionName==='claimFor'?'All four rejection cases simulate the actual claim calldata while the separate V2 obligation is Active.':'V2 is consumed/inactive; validateResponse tests proof policy directly, avoiding an InvalidState rejection that could mask an accepted forgery.',
  validCase,cases,before,after,protectedStateUnchanged:unchanged,
  tamperStatus:cases.every(x=>x.status==='PASS')&&unchanged?'PASS':cases.some(x=>x.status==='FAIL')||!unchanged?'FAIL':'PENDING',
  caveat:'These are live deployed-contract eth_call checks, not broadcast rejection transactions. Static calls cannot mutate state; actual balances and consumed state are also sampled before and after.'};
if(before.state===1&&!read('evidence/v2/tamper-before-claim.json'))write('evidence/v2/tamper-before-claim.json',report);
write('evidence/v2/tamper-live.json',report);
console.log(JSON.stringify(report,(_key,value)=>typeof value==='bigint'?String(value):value,2));
if(report.tamperStatus==='FAIL'||validCase.status==='FAIL')process.exitCode=1;
