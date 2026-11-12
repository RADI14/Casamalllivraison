import {createHash} from 'node:crypto';
import {getSqlite} from '../../../../server/sqlite';
import {secret,storeId,verifyYoucan,seal,youcanRequest,connection,activateYoucan} from '../../../../server/youcan';
const reply=(message:string,status=400)=>new Response(message,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Type':'text/plain; charset=utf-8'}});
export async function GET(req:Request){
 if(!secret()||!process.env.YOUCAN_CLIENT_ID||!storeId())return reply('Configuration YouCan en attente dans Fastlivraison.',503);
 const u=new URL(req.url),p=new URLSearchParams(u.search),signature=p.get('hmac')??'';p.delete('hmac');
 const timestamp=Number(p.get('timestamp')),code=p.get('code');
 if((code&&code.length>3000)||!Number.isFinite(timestamp)||Math.abs(Date.now()-timestamp*1000)>300000||!verifyYoucan(p.toString(),signature,secret()))return reply('Lien YouCan invalide ou expiré.',403);
 const db=getSqlite().connection;
 if(!code){try{await activateYoucan(connection(db));return reply('YouCan connecté. Réception automatique des commandes activée. Retrouvez-les dans Fastlivraison → Commandes site.',200)}catch{return reply('Ouvrez de nouveau la connexion YouCan pour activer la réception des commandes.',502)}}
 const digest=createHash('sha256').update(code).digest('hex');
 if(db.prepare('INSERT OR IGNORE INTO youcan_launches VALUES(?,?)').run(digest,Date.now()).changes===0)return reply('Lien déjà utilisé. Ouvrez de nouveau l’application depuis YouCan.',409);
 db.prepare('DELETE FROM youcan_launches WHERE created_at<?').run(Date.now()-86400000);
 try{
 const response=await fetch('https://api.youcan.shop/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:new URLSearchParams({grant_type:'authorization_code',client_id:process.env.YOUCAN_CLIENT_ID!,client_secret:secret(),redirect_uri:process.env.YOUCAN_REDIRECT_URI||'https://fastlivraison.com/api/youcan/callback',code}),signal:AbortSignal.timeout(12000)});
 const body:any=await response.json(),token=body?.data??body;if(!response.ok||typeof token?.access_token!=='string'){
 const known=['invalid_request','invalid_client','invalid_grant','unauthorized_client','unsupported_grant_type','invalid_scope'];
 const detail=String(body?.error_description??body?.message??'');
 console.error('YouCan token exchange rejected',{status:response.status,error:known.includes(body?.error)?body.error:'unrecognized_response',parameter:['redirect_uri','client_id','client_secret','grant_type','code'].find(k=>detail.includes(k))??'unknown'});
 return reply('Autorisation YouCan refusée. Relancez la connexion.',502);
 }
 const me=await youcanRequest(token.access_token,'/me'),store=me.data??me;
 if((store.store_id??store.id)!==storeId())return reply('Ce magasin n’est pas autorisé pour cette plateforme.',403);
 db.prepare('INSERT INTO youcan_connections VALUES(?,?,?,?) ON CONFLICT(store_id) DO UPDATE SET token_cipher=excluded.token_cipher,connected_at=excluded.connected_at,expires_at=excluded.expires_at').run(storeId(),seal(token.access_token,secret()),new Date().toISOString(),Date.now()+Math.min(Number(token.expires_in)||86400,31536000)*1000);
 try{await activateYoucan(token.access_token)}catch{return reply('YouCan connecté. Activation des notifications en attente : ouvrez Commandes site pour réessayer.',502)}
 return reply('YouCan connecté. Réception automatique des commandes activée. Les colis seront transmis à Atlas uniquement après confirmation.',200);
 }catch{return reply('Connexion YouCan temporairement indisponible. Réessayez depuis YouCan.',502)}
}
