import fs from 'node:fs';
import path from 'node:path';
import { createPublicClient, createWalletClient, http, type Hex } from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {baseSepolia} from 'viem/chains';
import {rpcUrl} from './config.ts';
import {root} from './store.ts';
export const publicClient=createPublicClient({chain:baseSepolia,transport:http(rpcUrl,{retryCount:2,timeout:20000})});
export function roles(){const file=process.env.WALLET_FILE;if(!file)throw new Error('Set WALLET_FILE to your isolated Base Sepolia wallet JSON (see .env.example).');const x=JSON.parse(fs.readFileSync(file,'utf8'));if(x.testOnly!==true||x.chainId!==84532||x.project!=='dividend-bond')throw new Error('Wallet must be testOnly chain84532 dividend-bond.');if((fs.statSync(file).mode&0o077)!==0)throw new Error('Wallet permissions must be0600.');return x.roles as Record<'deployer'|'buyer'|'counterparty',{address:Hex,privateKey:Hex}>;}
export function wallet(role:'deployer'|'buyer'|'counterparty'='deployer'){const account=privateKeyToAccount(roles()[role].privateKey);return createWalletClient({chain:baseSepolia,account,transport:http(rpcUrl,{retryCount:0,timeout:20000})});}
export function artifact(name:string){const compiled=path.join(root,`out/${name}.sol/${name}.json`);return JSON.parse(fs.readFileSync(fs.existsSync(compiled)?compiled:path.join(root,`artifacts/${name}.json`),'utf8'));}
export const tokenAbi=[{type:'function',name:'balanceOf',inputs:[{name:'account',type:'address'}],outputs:[{type:'uint256'}],stateMutability:'view'},{type:'function',name:'approve',inputs:[{name:'spender',type:'address'},{name:'amount',type:'uint256'}],outputs:[{type:'bool'}],stateMutability:'nonpayable'},{type:'function',name:'authorizationState',inputs:[{type:'address'},{type:'bytes32'}],outputs:[{type:'bool'}],stateMutability:'view'}] as const;
