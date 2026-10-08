import {createServer} from 'node:http';
import {createHash, timingSafeEqual} from 'node:crypto';

// Feasibility harness only. Trusted adapters must be supplied by the application.
// No public login, mint unlock or session-creation endpoint exists here.
export const sessionKey = token => createHash('sha256').update(token).digest('hex');
export function createGate({origin, assets, sessions, project, readOriginal, now=Date.now}) {
  function session(req) {
    const cookies=(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith('__Host-unseen_session='));
    if(cookies.length!==1)return null;
    const token=cookies[0].slice('__Host-unseen_session='.length);
    if(!/^[a-f0-9]{64}$/.test(token))return null;
    const s=sessions.get(sessionKey(token));
    return s && !s.revoked && s.expires>now() ? s : null;
  }
  const canRead=(req,a)=>!project.mintLocked && (a.mode==='seen'||a.mode==='both'||session(req)?.subject===a.owner);
  const headers={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','Vary':'Cookie','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; sandbox"};
  return createServer(async(req,res)=>{
    const send=(code,value,type='application/json')=>{
      if(res.destroyed)return;
      const body=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value));
      res.writeHead(code,{...headers,'Content-Type':type,'Content-Length':body.length});res.end(req.method==='HEAD'?undefined:body);
    };
    try {
      // Match raw paths strictly; do not normalize attacker input into filesystem paths.
      const raw=req.url||'';
      const match=/^\/api\/assets\/([1-9][0-9]{0,8})\/(metadata|original|visibility)$/.exec(raw);
      if(!match)return send(404,{error:'Not found'});
      const [,id,action]=match;const a=assets.get(id);
      if(!a)return send(404,{error:'Not found'});
      if(action==='metadata'){
        if(!['GET','HEAD'].includes(req.method))return send(405,{error:'Method not allowed'});
        const mode=project.mintLocked?'unseen':a.mode;
        return send(200,{id,mode,originalAvailable:mode!=='unseen'});
      }
      if(action==='original'){
        if(!['GET','HEAD'].includes(req.method))return send(405,{error:'Method not allowed'});
        if(!canRead(req,a))return send(403,{error:'Original unavailable'});
        // Server registry chooses the storage key; no URL or client filename is accepted.
        const bytes=await readOriginal(a.storageKey);
        // Recheck after I/O so revocation during the read does not release bytes.
        const current=assets.get(id);
        if(!current||current.storageKey!==a.storageKey||!canRead(req,current))return send(403,{error:'Original unavailable'});
        return send(200,bytes,'image/png');
      }
      if(req.method!=='POST')return send(405,{error:'Method not allowed'});
      const s=session(req);
      if(project.mintLocked||!s||s.subject!==a.owner)return send(403,{error:'Not permitted'});
      const csrf=Buffer.from(String(req.headers['x-csrf-token']||''));const expected=Buffer.from(s.csrf);
      if(req.headers.origin!==origin||csrf.length!==expected.length||!timingSafeEqual(csrf,expected))return send(403,{error:'Not permitted'});
      let size=0;const chunks=[];
      for await(const c of req){size+=c.length;if(size>1024)return send(413,{error:'Request too large'});chunks.push(c);}
      let data;try{data=JSON.parse(Buffer.concat(chunks).toString());}catch{return send(400,{error:'Invalid request'});}
      if(!data||!['unseen','seen','both'].includes(data.mode)||Object.keys(data).some(k=>k!=='mode'))return send(400,{error:'Invalid request'});
      // Recheck ownership/session after receiving the body.
      if(project.mintLocked||assets.get(id)!==a||session(req)!==s||s.subject!==a.owner)return send(403,{error:'Not permitted'});
      a.mode=data.mode;return send(200,{id,mode:a.mode});
    }catch{send(500,{error:'Request failed'});}
  });
}
