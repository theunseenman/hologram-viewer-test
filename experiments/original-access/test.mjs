import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import http from 'node:http';
import {deflateSync} from 'node:zlib';
import {createGate,sessionKey} from './gate.mjs';
// New random PNG fixtures per run, created outside the repository/public tree.
function crc32(b){let c=0xffffffff;for(const v of b){c^=v;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,b){const t=Buffer.from(type),out=Buffer.alloc(b.length+12);out.writeUInt32BE(b.length);t.copy(out,4);b.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([t,b])),out.length-4);return out;}
function fixture(){const h=Buffer.alloc(13);h.writeUInt32BE(64,0);h.writeUInt32BE(64,4);h[8]=8;h[9]=2;const rows=[];for(let y=0;y<64;y++)rows.push(Buffer.concat([Buffer.from([0]),randomBytes(64*3)]));return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',h),chunk('IDAT',deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))]);}
const dir=await mkdtemp(join(tmpdir(),'unseen-private-'));const one=fixture(),two=fixture();await writeFile(join(dir,'one.png'),one,{mode:0o600});await writeFile(join(dir,'two.png'),two,{mode:0o600});
const assets=new Map([['1',{owner:'alice',mode:'unseen',storageKey:'one'}],['2',{owner:'bob',mode:'unseen',storageKey:'two'}]]);const sessions=new Map();let clock=1000;
function login(subject,expires=10000){const token=randomBytes(32).toString('hex'),s={subject,expires,revoked:false,csrf:randomBytes(32).toString('hex')};sessions.set(sessionKey(token),s);return {s,cookie:`__Host-unseen_session=${token}`};}
const alice=login('alice'),bob=login('bob'),expired=login('alice',999),revoked=login('alice');revoked.s.revoked=true;const project={mintLocked:false};let reads=0,afterRead=null;
const origin='https://example.invalid';const server=createGate({origin,assets,sessions,project,now:()=>clock,readOriginal:async key=>{reads++;assert(['one','two'].includes(key));const b=await readFile(join(dir,key+'.png'));if(afterRead){const f=afterRead;afterRead=null;f();}return b;}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;const checks=[];
function request(path,{method='GET',cookie,headers={},body}={}){return new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port,path,method,headers:{...(cookie?{Cookie:cookie}:{}),...headers}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});req.on('error',reject);req.end(body);});}
async function check(name,path,options,status,original){const r=await request(path,options);assert.equal(r.status,status,name);assert.match(r.headers['cache-control'],/no-store/);assert.equal(r.headers['access-control-allow-origin'],undefined);if(original)assert.deepEqual(r.body,original,name);else assert(!r.body.includes(one)&&!r.body.includes(two),name);checks.push(name);return r;}
const route='/api/assets/1/original';const change=(mode,who=alice,extra={})=>({method:'POST',cookie:who.cookie,headers:{origin,'x-csrf-token':who.s.csrf,...extra},body:JSON.stringify({mode})});
try{
 await check('UNSEEN anonymous direct route blocked',route,{},403);
 await check('UNSEEN other owner blocked',route,{cookie:bob.cookie},403);
 await check('Token ID substitution blocked','/api/assets/2/original',{cookie:alice.cookie},403);
 await check('Forged owner header ignored',route,{headers:{'x-user-id':'alice','x-owner':'alice'}},403);
 await check('Invented session rejected',route,{cookie:'__Host-unseen_session='+'a'.repeat(64)},403);
 await check('Expired session rejected',route,{cookie:expired.cookie},403);
 await check('Revoked session rejected',route,{cookie:revoked.cookie},403);
 await check('Duplicate session cookies rejected',route,{cookie:alice.cookie+'; '+bob.cookie},403);
 await check('HEAD unauthorised blocked',route,{method:'HEAD'},403);
 await check('Range unauthorised blocked',route,{headers:{Range:'bytes=0-100'}},403);
 await check('Conditional headers do not bypass gate',route,{headers:{'If-None-Match':'*','If-Modified-Since':new Date().toUTCString()}},403);
 assert.equal(reads,0,'denied original requests never read storage');
 for(const path of ['/assets/one.png','/originals/one.png','/private/one.png','/one.png','/api/assets/1/thumbnail','/api/assets/1/original?download=1','/api/assets/1/../2/original','/api/assets/%31/original','/api/assets/1%2foriginal','/api/assets/1/original/','/api/assets/999/original','/go-live','/trigger'])await check('No alternate route: '+path,path,{},404);
 const meta=await check('UNSEEN metadata contains no original locator','/api/assets/1/metadata',{},200);assert.deepEqual(JSON.parse(meta.body),{id:'1',mode:'unseen',originalAvailable:false});assert(!meta.body.toString().includes(dir));
 await check('Authorised owner receives exact original',route,{cookie:alice.cookie},200,one);
 await check('Owner access does not reveal to public',route,{},403);
 await check('Anonymous policy change denied','/api/assets/1/visibility',{method:'POST',body:'{"mode":"seen"}'},403);
 await check('Other owner policy change denied','/api/assets/1/visibility',change('seen',bob),403);
 await check('Cross-origin policy change denied','/api/assets/1/visibility',change('seen',alice,{origin:'https://attacker.invalid'}),403);
 await check('Missing CSRF rejected','/api/assets/1/visibility',change('seen',alice,{'x-csrf-token':''}),403);
 await check('Owner enables SEEN','/api/assets/1/visibility',change('seen'),200);
 await check('SEEN public exact original available',route,{},200,one);
 await check('Shared original URL works only while public',route,{cookie:bob.cookie},200,one);
 await check('Owner restores UNSEEN','/api/assets/1/visibility',change('unseen'),200);
 await check('Same URL denied after hiding',route,{},403);
 await check('Conditional request denied after hiding',route,{headers:{'If-None-Match':'*'}},403);
 await check('Owner enables BOTH','/api/assets/1/visibility',change('both'),200);
 await check('BOTH permits original download',route,{},200,one);
 project.mintLocked=true;
 await check('Mint lock overrides public mode',route,{},403);
 await check('Mint lock blocks owner original access',route,{cookie:alice.cookie},403);
 await check('Mint lock prevents owner disclosure','/api/assets/1/visibility',change('seen'),403);
 project.mintLocked=false;assets.get('1').mode='unseen';assets.get('1').owner='bob';
 await check('Transfer removes former owner access',route,{cookie:alice.cookie},403);
 await check('Former owner cannot reveal after transfer','/api/assets/1/visibility',change('seen'),403);
 await check('New owner receives original',route,{cookie:bob.cookie},200,one);
 afterRead=()=>{assets.get('1').owner='alice';};
 await check('Ownership change during storage read blocks response',route,{cookie:bob.cookie},403);
 afterRead=()=>{assets.set('1',{...assets.get('1'),owner:'bob'});};
 await check('Replacement ownership record during read blocks old owner',route,{cookie:alice.cookie},403);
 assets.get('1').owner='alice';
 afterRead=()=>{alice.s.revoked=true;};
 await check('Session revocation during storage read blocks response',route,{cookie:alice.cookie},403);
 console.log(JSON.stringify({passed:checks.length,checks,scope:'Loopback HTTP integration test of isolated prototype. Synthetic session and ownership adapters. Fresh random PNG fixtures never hosted publicly; deleted after run. No real wallet, chain, CDN, object-store ACL, durable database or production deployment tested.'},null,2));
}finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
