import {eq,and,sql} from 'drizzle-orm';
import {getDb} from '../db';
import {orders} from '../db/schema';
import {getSqlite} from './sqlite';
import {env} from './runtime';
import {canAccessOrder} from '../app/rules';
import {atlasError} from '../app/atlas-request';
import {atlasOrderSnapshot} from '../app/atlas-order-sync';
import {parcelMessages,parcelHistory,parcelAction} from '../app/atlas-feed-rules';
import {cents} from '../app/finance-rules';
type Cached={body:any;at:string;until:number};
const cache=new Map<string,Cached>(),pending=new Map<string,Promise<Cached>>();let cooldown=0;
const out=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const base='https://api.atlaslivraison.com/api/external';
class CarrierRefusal extends Error{}
async function carrier(key:string,path:string,body?:any){
 if(cooldown>Date.now())throw Error('Atlas limite temporairement les requêtes. Réessayez dans une minute.');
 const r=await fetch(base+path,{method:body?'POST':'GET',cache:'no-store',headers:{'x-api-key':key,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(body?20000:12000)});
 if(r.status===429){const retry=Number(r.headers.get('Retry-After'));cooldown=Date.now()+Math.min(300,Math.max(30,Number.isFinite(retry)?retry:60))*1000}
 const j:any=await r.json().catch(()=>null);if(!r.ok||j?.success!==true)throw new CarrierRefusal(atlasError(r.status,j,key));return j;
}
async function read(key:string,path:string,ttl=10000){const old=cache.get(path);if(old&&old.until>Date.now())return old;const active=pending.get(path);if(active)return active;const task=(async()=>{const body=await carrier(key,path);const entry={body,at:new Date().toISOString(),until:Date.now()+ttl};if(cache.size>500)cache.delete(cache.keys().next().value!);cache.set(path,entry);return entry})();pending.set(path,task);try{return await task}finally{pending.delete(path)}}
function invalidate(code:string){const prefix='/colis/'+encodeURIComponent(code);for(const path of cache.keys())if(path===prefix||path.startsWith(prefix+'/'))cache.delete(path)}
async function accessible(id:unknown,user:any){if(typeof id!=='string'||id.length>200)return null;const [o]=await getDb().select().from(orders).where(eq(orders.id,id));return o&&canAccessOrder(user,o)?o:null}
function detailData(j:any,code:string){if(j?.data?.code!==code||!Number.isInteger(j.data.stateId))throw Error('Détail Atlas invalide.');return j.data}
async function storeDetail(o:any,remote:any,lockToken='',clearFee=false){const db=getDb(),snapshot=atlasOrderSnapshot(JSON.parse(o.payload),remote),now=new Date().toISOString(),payload=JSON.stringify(snapshot.payload),status=snapshot.cancelled?'cancelled':'sent';const fee=snapshot.transportCents!==null?snapshot.transportCents:clearFee?null:o.transportActualCents;const changed=payload!==o.payload||status!==o.status||remote.stateId!==o.atlasState||snapshot.stateName!==o.atlasStateName||fee!==o.transportActualCents;return db.update(orders).set({payload,status,...(snapshot.productChanged?{productId:null,unitCostCents:null}:{}),transportActualCents:fee,atlasState:remote.stateId,atlasStateName:snapshot.stateName,syncedAt:now,...(changed?{updatedAt:now}:{})}).where(and(eq(orders.id,o.id),eq(orders.updatedAt,o.updatedAt),eq(orders.payload,o.payload),sql`NOT EXISTS (SELECT 1 FROM order_edit_locks WHERE order_id=${o.id} AND expires_at>${Date.now()} AND token<>${lockToken})`)).returning({id:orders.id})}
export async function parcelFeed(req:Request,user:any){
 const q=new URL(req.url).searchParams,o=await accessible(q.get('id'),user);if(!o)return out({error:'Commande introuvable'},404);if(!o.tracking)return out({error:'Ce colis n’a pas encore de code Atlas.'},409);
 const page=q.get('page');if(page!==null&&(!/^\d+$/.test(page)||Number(page)<1||Number(page)>10000))return out({error:'Page invalide.'},400);
 const key=env.ATLAS_API_KEY;if(!key)return out({error:'API Atlas non configurée.'},409);const path='/colis/'+encodeURIComponent(o.tracking),errors:Record<string,string>={};
 const [detail,messages,history]=await Promise.allSettled([
  (async()=>{const entry=await read(key,path);const remote=detailData(entry.body,o.tracking!);const lock=getSqlite().connection.prepare('SELECT 1 FROM order_edit_locks WHERE order_id=? AND expires_at>?').get(o.id,Date.now());if(!lock)await storeDetail(o,remote);const price=cents(remote.price);return {data:{code:remote.code,stateId:remote.stateId,stateName:typeof remote.stateName==='string'?remote.stateName.slice(0,160):'',price:price===null?null:price/100,scheduledDate:typeof remote.scheduledDate==='string'&&!Number.isNaN(Date.parse(remote.scheduledDate))?remote.scheduledDate:null},at:entry.at}})(),
  (async()=>{const head=await read(key,path+'/messages?page=1&limit=50');if(!Array.isArray(head.body.data))throw Error('Messages Atlas invalides.');const pages=head.body.pagination?.totalPages;if(!Number.isInteger(pages)||pages<0||pages>10000)throw Error('Pagination Atlas invalide.');const last=Math.max(1,pages),tail=last===1?head:await read(key,path+'/messages?page='+last+'&limit=50');const firstItems=parcelMessages(head.body.data),lastItems=parcelMessages(tail.body.data);const newest=(list:ReturnType<typeof parcelMessages>)=>list.at(-1)?.createdAt??'';const ascending=last>1&&newest(lastItems)>newest(firstItems),latestPage=ascending?last:1,selected=page?Number(page):latestPage;if(selected>last)throw Error('Cette page n’existe plus. Revenez aux derniers messages.');const entry=selected===1?head:selected===last?tail:await read(key,path+'/messages?page='+selected+'&limit=50');return {items:parcelMessages(entry.body.data),page:selected,totalPages:last,latestPage,olderPage:ascending?(selected>1?selected-1:null):(selected<last?selected+1:null),newerPage:ascending?(selected<last?selected+1:null):(selected>1?selected-1:null),at:entry.at}})(),
  (async()=>{const entry=await read(key,path+'/history',60000);return {items:parcelHistory(entry.body.data),at:entry.at}})()
 ]);
 const result:any={errors,pollSeconds:15};for(const [name,value] of [['detail',detail],['messages',messages],['history',history]] as const){if(value.status==='fulfilled')result[name]=value.value;else errors[name]=value.reason instanceof Error?value.reason.message:'Atlas indisponible.'}
 return out(result,Object.keys(errors).length===3?502:200);
}
export async function performParcelAction(body:any,user:any){
 const o=await accessible(body?.id,user);if(!o)return out({error:'Commande introuvable'},404);if(!o.tracking||o.status!=='sent')return out({error:'Action indisponible pour ce colis.'},409);
 if(typeof body.requestId!=='string'||!(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i).test(body.requestId))return out({error:'Identifiant de requête invalide.'},400);
 let action:Record<string,any>;try{action=parcelAction(body.payload)}catch(e){return out({error:(e as Error).message},400)}
 if(action.action==='return_request'&&body.confirmed!==true)return out({error:'Confirmez la demande de retour et ses frais Atlas.'},400);
 const key=env.ATLAS_API_KEY;if(!key)return out({error:'API Atlas non configurée.'},409);
 const sqlite=getSqlite().connection,request=JSON.stringify(action),token=crypto.randomUUID();
 const prior=()=>sqlite.prepare('SELECT * FROM atlas_parcel_actions WHERE id=?').get(body.requestId) as any;
 const replay=(p:any)=>{if(p.order_id!==o.id||p.actor!==user.email||p.request_json!==request)return out({error:'Identifiant déjà utilisé.'},409);return p.status==='success'?out(JSON.parse(p.response_json)):out({error:'Cette action a déjà été tentée. Vérifiez le statut dans Atlas avant une nouvelle demande.',outcome:p.status},409)};
 const previous=prior();if(previous)return replay(previous);
 const lock=sqlite.prepare('INSERT INTO order_edit_locks(order_id,token,expires_at) VALUES(?,?,?) ON CONFLICT(order_id) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at WHERE order_edit_locks.expires_at<?').run(o.id,token,Date.now()+120000,Date.now());if(!lock.changes)return out({error:'Une opération est déjà en cours sur ce colis.'},409);
 let attempted=false,acknowledged=false;
 try{
  const duplicate=prior();if(duplicate)return replay(duplicate);
  invalidate(o.tracking);const path='/colis/'+encodeURIComponent(o.tracking),remote=detailData(await carrier(key,path),o.tracking);
  if(remote.stateId===1||remote.stateId===17)return out({error:'Ces actions concernent les colis en cours de livraison, hors Nouveau et Livré.'},409);
  if(remote.stateId!==body.expectedStateId)return out({error:'Le statut a changé dans Atlas. Actualisez avant de confirmer.'},409);
  let cityName:string|undefined;if(action.recipientCityId){const j=await read(key,'/cities',60000);if(!Array.isArray(j.body.data)||!j.body.data.some((c:any)=>c.id===action.recipientCityId))return out({error:'Ville Atlas invalide.'},400);cityName=j.body.data.find((c:any)=>c.id===action.recipientCityId).name}
  sqlite.prepare('INSERT INTO atlas_parcel_actions(id,order_id,actor,request_json,status,created_at) VALUES(?,?,?,?,?,?)').run(body.requestId,o.id,user.email,request,'processing',new Date().toISOString());attempted=true;
  const j=await carrier(key,path+'/action',action),data=detailData(j,o.tracking);acknowledged=true;
  sqlite.prepare("UPDATE atlas_parcel_actions SET status='success',response_json=? WHERE id=?").run(JSON.stringify({ok:true,stateId:data.stateId,stateName:typeof data.stateName==='string'?data.stateName:''}),body.requestId);
  let refreshed={...remote,...(action.recipientPhone?{phone:action.recipientPhone}:{}),...(action.recipientCityId?{cityId:action.recipientCityId,cityName,cfees:undefined}:{}),...data};try{refreshed={...refreshed,...detailData(await carrier(key,path),o.tracking)}}catch{}
  const [fresh]=await getDb().select().from(orders).where(eq(orders.id,o.id));if(fresh)await storeDetail(fresh,refreshed,token,!!action.recipientCityId);invalidate(o.tracking);
  return out({ok:true});
 }catch(e){if(!attempted)return out({error:e instanceof CarrierRefusal?e.message:'Atlas indisponible. Aucune action n’a été envoyée.',outcome:'not_sent'},502);const error=e instanceof CarrierRefusal?e.message:'Réponse Atlas incertaine. Vérifiez le statut avant de refaire cette action.';if(attempted&&!acknowledged)sqlite.prepare('UPDATE atlas_parcel_actions SET status=?,response_json=? WHERE id=?').run(e instanceof CarrierRefusal?'rejected':'unknown',JSON.stringify({error}),body.requestId);return acknowledged?out({ok:true,warning:'Atlas a accepté l’action. Actualisez le suivi.'}):out({error,outcome:e instanceof CarrierRefusal?'rejected':'unknown'},e instanceof CarrierRefusal?502:409)}
 finally{sqlite.prepare('DELETE FROM order_edit_locks WHERE order_id=? AND token=?').run(o.id,token)}
}
