import express from 'express';
import path from 'node:path';
import {createServer as createViteServer} from 'vite';
import {getState,authorize,runAgent,verifyResponse} from './agent.ts';
import {root,read,safeError} from './store.ts';
const app=express();app.disable('x-powered-by');app.use(express.json({limit:'64kb'}));
app.use('/api',(req,res,next)=>{res.setHeader('Cache-Control','no-store');const host=req.headers.host;if(host!==`127.0.0.1:${process.env.PORT||3103}`&&host!==`localhost:${process.env.PORT||3103}`)return res.status(403).json({error:'Local host required'});if(req.method==='POST'&&req.headers.origin&&!['http://localhost:3103','http://127.0.0.1:3103'].includes(req.headers.origin))return res.status(403).json({error:'Same-origin local action required'});next();});
const route=(fn:any)=>async(req:any,res:any)=>{try{res.json(await fn(req));}catch(e){res.status(400).json({error:safeError(e)});}};
app.get('/api/state',route(getState));
app.get('/api/evidence',route(()=>({deployment:read('evidence/deployment.json'),manifest:read('evidence/request-manifest.json'),preflight:read('evidence/preflight.json'),response:read('.local/journal.json')?.response||read('evidence/preflight.json')?.response,tamper:read('evidence/tamper-live.json')})));
let running=false;function launch(){if(running)return;running=true;runAgent().catch(e=>console.error(safeError(e))).finally(()=>{running=false;});}
app.post('/api/authorize',route(async()=>{const j=await authorize();launch();return j;}));
app.post('/api/run',route(async()=>{if(!read('.local/journal.json')&&!read('evidence/collection.json'))throw new Error('Authorize first');launch();return {status:'Reconciliation started'};}));
app.post('/api/verify',route(async(req:any)=>{try{return await verifyResponse(req.body.response);}catch(e){return {valid:false,message:safeError(e)};}}));
if(process.env.NODE_ENV==='production'){app.use(express.static(path.join(root,'dist')));}else{const vite=await createViteServer({configFile:path.join(root,'vite.config.ts'),server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}
app.listen(Number(process.env.PORT||3103),'127.0.0.1',()=>console.log('Dividend Bond ready at http://localhost:3103'));
