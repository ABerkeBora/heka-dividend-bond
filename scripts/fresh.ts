import fs from 'node:fs';
import path from 'node:path';
import {withLock} from '../server/lock.ts';
import {read,write,root,now} from '../server/store.ts';
import {chainState} from '../server/agent.ts';
import {deployScenario} from './deploy.ts';
const id=process.argv[2];if(!id||!/^[a-z0-9-]{1,40}$/.test(id))throw new Error('Usage: npm run fresh -- bond-02 (new scenario identifier)');
await withLock('workflow',async()=>{
 const current=await chainState();if(current.deployment?.id===id)throw new Error('Choose a new scenario identifier');
 if(current.agreement&&!['Claimed','Void'].includes(current.agreement.status))throw new Error('Current obligation is still active; cannot hide protected reserve');
 if(current.deployment){
  const archive=`evidence/scenarios/${current.deployment.id}`;fs.mkdirSync(path.join(root,archive),{recursive:true});
  for(const file of ['deployment.json','request-manifest.json','collection.json','tamper-live.json','tamper-live-timely.json','acceptance.json']){const data=read(`evidence/${file}`);if(data)write(`${archive}/${file}`,data);}
 }
 write('.local/fresh-progress.json',{id,startedAt:now(),previous:current.deployment?.id});
 const next=await deployScenario(id);
 const old=read('.local/journal.json');if(old){write(`.local/journals/${old.mandateId}.json`,old);fs.unlinkSync(path.join(root,'.local/journal.json'));}
 // The old collection remains archived, never masquerades as this new obligation's receipt.
 for(const file of ['collection.json','tamper-live.json','tamper-live-timely.json','acceptance.json']){const f=path.join(root,'evidence',file);if(fs.existsSync(f))fs.unlinkSync(f);}
 write('.local/fresh-progress.json',{id,status:'ready',finishedAt:now()});
 console.log(JSON.stringify({id,address:next.contractAddress,status:'Funded; ready for a new initial mandate',history:'evidence/scenarios/'},null,2));
});
