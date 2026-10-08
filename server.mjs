import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,existsSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {deflateSync} from 'node:zlib';
const directory=process.env.DATA_DIR||'/data';const origin=process.env.PUBLIC_ORIGIN;
const loginHash=process.env.TEST_OWNER_HASH;const local=process.env.LOCAL_TEST==='1';
if(!origin||!/^https:\/\//.test(origin)&&!local||!/^[a-f0-9]{64}$/.test(loginHash||''))throw Error('Required isolated test settings missing');
mkdirSync(directory,{recursive:true,mode:0o700});const db=new DatabaseSync(join(directory,'state.sqlite'));db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
db.exec(`CREATE TABLE IF NOT EXISTS modes(id TEXT PRIMARY KEY, mode TEXT NOT NULL);CREATE TABLE IF NOT EXISTS sessions(key TEXT PRIMARY KEY,csrf TEXT NOT NULL,expires INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY,count INTEGER,until INTEGER);CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT);`);
for(const id of ['1','2'])db.prepare('INSERT OR IGNORE INTO modes VALUES (?,?)').run(id,'unseen');db.prepare('INSERT OR IGNORE INTO settings VALUES (?,?)').run('mintLocked','0');
function crc32(b){let c=0xffffffff;for(const v of b){c^=v;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(t,b){const tag=Buffer.from(t),out=Buffer.alloc(b.length+12);out.writeUInt32BE(b.length);tag.copy(out,4);b.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([tag,b])),out.length-4);return out;}
function png(){const h=Buffer.alloc(13);h.writeUInt32BE(256,0);h.writeUInt32BE(256,4);h[8]=8;h[9]=2;const blocks=randomBytes(16*16*3),rows=[];for(let y=0;y<256;y++){const row=Buffer.alloc(769);for(let x=0;x<256;x++)blocks.copy(row,1+x*3,(Math.floor(y/16)*16+Math.floor(x/16))*3,(Math.floor(y/16)*16+Math.floor(x/16))*3+3);rows.push(row);}return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',h),chunk('IDAT',deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))]);}
const fixturePath=join(directory,'private-fixture.png');if(!existsSync(fixturePath))writeFileSync(fixturePath,png(),{mode:0o600});chmodSync(fixturePath,0o600);
// The art sample is previously public, included solely for visual testing. Fixture 2 is new private material.
const sample=Buffer.from(readFileSync(new URL('./sample-public.b64',import.meta.url),'utf8').trim(),'base64');const fixture=readFileSync(fixturePath);
const originals=new Map([['1',{bytes:sample,type:'image/jpeg'}],['2',{bytes:fixture,type:'image/png'}]]);
const publicFiles=new Map([['/',{bytes:readFileSync(new URL('./index.html',import.meta.url)),type:'text/html; charset=utf-8'}],['/app.js',{bytes:readFileSync(new URL('./app.js',import.meta.url)),type:'text/javascript'}],['/hologram.js',{bytes:readFileSync(new URL('./hologram.js',import.meta.url)),type:'text/javascript'}],['/style.css',{bytes:readFileSync(new URL('./style.css',import.meta.url)),type:'text/css'}]]);
const hash=x=>createHash('sha256').update(x).digest('hex');const lock=()=>db.prepare('SELECT value FROM settings WHERE key=?').get('mintLocked').value==='1';
const cookieName=local?'unseen_test':'__Host-unseen_test';
function session(req){const c=(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(cookieName+'='));if(c.length!==1)return null;const token=c[0].slice(cookieName.length+1);if(!/^[a-f0-9]{64}$/.test(token))return null;const s=db.prepare('SELECT * FROM sessions WHERE key=?').get(hash(token));return s&&s.expires>Date.now()?s:null;}
const noStore={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','Vary':'Cookie','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
function setCookie(token,seconds){return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${local?'':'; Secure'}`;}
function validCsrf(req,s){const a=Buffer.from(req.headers['x-csrf-token']||''),b=Buffer.from(s?.csrf||'');return !!s&&req.headers.origin===origin&&a.length===b.length&&timingSafeEqual(a,b);}
async function body(req){let n=0;const chunks=[];for await(const c of req){n+=c.length;if(n>2048)throw Error('body');chunks.push(c);}return JSON.parse(Buffer.concat(chunks).toString());}
const server=http.createServer(async(req,res)=>{
 const send=(status,value,type='application/json',extra={})=>{const bytes=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value));res.writeHead(status,{...noStore,'Content-Type':type,'Content-Length':bytes.length,...extra});res.end(req.method==='HEAD'?undefined:bytes);};
 try{
  const path=req.url||'';const read=['GET','HEAD'].includes(req.method);
  if(read&&publicFiles.has(path)){const f=publicFiles.get(path);return send(200,f.bytes,f.type);}
  if(read&&path==='/health')return send(200,{ok:true,build:'isolated-viewer-v1'});
  if(path==='/api/login'&&req.method==='POST'){
   if(req.headers.origin!==origin)return send(403,{error:'Not permitted'});
   // Strong random access code; no owner password, website credential or wallet is reused.
   const k=hash(req.socket.remoteAddress||'proxy');let at=db.prepare('SELECT * FROM attempts WHERE key=?').get(k);if(at&&at.until>Date.now()&&at.count>=20)return send(429,{error:'Too many attempts. Try later.'});
   const input=await body(req);const token=typeof input.code==='string'?input.code:'';const match=/^[a-f0-9]{64}$/.test(token)&&timingSafeEqual(Buffer.from(hash(token),'hex'),Buffer.from(loginHash,'hex'));
   if(!match){const count=at&&at.until>Date.now()?at.count+1:1;db.prepare('INSERT OR REPLACE INTO attempts VALUES (?,?,?)').run(k,count,Date.now()+15*60*1000);return send(403,{error:'Access code not accepted'});}
   db.prepare('DELETE FROM attempts WHERE key=?').run(k);db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());const tokenOut=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(hash(tokenOut),csrf,Date.now()+12*60*60*1000);
   return send(200,{ok:true},'application/json',{'Set-Cookie':setCookie(tokenOut,43200)});
  }
  const s=session(req);
  if(path==='/api/logout'&&req.method==='POST'){if(!validCsrf(req,s))return send(403,{error:'Not permitted'});db.prepare('DELETE FROM sessions WHERE key=?').run(s.key);return send(200,{ok:true},'application/json',{'Set-Cookie':setCookie('',0)});}
  if(read&&(path==='/api/state'||path==='/api/visitor/state')){const visitor=path.includes('/visitor/');return send(200,{owner:!visitor&&!!s,csrf:!visitor&&s?s.csrf:null,mintLocked:lock(),assets:db.prepare('SELECT id,mode FROM modes ORDER BY id').all().map(a=>({id:a.id,mode:lock()?'unseen':a.mode,originalAvailable:!lock()&&(a.mode!=='unseen'||!visitor&&!!s)}))});}
  const match=/^\/api\/(visitor\/)?assets\/([12])\/original$/.exec(path);
  if(match&&read){const [,visitor,id]=match;const mode=db.prepare('SELECT mode FROM modes WHERE id=?').get(id).mode;if(lock()||mode==='unseen'&&(visitor||!s))return send(403,{error:'Original unavailable in UNSEEN'});const f=originals.get(id);return send(200,f.bytes,f.type);}
  if(path==='/api/mode'&&req.method==='POST'){
   if(!validCsrf(req,s)||lock())return send(403,{error:'Not permitted'});const v=await body(req);if(!['1','2'].includes(v.id)||!['unseen','seen','both'].includes(v.mode)||Object.keys(v).some(k=>!['id','mode'].includes(k)))return send(400,{error:'Invalid choice'});
   db.prepare('UPDATE modes SET mode=? WHERE id=?').run(v.mode,v.id);return send(200,{ok:true});
  }
  if(path==='/api/mint-lock'&&req.method==='POST'){
   if(!validCsrf(req,s))return send(403,{error:'Not permitted'});const v=await body(req);if(typeof v.locked!=='boolean')return send(400,{error:'Invalid choice'});db.prepare('UPDATE settings SET value=? WHERE key=?').run(v.locked?'1':'0','mintLocked');return send(200,{ok:true});
  }
  return send(404,{error:'Not found'});
 }catch{return send(400,{error:'Request failed'});}
});
server.requestTimeout=15000;server.headersTimeout=10000;server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Isolated viewer ready; private storage initialized.'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0);}));
