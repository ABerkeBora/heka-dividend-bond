import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {encodeDeployData,encodeFunctionData,parseAbi,type Address} from 'viem';
import {artifact,roles,publicClient,tokenAbi} from '../server/chain.ts';
import {read,write,now,root} from '../server/store.ts';
import {chainState} from '../server/agent.ts';
import {request,requestHash,signer,asset,policy,discoveryRequestHash} from '../server/config.ts';
import {verifySignedResponse} from '../server/vendor/airnode-v2.ts';
import {durableTransaction} from '../server/transactions.ts';
import {withLock} from '../server/lock.ts';

if(process.env.DIVIDEND_SCOPE==='v2')throw new Error('Issuer setup must run outside collector runtime');
await withLock('v2-issuer-setup',async()=>{
 const run='independent-01';const filename='.local/v2/setup.json';const old=read(filename);const initialRoles=roles();
 const issuer=initialRoles.deployer.address;const collector=initialRoles.buyer.address;
 if(issuer.toLowerCase()===collector.toLowerCase())throw new Error('Collector must be a different signer');
 const before=read('evidence/v2/v1-before.json');if(!before){
  const files=execFileSync('git',['ls-tree','-r','--name-only','v1-baseline','evidence/'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
  const hashes=Object.fromEntries(files.map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
  write('evidence/v2/v1-before.json',{checkedAt:new Date().toISOString(),baselineCommit:'3a177521c49a32b07ccbc1be3985df8a86eab0c8',blockNumber:String(await publicClient.getBlockNumber()),chain:await chainState(),hashes});
 }
 const discovery=read('evidence/event-discovery.json');await verifySignedResponse(discovery.payment.response,signer,discoveryRequestHash);
 const records=JSON.parse(discovery.payment.response.data);if(records.length!==1||records[0].date!==request.parameters.from||records[0].unadjustedValue!==0.26||records[0].paymentDate!=='2025-08-14')throw new Error('Pinned raw-event discovery is ambiguous');
 // This file is the collector process's sole key capability. Issuer material is never written inside its read allowlist.
 const collectorFile='.local/v2/collector-wallet.json';const existingWallet=read(collectorFile);
 if(existingWallet&&existingWallet.collector.address.toLowerCase()!==collector.toLowerCase())throw new Error('Existing collector identity differs');
 if(!existingWallet)write(collectorFile,{testOnly:true,chainId:84532,project:'dividend-bond',scope:'v2',collector:initialRoles.buyer});
 fs.chmodSync(collectorFile,0o600);
 const s=old||{id:run,createdAt:now(),scope:'v2',issuer,collector,beneficiary:collector};
 const token=artifact('TestDividendUSD');const bond=artifact('DividendBond');
 if(!s.tokenAddress){const t=await durableTransaction('v2-setup-token',{data:encodeDeployData({abi:token.abi,bytecode:token.bytecode.object,args:[issuer,1000000000n]})},'deployer',undefined,'v2');s.tokenAddress=t.receipt.contractAddress;s.tokenTx=t.hash;write(filename,s);}
 const terms=s.terms||{asset:s.tokenAddress,beneficiary:collector,airnode:signer,requestHash,ticker:request.parameters.ticker,eventDate:'1754870400',paymentDate:'1755129600',quantityE18:'100000000000000000000',payoutCap:'50000000',earliestSettlement:s.createdAt,claimDeadline:s.createdAt+86400,voidGrace:3600};s.terms=terms;write(filename,s);
 if(!s.contractAddress){const t=await durableTransaction('v2-setup-contract',{data:encodeDeployData({abi:bond.abi,bytecode:bond.bytecode.object,args:[terms]})},'deployer',undefined,'v2');s.contractAddress=t.receipt.contractAddress;s.txHash=t.hash;write(filename,s);}
 const approval=await durableTransaction('v2-setup-approve',{to:s.tokenAddress,data:encodeFunctionData({abi:token.abi,functionName:'approve',args:[s.contractAddress,50000000n]})},'deployer',undefined,'v2');
 const funding=await durableTransaction('v2-setup-reserve',{to:s.contractAddress,data:encodeFunctionData({abi:bond.abi,functionName:'fund'})},'deployer',undefined,'v2');
 s.approvalTx=approval.hash;s.fundingTx=funding.hash;
 if(!s.collectorFundingTx){
  s.collectorAUSDBefore=String(await publicClient.readContract({address:asset,abi:tokenAbi,functionName:'balanceOf',args:[collector]}));
  if(s.collectorAUSDBefore!=='0')throw new Error('Collector already holds aUSD; reconcile initial funding manually instead of topping up');
  const transferAbi=parseAbi(['function transfer(address recipient,uint256 amount) returns(bool)']);
  const t=await durableTransaction('v2-setup-collector-ausd',{to:asset,data:encodeFunctionData({abi:transferAbi,functionName:'transfer',args:[collector,50000n]})},'deployer',undefined,'v2');s.collectorFundingTx=t.hash;s.collectorFundingAtoms='50000';write(filename,s);
 }
 s.setupComplete=true;s.setupCompletedAt=s.setupCompletedAt||now();
 s.issuerNonceAtHandoff=s.issuerNonceAtHandoff??await publicClient.getTransactionCount({address:issuer,blockTag:'pending'});
 s.collectorNonceAtHandoff=s.collectorNonceAtHandoff??await publicClient.getTransactionCount({address:collector,blockTag:'pending'});
 s.collectorGasBalanceAtHandoff=s.collectorGasBalanceAtHandoff||String(await publicClient.getBalance({address:collector}));
 s.network={chainId:84532,name:'Base Sepolia',explorer:'https://sepolia.basescan.org'};
 s.discovery={requestHash:discoveryRequestHash,source:'Shared immutable historical raw-event discovery snapshot; used only to pin setup terms, never a V2 purchase/claim receipt',recordCount:1};
 write(filename,s);write('evidence/v2/deployment.json',s);write('evidence/v2/setup.json',s);
 write('evidence/v2/request-manifest.json',{scope:'v2',request,requestHash,signer,terms,policy,source:'EODHD',sourceUrl:policy.sourceUrl,semantics:'unadjusted declared USD; ex-date filter; historical source has no updatedAt',discovery:s.discovery});
 console.log(JSON.stringify({scope:'v2',status:'Funded; issuer setup complete',contractAddress:s.contractAddress,issuer,collector,collectorFundingTx:s.collectorFundingTx,issuerNonceAtHandoff:s.issuerNonceAtHandoff,collectorNonceAtHandoff:s.collectorNonceAtHandoff},null,2));
});
