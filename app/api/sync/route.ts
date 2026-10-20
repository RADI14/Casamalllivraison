import {sameOrigin} from '../../../server/request-origin';
import {env} from '../../../server/runtime';
import {getActor,orderScope} from '../../access';
import {getDb} from '../../../db';
import {orders} from '../../../db/schema';
import {atlasOrderSnapshot} from '../../atlas-order-sync';
import {and,eq,gt,isNotNull,asc,sql} from 'drizzle-orm';
export async function POST(req:Request){
 const a=await getActor();if(!a)return Response.json({error:'Accès non autorisé'},{status:403});if(!sameOrigin(req))return Response.json({error:'Origine refusée'},{status:403});const key=(env as unknown as Record<string,string>).ATLAS_API_KEY;if(!key)return Response.json({error:'Connectez Atlas pour synchroniser les livraisons.'},{status:409});
 const body:any=await req.json().catch(()=>({}));const cursor=body?.cursor;if(cursor!==undefined&&(typeof cursor!=='string'||!cursor||cursor.length>200))return Response.json({error:'Curseur invalide'},{status:400});
 const db=getDb();const batch=await db.select().from(orders).where(and(orderScope(a),isNotNull(orders.tracking),cursor?gt(orders.id,cursor):undefined)).orderBy(asc(orders.id)).limit(21);const rows=batch.slice(0,20);
 let updated=0,failed=0;
 for(let i=0;i<rows.length;i+=5)await Promise.all(rows.slice(i,i+5).map(async o=>{try{const r=await fetch('https://api.atlaslivraison.com/api/external/colis/'+encodeURIComponent(o.tracking!),{cache:'no-store',headers:{'x-api-key':key},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();const j=await r.json() as any;if(!j.success||j.data?.code!==o.tracking||!Number.isInteger(j.data.stateId))throw Error();const snapshot=atlasOrderSnapshot(JSON.parse(o.payload),j.data),now=new Date().toISOString();const status=snapshot.cancelled?'cancelled':o.status==='cancelled'&&!snapshot.stateName?'cancelled':'sent';const payload=JSON.stringify(snapshot.payload);const changed=payload!==o.payload||j.data.stateId!==o.atlasState||snapshot.stateName!==o.atlasStateName||status!==o.status||snapshot.transportCents!==null&&snapshot.transportCents!==o.transportActualCents;const saved=await db.update(orders).set({payload,status,...(snapshot.productChanged?{productId:null,unitCostCents:null}:{}),...(snapshot.transportCents!==null?{transportActualCents:snapshot.transportCents}:{}),atlasState:j.data.stateId,atlasStateName:snapshot.stateName,syncedAt:now,...(changed?{updatedAt:now}:{})}).where(and(eq(orders.id,o.id),eq(orders.payload,o.payload),eq(orders.status,o.status),eq(orders.updatedAt,o.updatedAt),sql`NOT EXISTS (SELECT 1 FROM order_edit_locks WHERE order_id=${o.id} AND expires_at>${Date.now()})`)).returning({id:orders.id});if(saved.length)updated++;else failed++;}catch{failed++}}));
 return Response.json({updated,failed,batchLimit:20,nextCursor:batch.length>20?rows[rows.length-1].id:null});
}
