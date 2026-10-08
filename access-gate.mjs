// Laboratory model only. The injected authority is NOT a Zcash verifier.
import {randomBytes,createHash,verify,createPublicKey} from 'node:crypto';
const digest=x=>createHash('sha256').update(x).digest('hex');
export class AccessGate {
  #authority; #clock; #origin; #challenges=new Map(); #sessions=new Map(); #policies=new Map();
  constructor({authority,origin,clock=Date.now}){this.#authority=authority;this.#clock=clock;this.#origin=origin;}
  #current(asset){const a=this.#authority.current(asset);if(!a||a.status!=='confirmed'||!a.owner||!a.revision||a.checkedAt>this.#clock()||this.#clock()-a.checkedAt>10000)throw Error('Ownership unavailable');return a;}
  challenge(asset,publicKey){const key=createPublicKey(publicKey).export({type:'spki',format:'der'});const principal=digest(key),a=this.#current(asset);if(a.owner!==principal)throw Error('Not owner');const nonce=randomBytes(32).toString('hex'),expires=this.#clock()+60000;const message=JSON.stringify({purpose:'unseen-laboratory-login',origin:this.#origin,asset,principal,revision:a.revision,nonce,expires});this.#challenges.set(nonce,{asset,principal,revision:a.revision,publicKey,message,expires});return {nonce,message};}
  login(nonce,signature){const c=this.#challenges.get(nonce);this.#challenges.delete(nonce);if(!c||c.expires<=this.#clock()||!verify(null,Buffer.from(c.message),c.publicKey,signature))throw Error('Invalid challenge');const a=this.#current(c.asset);if(a.owner!==c.principal||a.revision!==c.revision)throw Error('Ownership changed');const token=randomBytes(32).toString('hex');this.#sessions.set(digest(token),{asset:c.asset,principal:c.principal,revision:c.revision,expires:this.#clock()+300000});return token;}
  #owner(asset,token,a){const s=this.#sessions.get(digest(token||''));return !!s&&s.asset===asset&&s.principal===a.owner&&s.revision===a.revision&&s.expires>this.#clock();}
  // Calling code must perform this check for EVERY new protected response.
  originalAllowed(asset,token){try{const a=this.#current(asset);return this.#owner(asset,token,a)||this.publicReveal(asset,a);}catch{return false;}}
  publicReveal(asset,a=this.#current(asset)){const p=this.#policies.get(asset);return !!p&&p.revision===a.revision&&p.reveal===true;}
  setReveal(asset,token,reveal){const a=this.#current(asset);if(!this.#owner(asset,token,a)||typeof reveal!=='boolean')throw Error('Not owner');this.#policies.set(asset,{revision:a.revision,reveal});}
  logout(token){this.#sessions.delete(digest(token));}
}
export const principalFor=publicKey=>digest(createPublicKey(publicKey).export({type:'spki',format:'der'}));
