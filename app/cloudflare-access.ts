export function accessIssuer(domain:unknown){if(typeof domain!=='string')return null;try{const u=new URL(domain.startsWith('https://')?domain:'https://'+domain);return u.protocol==='https:'&&/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(u.hostname)&&!u.port&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash?u.origin:null}catch{return null}}
const decode=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
type Key=JsonWebKey&{kid?:string};
export async function verifyAccessToken(token:string|null,issuer:string,audience:string,keys:Key[],now=Math.floor(Date.now()/1000)){
 try{
  if(!token||token.length>20000||!accessIssuer(issuer)||!audience)return null;
  const parts=token.split('.');if(parts.length!==3)return null;
  const header=JSON.parse(new TextDecoder().decode(decode(parts[0]))),claims=JSON.parse(new TextDecoder().decode(decode(parts[1])));
  if(header.alg!=='RS256'||typeof header.kid!=='string'||header.crit)return null;
  if(claims.iss!==issuer||!(Array.isArray(claims.aud)?claims.aud.includes(audience):claims.aud===audience)||!Number.isFinite(claims.exp)||claims.exp<=now||(claims.nbf!==undefined&&(!Number.isFinite(claims.nbf)||claims.nbf>now))||(claims.iat!==undefined&&(!Number.isFinite(claims.iat)||claims.iat>now+60)))return null;
  if(typeof claims.sub!=='string'||!claims.sub||typeof claims.email!=='string'||!/^\S+@\S+\.\S+$/.test(claims.email))return null;
  const jwk=keys.find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256')&&(!k.use||k.use==='sig'));if(!jwk)return null;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))return null;
  const email=claims.email.trim().toLowerCase();return {userId:claims.sub,email,displayName:typeof claims.name==='string'&&claims.name?claims.name:email,fullName:typeof claims.name==='string'?claims.name:null};
 }catch{return null}
}
let cached:{issuer:string;expires:number;keys:Key[]}|null=null;
export async function accessIdentity(token:string|null,domain:unknown,aud:unknown){const issuer=accessIssuer(domain);if(!token||!issuer||typeof aud!=='string'||!aud.trim())return null;try{if(!cached||cached.issuer!==issuer||cached.expires<Date.now()){const r=await fetch(issuer+'/cdn-cgi/access/certs',{signal:AbortSignal.timeout(8000),redirect:'error'});if(!r.ok)return null;const j:any=await r.json();if(!Array.isArray(j.keys))return null;cached={issuer,expires:Date.now()+60000,keys:j.keys}}return await verifyAccessToken(token,issuer,aud,cached.keys)}catch{return null}}
