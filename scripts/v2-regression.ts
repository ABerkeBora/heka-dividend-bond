import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {parseAbiItem,type Address} from 'viem';
import {artifact,publicClient,tokenAbi} from '../server/chain.ts';
import {asset,payee} from '../server/config.ts';
import {read,write,root} from '../server/store.ts';

// This regression checker has no wallet/key or paid-network capability. It reads Git blobs and public chain state.
const baseline='v1-baseline';
const git=(args:string[])=>execFileSync('git',args,{cwd:root,maxBuffer:50*1024*1024});
const sha=(data:Uint8Array)=>createHash('sha256').update(data).digest('hex');
const baselineCommit=git(['rev-parse',`${baseline}^{commit}`]).toString().trim();
const files=git(['ls-tree','-r','--name-only',baseline,'evidence']).toString().trim().split('\n').filter(Boolean);
const fileChecks=files.map(file=>{
  const expected=sha(git(['show',`${baseline}:${file}`]));
  const location=path.join(root,file);
  const actual=fs.existsSync(location)?sha(fs.readFileSync(location)):null;
  return {file,expectedSha256:expected,actualSha256:actual,status:expected===actual?'PASS':'FAIL'};
});
const deployment=read('evidence/deployment.json');
const collection=read('evidence/collection.json');
const v2=read('evidence/v2/deployment.json');
if(!deployment||!collection)throw new Error('V1 deployment and receipt evidence must remain available.');
const abi=artifact('DividendBond').abi;
const block=await publicClient.getBlock();
if(block.number===null)throw new Error('No confirmed block.');
const [state,claimedAmount,reserveAtoms,beneficiaryAtoms,claimReceipt,paymentReceipt]=await Promise.all([
  publicClient.readContract({address:deployment.contractAddress,abi,functionName:'state',blockNumber:block.number}),
  publicClient.readContract({address:deployment.contractAddress,abi,functionName:'claimedAmount',blockNumber:block.number}),
  publicClient.readContract({address:deployment.tokenAddress,abi:tokenAbi,functionName:'balanceOf',args:[deployment.contractAddress],blockNumber:block.number}),
  publicClient.readContract({address:deployment.tokenAddress,abi:tokenAbi,functionName:'balanceOf',args:[deployment.terms.beneficiary],blockNumber:block.number}),
  publicClient.getTransactionReceipt({hash:collection.claimTx}),
  publicClient.getTransactionReceipt({hash:collection.paymentTx})
]);
const chain={state:Number(state),claimedAmount:String(claimedAmount),reserveAtoms:String(reserveAtoms),beneficiaryAtoms:String(beneficiaryAtoms)};
const initial=read('evidence/v2/v1-before.json');
const stateNames=['Awaiting funding','Active','Claimed','Void'];
const expected=initial?.chain?.agreement?{
  state:stateNames.indexOf(initial.chain.agreement.status),
  claimedAmount:initial.chain.agreement.payoutAtoms,
  reserveAtoms:initial.chain.balances?.reserveAtoms,
  beneficiaryAtoms:initial.chain.balances?.beneficiaryAtoms
}:initial?.chain||initial?.snapshot||initial?.agreement||initial;
const snapshotChecks=Object.entries(chain).map(([field,actual])=>{
  const expectedValue=expected?.[field];
  return {field,expected:expectedValue===undefined?null:String(expectedValue),actual:String(actual),
    status:expectedValue===undefined?'PENDING':String(expectedValue)===String(actual)?'PASS':'FAIL'};
});
const receiptChecks={claimStatus:claimReceipt.status,paymentStatus:paymentReceipt.status,
  claimHash:claimReceipt.transactionHash,paymentHash:paymentReceipt.transactionHash,
  payoutReconciles:String(claimedAmount)===String(collection.receivedAtoms)&&Number(state)===2};
const isolation={contractDistinct:!!v2&&v2.contractAddress.toLowerCase()!==deployment.contractAddress.toLowerCase(),
  tokenDistinct:!!v2&&v2.tokenAddress.toLowerCase()!==deployment.tokenAddress.toLowerCase()};
const initialBlock=initial?.blockNumber||initial?.block?.number;
let newV1DataFees:Record<string,unknown>={status:'PENDING',detail:'Initial V1 fingerprint blockNumber is missing.'};
if(initialBlock!==undefined){
  const payer=collection.mandate?.payer||collection.payer;
  if(payer){
    const ranges:Array<{fromBlock:bigint,toBlock:bigint}>=[];
    // Base's public RPC caps log queries at 200 blocks. Keep each inclusive interval to 199.
    for(let from=BigInt(initialBlock)+1n;from<=block.number;from+=199n){
      const to=from+198n>block.number?block.number:from+198n;
      ranges.push({fromBlock:from,toBlock:to});
    }
    const queriedRanges:Array<Record<string,unknown>>=[];
    const logs:Array<{args:{value?:bigint},transactionHash:unknown}>=[];
    // At most three independent read-only log requests are in flight at once.
    for(let i=0;i<ranges.length;i+=3){
      const batch=await Promise.all(ranges.slice(i,i+3).map(async range=>{
        const found=await publicClient.getLogs({address:asset,
          event:parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
          args:{from:payer as Address,to:payee},...range});
        return {range,found};
      }));
      for(const {range,found} of batch){
        queriedRanges.push({fromBlock:String(range.fromBlock),toBlock:String(range.toBlock),inclusiveBlocks:String(range.toBlock-range.fromBlock+1n),logCount:found.length});
        logs.push(...found);
      }
    }
    newV1DataFees={status:logs.length===0?'PASS':'FAIL',payer,payee,fromBlock:String(BigInt(initialBlock)+1n),toBlock:String(block.number),transferCount:logs.length,
      totalAtoms:logs.reduce((sum,log)=>sum+(log.args.value||0n),0n).toString(),transactionHashes:logs.map(log=>log.transactionHash),
      maxInclusiveBlocksPerQuery:199,maxParallelQueries:3,queriedRanges};
  }else newV1DataFees={status:'PENDING',detail:'Saved V1 receipt does not name its payer.'};
}
const after={checkedAt:new Date().toISOString(),blockNumber:String(block.number),blockTimestamp:String(block.timestamp),
  contractAddress:deployment.contractAddress,tokenAddress:deployment.tokenAddress,chain};
write('evidence/v2/v1-after.json',after);
const fail=fileChecks.some(x=>x.status==='FAIL')||snapshotChecks.some(x=>x.status==='FAIL')
  ||claimReceipt.status!=='success'||paymentReceipt.status!=='success'||!receiptChecks.payoutReconciles
  ||(!!v2&&(!isolation.contractDistinct||!isolation.tokenDistinct))||newV1DataFees.status==='FAIL';
const pending=!initial||!v2||snapshotChecks.some(x=>x.status==='PENDING')||newV1DataFees.status==='PENDING';
const report={checkedAt:after.checkedAt,baseline,baselineCommit,method:'Read-only Git SHA-256 comparison and Base Sepolia RPC',broadcastTransactions:false,paidApiCalls:0,
  publicEvidenceFiles:fileChecks,snapshotChecks,chain,receiptChecks,isolation,newV1DataFees,
  status:fail?'FAIL':pending?'PENDING':'PASS'};
write('evidence/v2/v1-regression.json',report);
console.log(JSON.stringify(report,null,2));
if(fail)process.exitCode=1;
