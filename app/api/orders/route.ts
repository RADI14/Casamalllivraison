import {upsellCommissionMultiplier} from '../../upsell-commission';
import {orderItems} from '../../order-items';
import {canUseStock} from '../../../server/member-products';
import {audited} from '../../../server/audited-request';
import {duplicatePhone} from '../../duplicate-order-rules';
import {editAtlasOrder} from '../../../server/edit-atlas-order';
import {loadCommissionLedger} from '../../../server/order-commission-payments';
import {getSqlite} from '../../../server/sqlite';
import {sameOrigin} from '../../../server/request-origin';
import {env} from '../../../server/runtime';
import {getActor,orderScope} from '../../access';
import {canAccessOrder,commission} from '../../rules';
import {getDb} from '../../../db';
import {orders,products} from '../../../db/schema';
import {cents} from '../../finance-rules';
import {atlasRead,normalizeStocks,stockSelection} from '../../atlas-stock';
import {atlasParcelPayload,atlasError} from '../../atlas-request';
import {cancelAtlasParcel} from '../../atlas-cancel';
import {desc,eq,and,inArray} from 'drizzle-orm';
const out=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){const actor=await getActor();if(!actor)return out({error:'Accès non autorisé'},403);const rows=await getDb().select().from(orders).where(orderScope(actor)).orderBy(desc(orders.createdAt));const photoProducts=await getDb().select({id:products.id,sku:products.sku}).from(products);const ledger=loadCommissionLedger(getSqlite().connection,actor.role==='admin'?undefined:actor.email);return out({orders:rows.map(r=>{const {purchaseTotalCents,unitCostCents,transportEstimateCents,transportActualCents,transportOverrideCents,...safe}=r;return {...(actor.role==='admin'?r:safe),photoSku:photoProducts.find(p=>p.id===r.productId)?.sku,commission:commission(r),...ledger.states.get(r.id),payload:JSON.parse(r.payload)}}),role:actor.role});}
const activePhoneError='This phone number already has an active order. Wait until that order is closed before creating another.';
function hasActivePhone(db:ReturnType<typeof getSqlite>['connection'],p:{phone:string;phone2?:string}){
 const phones=new Set([duplicatePhone(p.phone),duplicatePhone(p.phone2)].filter(Boolean));
 const active=db.prepare("SELECT payload,atlas_state_name AS state FROM orders WHERE status!='cancelled' AND atlas_state IS NOT 17").all();
 return active.some(o=>{
  const state=String(o.state??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(['livre','livree','delivered','annule','annulee','cancelled','canceled','retourne','retournee','returned'].includes(state))return false;
  try{const prior=JSON.parse(String(o.payload));return phones.has(duplicatePhone(prior.phone))||phones.has(duplicatePhone(prior.phone2))}catch{return false}
 });
}
const phoneConflict=()=>out({error:activePhoneError,code:'active_phone_order'},409);
async function handlePost(req:Request){
 const user=await getActor();if(!user)return out({error:'Accès non autorisé'},403);
 if(!sameOrigin(req))return out({error:'Origine refusée'},403);
 let b:any;try{b=await req.json()}catch{return out({error:'Requête invalide'},400)}
 const db=getDb();
 if(b.action==='edit')return editAtlasOrder(b,user);
 if(b.action==='create'){
 const raw=b.payload??{};let items:ReturnType<typeof orderItems>;try{items=orderItems(raw)}catch(e){return out({error:(e as Error).message},400)}const p:any=Object.fromEntries(['fullname','phone','address','cityName','cityId','storeId','product','quantity','price','note','openpackage','phone2','change','allowtry'].map(k=>[k,raw[k]]));p.openpackage=raw.openpackage===true;p.change=raw.change===true;p.allowtry=raw.allowtry===true;p.phone2=typeof raw.phone2==='string'?raw.phone2.replace(/\s/g,'').replace(/^(?:\+212|00212|212)/,'0'):'';if(p.phone2&&!/^0[67]\d{8}$/.test(p.phone2))return out({error:'Invalid second phone number.'},400);for(const k of ['fullname','phone','address','cityName','product','note','cityId','storeId'])if(typeof p[k]!=='string'||p[k].length>1000)return out({error:'Champs invalides'},400);
 p.phone=p.phone.replace(/\s/g,'').replace(/^(?:\+212|00212|212)/,'0');
 if(!p.fullname.trim()||!/^0[67]\d{8}$/.test(p.phone)||p.address.replace(/\s/g,'').length<10||!p.cityName||!p.product.trim()||!Number.isInteger(p.price)||p.price<=0||p.price>1000000||!Number.isInteger(p.quantity)||p.quantity<1||p.quantity>9)return out({error:'Vérifiez le nom, le téléphone 06/07, l’adresse (10 caractères hors espaces), le produit, la quantité et le montant entier en DH.'},400);
 let siteOrder:any=null;
 if(b.websiteOrderId!==undefined){
  if(typeof b.websiteOrderId!=='string')return out({error:'Commande site invalide'},400);
  siteOrder=getSqlite().connection.prepare('SELECT * FROM youcan_orders WHERE id=? AND store_id=?').get(b.websiteOrderId,process.env.YOUCAN_STORE_ID??'');
  if(!siteOrder||user.role!=='admin'&&siteOrder.assigned_email!==user.email)return out({error:'Commande site introuvable'},404);
  if(!siteOrder.hydrated||JSON.parse(siteOrder.payload).blocked||JSON.parse(siteOrder.payload).currency!=='MAD')return out({error:'Vérifiez les informations et la devise de la commande site.'},409);
 }
 const id=siteOrder?.id??b.requestId??crypto.randomUUID(),now=new Date().toISOString();
 if(typeof id!=='string'||!(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i).test(id))return out({error:'Invalid request identifier.'},400);
 const [existing]=await db.select().from(orders).where(eq(orders.id,id));
 if(existing){if(existing.createdEmail!==user.email)return out({error:'Commande introuvable'},404);const saved=JSON.parse(existing.payload);if(['fullname','phone','phone2','address','cityId','storeId','quantity','price','note','openpackage','change','allowtry'].some(k=>saved[k]!==p[k])||JSON.stringify(saved.stockItems)!==JSON.stringify(items))return out({error:'This order was already saved. Open its details before making changes.'},409);const sent=await transmitOrder(id,user);return out({id,...(await sent.json() as Record<string,unknown>),pending:!sent.ok},sent.ok?200:202)}
 const sql=getSqlite().connection;
 if(hasActivePhone(sql,p))return phoneConflict();
 if(!p.cityId.trim())return out({error:'Select an Atlas city before saving.'},400);
 if(raw.fulfillmentMode!==undefined&&raw.fulfillmentMode!=='stock')return out({error:'Invalid parcel type.'},400);
 const key=(env as unknown as Record<string,string>).ATLAS_API_KEY;if(!key)return out({error:'Connect Atlas to load your stock.'},409);
 try{
 if(items.some(i=>!canUseStock(user,i.stockId)))return out({error:'Produit non autorisé pour ce compte.'},403);
 const available=normalizeStocks(await atlasRead(key,'/stocks'));
 const selected=items.map(i=>({stock:stockSelection(available,i.stockId,i.quantity),quantity:i.quantity}));
 const stock=selected[0].stock;
 p.quantity=items.reduce((n,i)=>n+i.quantity,0);p.product=selected.length===1?stock.name:selected.map(i=>i.stock.name+' × '+i.quantity).join(' + ');p.stockItems=items;if(selected.length===1)p.atlasSku=stock.sku;
 const locals=await db.select().from(products);const local=selected.length===1?locals.find(p=>p.sku===stock.sku):undefined;const costs=selected.map(i=>{const p=locals.find(p=>p.sku===i.stock.sku);return p?.costCents==null?null:p.costCents*i.quantity});const purchaseTotalCents=selected.length>1&&costs.every(c=>c!==null)?costs.reduce<number>((n,c)=>n+(c??0),0):null;
 const upsellSkus=new Set((getSqlite().connection.prepare('SELECT sku FROM product_commission_settings WHERE upsell=1').all() as {sku:string}[]).map(r=>r.sku));const commissionUpsellStockIds=selected.filter(i=>upsellSkus.has(i.stock.sku)).map(i=>i.stock.stockId);
 // Recheck and reserve the phone in one SQLite write transaction, before contacting Atlas.
 sql.exec('BEGIN IMMEDIATE');
 try{
  if(hasActivePhone(sql,p)){sql.exec('ROLLBACK');return phoneConflict()}
  if(siteOrder){const current=sql.prepare('SELECT assigned_email,local_order_id FROM youcan_orders WHERE id=?').get(siteOrder.id);if(!current||current.local_order_id||user.role!=='admin'&&current.assigned_email!==user.email){sql.exec('ROLLBACK');return out({error:'Commande site modifiée. Actualisez la liste.'},409)}}
  sql.prepare(`INSERT INTO orders(id,payload,created_by,created_email,commission_rate,commission_multiplier,commission_upsell_stock_ids,created_at,updated_at,product_id,unit_cost_cents,purchase_total_cents,transport_estimate_cents,stock_released)
   VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,1)`).run(id,JSON.stringify(p),user.displayName,user.email,user.role==='agent'?10:0,upsellCommissionMultiplier(p,commissionUpsellStockIds),JSON.stringify(commissionUpsellStockIds),now,now,local?.id??null,local?.costCents??null,purchaseTotalCents,local?.transportCents??null);
  if(siteOrder)sql.prepare('UPDATE youcan_orders SET local_order_id=? WHERE id=?').run(id,siteOrder.id);
  sql.exec('COMMIT');
 }catch(e){sql.exec('ROLLBACK');throw e}

 const sent=await transmitOrder(id,user);return out({id,...(await sent.json() as Record<string,unknown>),pending:!sent.ok},sent.ok?201:202);
 }catch(e){return out({error:e instanceof Error?e.message:'Atlas stock is unavailable. Refresh the connection before creating an order.'},409)}

 }
 if(b.action==='transport'){
 return out({error:'Transport costs are managed by Atlas.'},409);
 }
 if(b.action==='cancel'){
 const [o]=await db.select().from(orders).where(eq(orders.id,b.id));if(!o||!canAccessOrder(user,o)||o.status!=='draft'||o.tracking)return out({error:'Seul un brouillon peut être annulé.'},409);const p=JSON.parse(o.payload),now=new Date().toISOString(),movement=o.id+':release';
 if(Array.isArray(p.stockItems)&&p.stockItems.length){const changed=await db.update(orders).set({status:'cancelled',updatedAt:now}).where(and(eq(orders.id,o.id),eq(orders.status,'draft'))).returning();return changed.length?out({ok:true}):out({error:'Seul un brouillon peut être annulé.'},409)}
 const released=await env.DB!.batch([
 env.DB!.prepare(`INSERT INTO stock_movements(id,product_id,order_id,delta,reason,actor,created_at) SELECT ?,product_id,id,?,?,?,? FROM orders WHERE id=? AND status='draft' AND product_id IS NOT NULL AND stock_released=0 ON CONFLICT(id) DO NOTHING`).bind(movement,p.quantity,'Annulation brouillon',user.email,now,o.id),
 env.DB!.prepare(`UPDATE products SET stock=stock+? WHERE id=? AND EXISTS(SELECT 1 FROM orders WHERE id=? AND status='draft' AND stock_released=0) AND EXISTS(SELECT 1 FROM stock_movements WHERE id=?)`).bind(p.quantity,o.productId??'',o.id,movement),
 env.DB!.prepare(`UPDATE orders SET status='cancelled',stock_released=1,updated_at=? WHERE id=? AND status='draft'`).bind(now,o.id)
 ]);if(!released[2].meta.changes)return out({error:'Seul un brouillon peut être annulé.'},409);return out({ok:true});
 }
 if(b.action==='cancel_atlas'){
 const [o]=await db.select().from(orders).where(eq(orders.id,b.id));
 if(!o||!canAccessOrder(user,o))return out({error:'Commande introuvable'},404);
 if(getSqlite().connection.prepare('SELECT 1 FROM order_edit_locks WHERE order_id=? AND expires_at>?').get(o.id,Date.now()))return out({error:'Une modification est en cours. Réessayez après son enregistrement.'},409);
 if(o.status==='cancelled')return out({ok:true});
 if(!o.tracking||o.status==='sending')return out({error:'Order cannot be cancelled.'},409);
 const key=(env as unknown as Record<string,string>).ATLAS_API_KEY;if(!key)return out({error:'API Atlas non configurée.'},409);
 try{await cancelAtlasParcel(key,o.tracking);await db.update(orders).set({status:'cancelled',atlasState:null,atlasStateName:'Annulée',error:null,updatedAt:new Date().toISOString()}).where(eq(orders.id,o.id));return out({ok:true});}catch(e){return out({error:e instanceof Error?e.message:'Erreur de connexion Atlas'},502)}
 }
 if(b.action==='assignCity'){
 const [o]=await db.select().from(orders).where(eq(orders.id,b.id));
 if(!o||!canAccessOrder(user,o)||o.status!=='draft')return out({error:'Seul un brouillon peut changer de ville.'},409);
 const key=(env as unknown as Record<string,string>).ATLAS_API_KEY;if(!key)return out({error:'Connectez Atlas pour choisir une ville.'},409);
 try{const r=await fetch('https://api.atlaslivraison.com/api/external/cities',{headers:{'x-api-key':key},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const j=await r.json() as any;const city=j.data?.find((c:any)=>c.id===b.cityId);if(!city)return out({error:'Ville invalide'},400);const p=JSON.parse(o.payload);await db.update(orders).set({payload:JSON.stringify({...p,cityId:city.id,cityName:city.name}),updatedAt:new Date().toISOString()}).where(and(eq(orders.id,o.id),eq(orders.status,'draft')));return out({ok:true});}catch{return out({error:'Impossible de récupérer les villes Atlas'},502)}
 }
 if(b.action==='send')return transmitOrder(b.id,user);
 return out({error:'Action inconnue'},400);
}

async function transmitOrder(id:string,user:Awaited<ReturnType<typeof getActor>>){
 if(!user)return out({error:'Accès non autorisé'},403);
 const db=getDb();
 const key=(env as unknown as Record<string,string>).ATLAS_API_KEY;if(!key)return out({error:'API Atlas non configurée. La commande reste enregistrée.'},409);
 const [o]=await db.select().from(orders).where(eq(orders.id,id));if(!o||!canAccessOrder(user,o))return out({error:'Commande introuvable'},404);if(o.tracking)return out({tracking:o.tracking});
 const p=JSON.parse(o.payload);if(user.role!=='admin'&&(!Array.isArray(p.stockItems)||!p.stockItems.length||p.stockItems.some((s:any)=>!canUseStock(user,s.stockId))))return out({error:'Produit non autorisé pour ce compte.'},403);if(!p.cityId)return out({error:'Cette commande n’a pas de ville Atlas associée. Le rattachement des brouillons sera disponible après connexion Atlas.'},409);
 const lock=await db.update(orders).set({status:'sending',error:null,updatedAt:new Date().toISOString()}).where(and(eq(orders.id,o.id),inArray(orders.status,['draft','error']))).returning();if(!lock.length)return out({error:'Un envoi est déjà en cours. Actualisez la liste.'},409);
 try{const payload=atlasParcelPayload(p,o.id);const r=await fetch('https://api.atlaslivraison.com/api/external/colis',{method:'POST',headers:{'x-api-key':key,'Content-Type':'application/json','Idempotency-Key':o.id},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});const j=await r.json().catch(()=>null) as any;if(!r.ok||!j?.success||!j?.data?.code)throw Error(atlasError(r.status,j,key));await db.update(orders).set({transportActualCents:cents(j.data.cfees),status:'sent',tracking:j.data.code,error:null,updatedAt:new Date().toISOString()}).where(eq(orders.id,o.id));return out({tracking:j.data.code});}catch(e){const error=e instanceof Error?e.message:'Erreur de connexion Atlas';await db.update(orders).set({status:'error',error,updatedAt:new Date().toISOString()}).where(eq(orders.id,o.id));return out({error},502)}
}

export const POST=audited(handlePost);
