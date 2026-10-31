import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {withLock} from '../server/lock.ts';
import {verifySignedResponse,deriveRequestHash} from '../server/vendor/airnode-v2.ts';
import {encodeDeployData,encodeFunctionData} from 'viem';
import {artifact,roles} from '../server/chain.ts';
import {durableTransaction} from '../server/transactions.ts';
import {read,write,now} from '../server/store.ts';
import {request,requestHash,signer} from '../server/config.ts';
export async function deployScenario(run:string){
if(!/^[a-z0-9-]{1,40}$/.test(run))throw new Error('Use a simple scenario ID');
const file=`.local/deploy-${run}.json`;const state=read(file)||{id:run,createdAt:now()};
if(!state.contractAddress){
 const discovery=read('evidence/event-discovery.json');const response=discovery?.payment?.response;if(!response)throw new Error('Run npm run discover-event before opening a new funded obligation');
 await verifySignedResponse(response,signer,deriveRequestHash({operation:request.operation,parameters:request.parameters}));
 const records=JSON.parse(response.data);if(!Array.isArray(records)||records.length!==1||records[0].date!==request.parameters.from||records[0].paymentDate!=='2025-08-14'||records[0].currency!=='USD')throw new Error('Historical event is not uniquely identified');
 state.discoveryRequestHash=response.requestHash;state.discoveryCheckedBeforeDeployment=true;
}
const token=artifact('TestDividendUSD');const bond=artifact('DividendBond');const issuer=roles().deployer.address;const beneficiary=roles().buyer.address;
if(!state.tokenAddress){const t=await durableTransaction(`${run}-token`,{data:encodeDeployData({abi:token.abi,bytecode:token.bytecode.object,args:[issuer,1000000000n]})});state.tokenAddress=t.receipt.contractAddress;state.tokenTx=t.hash;write(file,state);}
const terms=state.terms||{asset:state.tokenAddress,beneficiary,airnode:signer,requestHash,ticker:request.parameters.ticker,eventDate:BigInt(Date.parse('2025-08-11T00:00:00Z')/1000).toString(),paymentDate:BigInt(Date.parse('2025-08-14T00:00:00Z')/1000).toString(),quantityE18:'100000000000000000000',payoutCap:'50000000',earliestSettlement:state.createdAt,claimDeadline:state.createdAt+86400,voidGrace:3600};state.terms=terms;write(file,state);
if(!state.contractAddress){const t=await durableTransaction(`${run}-contract`,{data:encodeDeployData({abi:bond.abi,bytecode:bond.bytecode.object,args:[terms]})});state.contractAddress=t.receipt.contractAddress;state.txHash=t.hash;write(file,state);}
const approval=await durableTransaction(`${run}-approve`,{to:state.tokenAddress,data:encodeFunctionData({abi:token.abi,functionName:'approve',args:[state.contractAddress,50000000n]})});
const funding=await durableTransaction(`${run}-fund`,{to:state.contractAddress,data:encodeFunctionData({abi:bond.abi,functionName:'fund'})});
state.fundingTx=funding.hash;state.approvalTx=approval.hash;state.network={chainId:84532,name:'Base Sepolia',explorer:'https://sepolia.basescan.org'};write(file,state);write('evidence/deployment.json',state);write('evidence/request-manifest.json',{source:'EODHD',sourceUrl:'https://airnode-eodhd.fly.dev/',request,requestHash,signer,semantics:'from/to filters ex-dividend date; unadjustedValue is declared dividend per unit in USD; historical event has no upstream update timestamp',terms});return state;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 await withLock('workflow',async()=>{const previous=read('evidence/deployment.json');const run=process.argv[2]||'bond-01';if(previous&&previous.id!==run)throw new Error('Use npm run fresh -- <new-id> to preserve previous scenario evidence');console.log(JSON.stringify(await deployScenario(run),null,2));});
}

