import dotenv from 'dotenv';
import { deriveRequestHash } from './vendor/airnode-v2.ts';
import type { Address } from 'viem';
export const runtimeScope=process.env.DIVIDEND_SCOPE==='v2'?'v2':'v1';
export const runtimeRole=runtimeScope==='v2'?'collector':'deployer';
// The restricted collector process must never load the parent .env containing issuer wallet paths.
if(runtimeScope==='v1')dotenv.config({quiet:true});
export const sourceUrl = 'https://airnode-eodhd.fly.dev/';
export const signer: Address = '0xDaF9D3493e556e9f25b34A3c366795F81e90c6fe';
export const payee: Address = '0x1505FD562AC2Fb4307B85BC6c672FfeafB4d57A7';
export const asset: Address = '0xbeA34973e5f67F18F656A2C6070C64326C791808';
export const request = {operation:'dividendHistory',parameters:{ticker:'AAPL.US',from:'2025-08-11',to:'2025-08-11'},responseProjection:{eventDate:'/0/date',recordDate:'/0/recordDate',paymentDate:'/0/paymentDate',declaredDividend:'/0/unadjustedValue',currency:'/0/currency'}};
export const requestHash = deriveRequestHash(request);
// Technical discovery is a fixed, CLI-only recipe. It never changes the deployed product request.
export const discoveryRequest = {operation:'dividendHistory',parameters:{ticker:'AAPL.US',from:'2025-08-11',to:'2025-08-11'}};
export const discoveryRequestHash = deriveRequestHash(discoveryRequest);
export const discoveryPurpose = 'Verify exact historical query cardinality and raw event fields before funding a new obligation';
export const policy = {dataBudgetAtoms:'50000',perCallCapAtoms:'10000',gasBudgetWei:'200000000000000',maxActions:2,maxClaims:1,expirySeconds:1800,payee,asset,sourceUrl,requestHash,signer,network:'eip155:84532',enforcement:'Application guards and isolated funded wallet; payout recipient, proof and one-claim rule enforced on-chain'};
export const rpcUrl = process.env.RPC_URL || 'https://sepolia.base.org';
