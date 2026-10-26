import {createHash} from 'node:crypto';
import {duplicateOrders,duplicatePhone} from '../../duplicate-order-rules';
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
import {desc,eq,and,inArray,gte} from 'drizzle-orm';
const out=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){const actor=await getActor();if(!actor)return out({error:'Accès non autorisé'},403);const rows=await getDb().select().from(orders).where(orderScope(actor)).orderBy(desc(orders.createdAt));const ledger=loadCommissionLedger(getSqlite().connection,actor.role==='admin'?undefined:actor.email);return out({orders:rows.map(r=>{const {unitCostCents,transportEstimateCents,transportActualCents,transportOverrideCents,...safe}=r;return {...(actor.role==='admin'?r:safe),commission:commission(r),...ledger.states.get(r.id),payload:JSON.parse(r.payload)}}),role:actor.role});}
export async function POST(req:Request){
 const user=await getActor();if(!user)return out({error:'Accès non autorisé'},403);
 if(!sameOrigin(req))return out({error:'Origine refusée'},403);
 let b:any;try{b=await req.json()}catch{return out({error:'Requête invalide'},400)}
 const db=getDb();
 if(b.action==='edit')return editAtlasOrder(b,user);
 if(b.action==='create'){
 const raw=b.payload??{};const p:any=Object.fromEntries(['fullname','phone','address','cityName','cityId','storeId','product','quantity','price','note','openpackage','phone2','change','allowtry'].map(k=>[k,raw[k]]));p.openpackage=raw.openpackage===true;p.change=raw.change===true;p.allowtry=raw.allowtry===true;p.phone2=typeof raw.phone2==='string'?raw.phone2.replace(/\s/g,'').replace(/^\+212/,'0'):'';if(p.phone2&&!/^0[67]\d{8}$/.test(p.phone2))return out({error:'Invalid second phone number.'},400);for(const k of ['fullname','phone','address','cityName','product','note','cityId','storeId'])if(typeof p[k]!=='string'||p[k].length>1000)return out({error:'Champs invalides'},400);
 p.phone=p.phone.replace(/\s/g,'').replace(/^\+212/,'0');
 if(!p.fullname.trim()||!/^0[67]\d{8}$/.test(p.phone)||p.address.replace(/\s/g,'').length<10||!p.cityName||!p.product.trim()||!Number.isInteger(p.price)||p.price<=0||p.price>1000000||!Number.isInteger(p.quantity)||p.quantity<1||p.quantity>9)return out({error:'Vérifiez le nom, le téléphone 06/07, l’adresse (10 caractères hors espaces), le produit, la quantité et le montant entier en DH.'},400);
 const id=b.requestId??crypto.randomUUID(),now=new Date().toISOString();
 if(typeof id!=='string'||!(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i).test(id))return out({error:'Invalid request identifier.'},400);
 const [existing]=await db.select().from(orders).where(eq(orders.id,id));
 if(existing){if(existing.createdEmail!==user.email)return out({error:'Commande introuvable'},404);const saved=JSON.parse(existing.payload);if(['fullname','phone','phone2','address','cityId','storeId','quantity','price','note','openpackage','change','allowtry'].some(k=>saved[k]!==p[k])||saved.stockItems?.[0]?.stockId!==raw.atlasStockId)return out({error:'This order was already saved. Open its details before making changes.'},409);const sent=await transmitOrder(id,user);return out({id,...(await sent.json() as Record<string,unknown>),pending:!sent.ok},sent.ok?200:202)}
 if(!p.cityId.trim())return out({error:'Select an Atlas city before saving.'},400);
 if(raw.fulfillmentMode!==undefined&&raw.fulfillmentMode!=='stock')return out({error:'Invalid parcel type.'},400);
 const key=(env as unknown as Record<string,string>).ATLAS_API_KEY;if(!key)return out({error:'Connect Atlas to load your stock.'},409);
 try{
 const stock=stockSelection(normalizeStocks(await atlasRead(key,'/stocks')),raw.atlasStockId,p.quantity);
 p.product=stock.name;p.stockItems=[{stockId:stock.stockId,quantity:p.quantity}];p.atlasSku=stock.sku;
 const recent=await db.select().from(orders).where(gte(orders.createdAt,new Date(Date.now()-7*86400000).toISOString()));
 const duplicates=duplicateOrders(recent,{phone:p.phone,stockId:stock.stockId,sku:stock.sku,product:stock.name});
 if(duplicates.length){const confirmation=createHash('sha256').update(JSON.stringify([id,user.email,duplicatePhone(p.phone),stock.stockId,duplicates.map(o=>[o.id,o.updatedAt,o.status]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))])).digest('hex');if(b.allowDuplicate!==true||b.duplicateConfirmation!==confirmation)return out({error:'Possible duplicate order: same phone and product within the last 7 days. Review before sending.',code:'duplicate_order',duplicateConfirmation:confirmation,count:duplicates.length},409)}

 const [local]=stock.sku?await db.select().from(products).where(eq(products.sku,stock.sku)):[];
 await db.insert(orders).values({id,payload:JSON.stringify(p),createdBy:user.displayName,createdEmail:user.email,commissionRate:user.role==='agent'?10:0,createdAt:now,updatedAt:now,productId:local?.id??null,unitCostCents:local?.costCents??null,transportEstimateCents:local?.transportCents??null,stockReleased:1}).onConflictDoNothing();
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
 const p=JSON.parse(o.payload);if(!p.cityId)return out({error:'Cette commande n’a pas de ville Atlas associée. Le rattachement des brouillons sera disponible après connexion Atlas.'},409);
 const lock=await db.update(orders).set({status:'sending',error:null,updatedAt:new Date().toISOString()}).where(and(eq(orders.id,o.id),inArray(orders.status,['draft','error']))).returning();if(!lock.length)return out({error:'Un envoi est déjà en cours. Actualisez la liste.'},409);
 try{const payload=atlasParcelPayload(p,o.id);const r=await fetch('https://api.atlaslivraison.com/api/external/colis',{method:'POST',headers:{'x-api-key':key,'Content-Type':'application/json','Idempotency-Key':o.id},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});const j=await r.json().catch(()=>null) as any;if(!r.ok||!j?.success||!j?.data?.code)throw Error(atlasError(r.status,j,key));await db.update(orders).set({transportActualCents:cents(j.data.cfees),status:'sent',tracking:j.data.code,error:null,updatedAt:new Date().toISOString()}).where(eq(orders.id,o.id));return out({tracking:j.data.code});}catch(e){const error=e instanceof Error?e.message:'Erreur de connexion Atlas';await db.update(orders).set({status:'error',error,updatedAt:new Date().toISOString()}).where(eq(orders.id,o.id));return out({error},502)}
}
