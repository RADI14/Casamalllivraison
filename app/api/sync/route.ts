import {sameOrigin} from '../../../server/request-origin';
import {env} from '../../../server/runtime';
import {getActor,orderScope} from '../../access';
import {getDb} from '../../../db';
import {orders} from '../../../db/schema';
import {cents} from '../../finance-rules';
import {and,eq,ne,isNotNull,asc} from 'drizzle-orm';
export async function POST(req:Request){
 const a=await getActor();if(!a)return Response.json({error:'Accès non autorisé'},{status:403});if(!sameOrigin(req))return Response.json({error:'Origine refusée'},{status:403});const key=(env as unknown as Record<string,string>).ATLAS_API_KEY;if(!key)return Response.json({error:'Connectez Atlas pour synchroniser les livraisons.'},{status:409});
 const db=getDb();const rows=await db.select().from(orders).where(and(orderScope(a),isNotNull(orders.tracking),ne(orders.status,'cancelled'))).orderBy(asc(orders.syncedAt)).limit(20);
 let updated=0,failed=0;
 for(let i=0;i<rows.length;i+=5)await Promise.all(rows.slice(i,i+5).map(async o=>{try{const r=await fetch('https://api.atlaslivraison.com/api/external/colis/'+encodeURIComponent(o.tracking!),{headers:{'x-api-key':key},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();const j=await r.json() as any;if(!j.success||j.data?.code!==o.tracking||!Number.isInteger(j.data.stateId))throw Error();await db.update(orders).set({...(cents(j.data.cfees)!==null?{transportActualCents:cents(j.data.cfees)}:{}),atlasState:j.data.stateId,atlasStateName:typeof j.data.stateName==='string'?j.data.stateName:null,syncedAt:new Date().toISOString()}).where(and(eq(orders.id,o.id),ne(orders.status,'cancelled')));updated++;}catch{failed++}}));
 return Response.json({updated,failed,batchLimit:20});
}
