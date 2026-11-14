import {POST as parcelAction} from '../orders/route';
import {websiteParcelPayload} from '../../../server/youcan-parcel';
import {validWebsiteStatus} from '../../youcan-workflow';
import {getActor} from '../../access';
import {getSqlite} from '../../../server/sqlite';
import {sameOrigin} from '../../../server/request-origin';
import {storeId,secret,hydrateYoucan,activateYoucan,connection} from '../../../server/youcan';
const out=(b:any,status=200)=>Response.json(b,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){const actor=await getActor();if(!actor)return out({error:'Connexion requise'},401);const db=getSqlite().connection;
 const rows=db.prepare('SELECT y.*,o.tracking,o.status AS order_status FROM youcan_orders y LEFT JOIN orders o ON o.id=y.local_order_id WHERE y.store_id=?'+(actor.role==='admin'?'':' AND y.assigned_email=?')+' ORDER BY y.received_at DESC LIMIT 500').all(...(actor.role==='admin'?[storeId()]:[storeId(),actor.email]));
 const c=db.prepare('SELECT connected_at,expires_at FROM youcan_connections WHERE store_id=?').get(storeId());
 return out({orders:rows.map(r=>{const {prepared_payload,...safe}=r;return {...safe,prepared:prepared_payload?JSON.parse(String(prepared_payload)):null,payload:JSON.parse(String(r.payload))}}),configured:!!(secret()&&storeId()),connected:!!c&&Number(c.expires_at)>Date.now(),isAdmin:actor.role==='admin'});
}
export async function POST(req:Request){const actor=await getActor();if(!actor)return out({error:'Connexion requise'},401);if(!sameOrigin(req))return out({error:'Origine refusée'},403);let b:any;try{b=await req.json()}catch{return out({error:'Requête invalide'},400)}const db=getSqlite().connection;
 try{
 if(['subscribe','refresh','assign'].includes(b.action)&&actor.role!=='admin')return out({error:'Accès administrateur requis'},403);
 if(b.action==='subscribe'&&actor.role==='admin'){await activateYoucan(connection(db));return out({ok:true})}
 if(b.action==='refresh'&&actor.role==='admin'&&b.id!==undefined){if(typeof b.id!=='string')return out({error:'Commande invalide'},400);const row=db.prepare('SELECT remote_id,local_order_id,prepared_payload FROM youcan_orders WHERE id=? AND store_id=?').get(b.id,storeId());if(!row)return out({error:'Commande introuvable'},404);if(row.local_order_id||row.prepared_payload)return out({error:'Informations déjà préparées. Les corrections enregistrées sont conservées.'},409);await hydrateYoucan(db,String(row.remote_id));return out({ok:true})}
 if(b.action==='refresh'&&actor.role==='admin'){const pending=db.prepare("SELECT remote_id FROM youcan_orders WHERE store_id=? AND (hydrated=0 OR COALESCE(json_extract(payload,'$.address'),'')='') AND local_order_id IS NULL AND prepared_payload IS NULL LIMIT 10").all(storeId());for(const p of pending)await hydrateYoucan(db,String(p.remote_id));return out({ok:true})}
 if(typeof b.id!=='string')return out({error:'Commande invalide'},400);
 const row=db.prepare('SELECT * FROM youcan_orders WHERE id=? AND store_id=?').get(b.id,storeId());if(!row||actor.role!=='admin'&&row.assigned_email!==actor.email)return out({error:'Commande introuvable'},404);
 if(b.action==='details'){
  if(!row.local_order_id&&!row.prepared_payload)await hydrateYoucan(db,String(row.remote_id));
  const fresh=db.prepare('SELECT * FROM youcan_orders WHERE id=? AND store_id=?').get(row.id,storeId())!;
  const {prepared_payload,...safe}=fresh;
  return out({order:{...safe,payload:JSON.parse(String(fresh.payload)),prepared:prepared_payload?JSON.parse(String(prepared_payload)):null}});
 }
 if(b.action==='status'){
  if(!validWebsiteStatus(b.status))return out({error:'Statut invalide'},400);
  if(b.sourceUpdatedAt!==undefined&&b.sourceUpdatedAt!==row.source_updated_at)return out({error:'La commande a changé sur YouCan. Actualisez avant confirmation.'},409);
  if(row.local_order_id)return out({error:'Ce colis est déjà préparé pour Atlas.'},409);
  const source=JSON.parse(String(row.payload));
  if(b.status==='confirmed'&&(!row.hydrated||source.blocked||source.currency!=='MAD'))return out({error:'Vérifiez les informations et la devise avant confirmation.'},409);
  const result=db.prepare('UPDATE youcan_orders SET review_status=?,review_updated_at=? WHERE id=? AND local_order_id IS NULL').run(b.status,new Date().toISOString(),row.id);
  return result.changes?out({ok:true}):out({error:'Commande modifiée. Actualisez la liste.'},409);
 }
 if(b.action==='prepare'){
  if(row.local_order_id)return out({error:'Ce colis est déjà préparé pour Atlas.'},409);
  if(b.sourceUpdatedAt!==row.source_updated_at)return out({error:'La commande a changé sur YouCan. Rouvrez ses informations.'},409);
  if(!b.payload||typeof b.payload!=='object'||JSON.stringify(b.payload).length>16000)return out({error:'Informations invalides'},400);
  const allowed=['fullname','phone','phone2','address','cityId','cityName','storeId','product','quantity','price','note','openpackage','change','allowtry','fulfillmentMode','atlasStockId','items'];
  const payload=Object.fromEntries(allowed.filter(k=>b.payload[k]!==undefined).map(k=>[k,b.payload[k]]));
  const result=db.prepare('UPDATE youcan_orders SET prepared_payload=?,review_updated_at=? WHERE id=? AND local_order_id IS NULL').run(JSON.stringify(payload),new Date().toISOString(),row.id);
  return result.changes?out({ok:true}):out({error:'Commande modifiée. Actualisez la liste.'},409);
 }
 if(b.action==='send'){
  if(row.review_status!=='confirmed')return out({error:'Seules les commandes avec le statut Confirmer peuvent être envoyées.'},409);
  if(row.local_order_id){
   return parcelAction(new Request(new URL('/api/orders',req.url),{method:'POST',headers:req.headers,body:JSON.stringify({action:'send',id:row.local_order_id})}));
  }
  const key=process.env.ATLAS_API_KEY;if(!key)return out({error:'Atlas non connecté'},409);
  const payload=await websiteParcelPayload(row,key);
  if(!String(payload.note??'').startsWith('YouCan #'+row.reference))payload.note=('YouCan #'+row.reference+' · '+(payload.note??'')).slice(0,1000);
  return parcelAction(new Request(new URL('/api/orders',req.url),{method:'POST',headers:req.headers,body:JSON.stringify({action:'create',websiteOrderId:row.id,expectedWebsiteSourceAt:row.source_updated_at,payload})}));
 }
 if(b.action==='assign'&&actor.role==='admin'){if(row.local_order_id)return out({error:'Commande déjà confirmée'},409);if(!db.prepare('SELECT 1 FROM members WHERE email=? AND active=1 AND deleted_at IS NULL').get(b.email))return out({error:'Collaboratrice introuvable'},400);db.prepare('UPDATE youcan_orders SET assigned_email=? WHERE id=? AND local_order_id IS NULL').run(b.email,b.id);return out({ok:true})}
 return out({error:'Action refusée'},403);
 }catch(e){return out({error:(e as Error).message},502)}
}
