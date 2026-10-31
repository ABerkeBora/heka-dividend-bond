import fs from 'node:fs';
import path from 'node:path';
import { createPublicClient, createWalletClient, http, type Hex } from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {baseSepolia} from 'viem/chains';
import {rpcUrl,runtimeScope,runtimeRole} from './config.ts';
import {root,scopedPath} from './store.ts';
export const publicClient=createPublicClient({chain:baseSepolia,transport:http(rpcUrl,{retryCount:2,timeout:20000})});
export function roles(){if(runtimeScope==='v2')throw new Error('Issuer roles are unavailable to the V2 collector runtime');const file=process.env.WALLET_FILE;if(!file)throw new Error('Set WALLET_FILE to your isolated Base Sepolia wallet JSON (see .env.example).');const x=JSON.parse(fs.readFileSync(file,'utf8'));if(x.testOnly!==true||x.chainId!==84532||x.project!=='dividend-bond')throw new Error('Wallet must be testOnly chain84532 dividend-bond.');if((fs.statSync(file).mode&0o077)!==0)throw new Error('Wallet permissions must be0600.');return x.roles as Record<'deployer'|'buyer'|'counterparty',{address:Hex,privateKey:Hex}>;}
export function collectorWallet(){
 const file=path.resolve(process.env.COLLECTOR_WALLET_FILE||path.join(root,'.local/v2/collector-wallet.json'));
 const prefix=path.join(root,'.local/v2');if(!file.startsWith(prefix+path.sep))throw new Error('Collector wallet must remain in the V2 local namespace');
 if((fs.statSync(file).mode&0o077)!==0)throw new Error('Collector wallet permissions must be0600');
 const x=JSON.parse(fs.readFileSync(file,'utf8'));
 if(x.testOnly!==true||x.chainId!==84532||x.project!=='dividend-bond'||x.scope!=='v2'||!x.collector||Object.keys(x).some(k=>!['testOnly','chainId','project','scope','collector'].includes(k))||Object.keys(x.collector).some(k=>!['address','privateKey'].includes(k)))throw new Error('Invalid collector-only test wallet schema');
 const account=privateKeyToAccount(x.collector.privateKey);if(account.address.toLowerCase()!==String(x.collector.address).toLowerCase())throw new Error('Collector wallet address does not match its key');return account;
}
export function payerAccount(){return runtimeScope==='v2'?collectorWallet():privateKeyToAccount(roles().deployer.privateKey);}
export function wallet(role:'deployer'|'buyer'|'counterparty'|'collector'=runtimeRole){if(runtimeScope==='v2'&&role!=='collector')throw new Error('V2 runtime can only execute as collector');const account=role==='collector'?collectorWallet():privateKeyToAccount(roles()[role].privateKey);return createWalletClient({chain:baseSepolia,account,transport:http(rpcUrl,{retryCount:0,timeout:20000})});}
export function artifact(name:string){if(!/^[A-Za-z][A-Za-z0-9]*$/.test(name))throw new Error('Invalid contract artifact name');const bundled=path.join(root,`artifacts/${name}.json`);if(runtimeScope==='v2')return JSON.parse(fs.readFileSync(bundled,'utf8'));const compiled=path.join(root,`out/${name}.sol/${name}.json`);return JSON.parse(fs.readFileSync(fs.existsSync(compiled)?compiled:bundled,'utf8'));}
export const tokenAbi=[{type:'function',name:'balanceOf',inputs:[{name:'account',type:'address'}],outputs:[{type:'uint256'}],stateMutability:'view'},{type:'function',name:'approve',inputs:[{name:'spender',type:'address'},{name:'amount',type:'uint256'}],outputs:[{type:'bool'}],stateMutability:'nonpayable'},{type:'function',name:'authorizationState',inputs:[{type:'address'},{type:'bytes32'}],outputs:[{type:'bool'}],stateMutability:'view'}] as const;
