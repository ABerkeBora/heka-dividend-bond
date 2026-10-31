import {keccak256,type Hex} from 'viem';
import {read,write,safeError} from './store.ts';
import {wallet,publicClient} from './chain.ts';
export async function durableTransaction(id:string,tx:any,role:'deployer'|'buyer'|'counterparty'='deployer',maxL2Cost?:bigint){
 const file=`.local/transactions/${id}.json`;let job=read(file);
 if(!job){
  if(await publicClient.getChainId()!==84532)throw new Error('RPC must be Base Sepolia');
  const client=wallet(role);const fees=await publicClient.estimateFeesPerGas();
  const gas=await publicClient.estimateGas({...tx,account:client.account});
  const gasLimit=gas*120n/100n;
  if(maxL2Cost&&gasLimit*fees.maxFeePerGas>maxL2Cost)throw new Error('Claim gas cap exceeded');
  const prepared=await client.prepareTransactionRequest({...tx,gas:gasLimit,maxFeePerGas:fees.maxFeePerGas,maxPriorityFeePerGas:fees.maxPriorityFeePerGas});
  const raw=await client.signTransaction(prepared as any);
  let estimatedL1Fee=0n;
  if(maxL2Cost){
   estimatedL1Fee=await publicClient.readContract({address:'0x420000000000000000000000000000000000000F',abi:[{type:'function',name:'getL1Fee',inputs:[{type:'bytes',name:'_data'}],outputs:[{type:'uint256'}],stateMutability:'view'}],functionName:'getL1Fee',args:[raw]});
   if(gasLimit*fees.maxFeePerGas+estimatedL1Fee*2n>maxL2Cost*2n)throw new Error('Total estimated claim cost exceeds mandate, including doubled L1 fee estimate');
  }
  job={id,status:'SIGNED',raw,hash:keccak256(raw),role,gasLimit:gasLimit.toString(),maxFeePerGas:fees.maxFeePerGas.toString(),estimatedL1Fee:estimatedL1Fee.toString()};write(file,job);
 }
 let receipt;try{receipt=await publicClient.getTransactionReceipt({hash:job.hash});}catch{}
 if(!receipt){try{await publicClient.sendRawTransaction({serializedTransaction:job.raw});}catch(e){job.broadcastError=safeError(e);write(file,job);}
  job.status='SUBMITTED';write(file,job);receipt=await publicClient.waitForTransactionReceipt({hash:job.hash,timeout:60000});}
 job.status=receipt.status==='success'?'CONFIRMED':'REVERTED';
 job.receipt={transactionHash:receipt.transactionHash,status:receipt.status,contractAddress:receipt.contractAddress,blockNumber:receipt.blockNumber.toString(),gasUsed:receipt.gasUsed.toString(),effectiveGasPrice:receipt.effectiveGasPrice.toString(),l1Fee:String((receipt as any).l1Fee||0n),logs:receipt.logs};write(file,job);
 if(receipt.status!=='success')throw new Error(`Transaction reverted: ${job.hash}`);return job;
}
