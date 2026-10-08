import {spawn} from 'node:child_process';import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomBytes,createHash} from 'node:crypto';import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'isolated-proof-'));const code=randomBytes(32).toString('hex'),port=33219,origin=`http://127.0.0.1:${port}`;let processHandle,cookie,csrf;const checks=[];
async function start(){processHandle=spawn(process.execPath,['server.mjs'],{cwd:new URL('.',import.meta.url),env:{...process.env,PORT:String(port),DATA_DIR:dir,PUBLIC_ORIGIN:origin,LOCAL_TEST:'1',TEST_OWNER_HASH:createHash('sha256').update(code).digest('hex')},stdio:['ignore','pipe','pipe']});await new Promise((ok,no)=>{const t=setTimeout(()=>no(Error('start timeout')),10000);processHandle.stdout.once('data',()=>{clearTimeout(t);ok();});processHandle.once('exit',x=>{clearTimeout(t);no(Error('early exit '+x));});});}
async function stop(){const proc=processHandle;await new Promise(r=>{proc.once('exit',r);proc.kill('SIGTERM');});processHandle=null;}
async function req(path,opts={}){const r=await fetch(origin+path,{...opts,headers:{...opts.headers},redirect:'manual'});return {status:r.status,headers:r.headers,bytes:Buffer.from(await r.arrayBuffer())};}
function post(data,auth=true,headers={}){return{method:'POST',headers:{origin,'content-type':'application/json',...(auth?{Cookie:cookie,'x-csrf-token':csrf}:{}),...headers},body:JSON.stringify(data)};}
async function check(name,path,opts,status){const r=await req(path,opts);assert.equal(r.status,status,name);assert.match(r.headers.get('cache-control'),/no-store/);checks.push(name);return r;}
try{await start();
const privateBytes=await readFile(join(dir,'private-fixture.png'));
await check('Anonymous original blocked','/api/assets/2/original',{},403);
for(const path of ['/private-fixture.png','/data/private-fixture.png','/sample-public.b64','/server.mjs','/state.sqlite','/assets/a3.jpg','/api/assets/3/original','/api/assets/2/original?download=1'])await check('No public route '+path,path,{},404);
await check('Fake owner cookie blocked','/api/assets/2/original',{headers:{Cookie:'unseen_test='+'a'.repeat(64)}},403);
await check('Unauthorised range blocked','/api/assets/2/original',{headers:{Range:'bytes=0-50'}},403);
await check('Unauthorised HEAD blocked','/api/assets/2/original',{method:'HEAD'},403);
await check('Wrong login origin denied','/api/login',post({code},false,{origin:'http://wrong.invalid'}),403);
await check('Incorrect login code denied','/api/login',post({code:'b'.repeat(64)},false),403);
let r=await check('Correct private test login succeeds','/api/login',post({code},false),200);cookie=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
r=await req('/api/state',{headers:{Cookie:cookie}});csrf=JSON.parse(r.bytes).csrf;
r=await check('Owner receives exact fresh private bytes','/api/assets/2/original',{headers:{Cookie:cookie}},200);assert.deepEqual(r.bytes,privateBytes);
await check('Visitor route ignores owner cookie','/api/visitor/assets/2/original',{headers:{Cookie:cookie}},403);
await check('Missing CSRF cannot reveal','/api/mode',post({id:'2',mode:'seen'},true,{'x-csrf-token':''}),403);
await check('Anonymous cannot reveal','/api/mode',post({id:'2',mode:'seen'},false),403);
await check('Owner sets BOTH','/api/mode',post({id:'2',mode:'both'}),200);
r=await check('Public BOTH returns exact private fixture','/api/visitor/assets/2/original',{},200);assert.deepEqual(r.bytes,privateBytes);
await stop();await start();
r=await check('Public permission survives process restart','/api/visitor/assets/2/original',{},200);assert.deepEqual(r.bytes,privateBytes);
r=await req('/api/state',{headers:{Cookie:cookie}});assert.equal(JSON.parse(r.bytes).owner,true);checks.push('Session survives restart');
await check('Owner restores UNSEEN','/api/mode',post({id:'2',mode:'unseen'}),200);
await check('Old public URL denied after hide','/api/visitor/assets/2/original',{headers:{'If-None-Match':'*'}},403);
await check('Owner enables collection lock','/api/mint-lock',post({locked:true}),200);
await check('Locked collection blocks owner original','/api/assets/2/original',{headers:{Cookie:cookie}},403);
await check('Locked collection blocks reveal change','/api/mode',post({id:'2',mode:'seen'}),403);
await stop();await start();await check('Collection lock survives restart','/api/assets/2/original',{headers:{Cookie:cookie}},403);
await check('Owner unlocks collection','/api/mint-lock',post({locked:false}),200);
await check('Owner sets SEEN','/api/mode',post({id:'2',mode:'seen'}),200);
await check('Public SEEN permitted','/api/assets/2/original',{},200);
await check('Restore UNSEEN for logout check','/api/mode',post({id:'2',mode:'unseen'}),200);
await check('Owner logout succeeds','/api/logout',post({}),200);
await check('Logged-out cookie cannot read original','/api/assets/2/original',{headers:{Cookie:cookie}},403);
const result={passed:checks.length,checks,scope:'Local real HTTP tests of hosted candidate, including two process restarts using persisted SQLite and a fresh generated PNG. Not a hosted proxy/CDN/browser or real-wallet test.'};await writeFile(new URL('./test-results.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{if(processHandle)await stop();await rm(dir,{recursive:true,force:true});}
