import fs from 'node:fs';
import {verifyResponse} from '../server/agent.ts';
const file=process.argv[2];if(!file)throw new Error('Usage: npm run submit-response -- response.json (read-only on-chain proof validation)');
const x=JSON.parse(fs.readFileSync(file,'utf8'));console.log(await verifyResponse(x.response||x));
