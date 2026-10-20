import {eq,and} from 'drizzle-orm';
import {getDb} from '../db';
import {orders} from '../db/schema';
import {getSqlite} from './sqlite';
import {env} from './runtime';
import {canAccessOrder} from '../app/rules';
import {orderEditChanges} from '../app/order-edit-rules';
import {atlasOrderSnapshot} from '../app/atlas-order-sync';
import {atlasError} from '../app/atlas-request';
const out=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function editAtlasOrder(body:any,user:any){
 const db=getDb(),sqlite=getSqlite().connection;
 const [o]=await db.select().from(orders).where(eq(orders.id,body.id));
 if(!o||!canAccessOrder(user,o))return out({error:'Commande introuvable'},404);
 if(!o.tracking||o.status!=='sent')return out({error:'Seul un colis transmis et encore Nouveau peut être modifié.'},409);
 if(body.expectedUpdatedAt!==o.updatedAt)return out({error:'La commande a changé. Fermez puis rouvrez ses détails avant de modifier.'},409);
 let changes:Record<string,any>;const saved=JSON.parse(o.payload);
 try{changes=orderEditChanges(body.changes,saved)}catch(e){return out({error:(e as Error).message},400)}
 if(!Object.keys(changes).length)return out({ok:true});
 const key=(env as unknown as Record<string,string>).ATLAS_API_KEY;if(!key)return out({error:'API Atlas non configurée.'},409);
 const token=crypto.randomUUID();
 const lock=sqlite.prepare('INSERT INTO order_edit_locks(order_id,token,expires_at) VALUES(?,?,?) ON CONFLICT(order_id) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at WHERE order_edit_locks.expires_at<?').run(o.id,token,Date.now()+120000,Date.now());
 if(!lock.changes)return out({error:'Une modification est déjà en cours. Réessayez dans quelques instants.'},409);
 try{
  const [fresh]=await db.select().from(orders).where(eq(orders.id,o.id));if(fresh.updatedAt!==o.updatedAt)return out({error:'La commande a changé. Fermez puis rouvrez ses détails.'},409);
  const url='https://api.atlaslivraison.com/api/external/colis/'+encodeURIComponent(o.tracking);
  async function read(){const r=await fetch(url,{cache:'no-store',headers:{'x-api-key':key},signal:AbortSignal.timeout(12000)});const j:any=await r.json().catch(()=>null);if(!r.ok||!j?.success||j.data?.code!==o.tracking||!Number.isInteger(j.data.stateId))throw Error('Impossible de vérifier le colis dans Atlas. Actualisez puis réessayez.');return j.data}
  const remote=await read();
  if(remote.stateId!==1)return out({error:'Atlas autorise la modification uniquement au statut Nouveau, avant la collecte.'},409);
  const current=atlasOrderSnapshot(saved,remote).payload;
  if(Object.keys(changes).some(k=>current[k]!==saved[k]&&!(current[k]===undefined&&saved[k]==='')))return out({error:'Ces informations ont changé dans Atlas. Synchronisez puis rouvrez la commande.'},409);
  let cityName=current.cityName;
  if(changes.cityId){const r=await fetch('https://api.atlaslivraison.com/api/external/cities',{cache:'no-store',headers:{'x-api-key':key},signal:AbortSignal.timeout(12000)});const j:any=await r.json();const city=r.ok&&j.success&&Array.isArray(j.data)&&j.data.find((c:any)=>c.id===changes.cityId);if(!city)return out({error:'Ville Atlas invalide ou indisponible.'},400);cityName=city.name;}
  const r=await fetch(url,{method:'PATCH',headers:{'x-api-key':key,'Content-Type':'application/json'},body:JSON.stringify(changes),signal:AbortSignal.timeout(20000)});const j:any=await r.json().catch(()=>null);
  if(!r.ok||!j?.success||j.data?.code!==o.tracking)throw Error(atlasError(r.status,j,key));
  // PATCH can return only changed fields. Preserve the verified detail and merge its acknowledgement.
  let confirmed={...remote,...changes,...(changes.cityId?{cityName,cfees:undefined}:{}),...j.data};
  try{confirmed={...confirmed,...await read()}}catch{/* PATCH acknowledgement is enough; periodic sync retries the detail read. */}
  const snapshot=atlasOrderSnapshot(saved,confirmed),now=new Date().toISOString();
  const updated=await db.update(orders).set({payload:JSON.stringify(snapshot.payload),status:snapshot.cancelled?'cancelled':'sent',...(snapshot.productChanged?{productId:null,unitCostCents:null}:{}),...(snapshot.transportCents!==null?{transportActualCents:snapshot.transportCents}:changes.cityId?{transportActualCents:null}:{}),atlasState:confirmed.stateId,atlasStateName:snapshot.stateName,syncedAt:now,error:null,updatedAt:now}).where(and(eq(orders.id,o.id),eq(orders.updatedAt,o.updatedAt))).returning({id:orders.id});
  if(!updated.length)return out({error:'Atlas a enregistré la modification. Synchronisez pour actualiser la plateforme.'},409);
  return out({ok:true});
 }catch(e){return out({error:(e as Error).message||'Erreur de connexion Atlas. Synchronisez pour vérifier avant de réessayer.'},502)}
 finally{sqlite.prepare('DELETE FROM order_edit_locks WHERE order_id=? AND token=?').run(o.id,token)}
}
