import {getSqlite} from '../../../../server/sqlite';
import {secret,storeId,verifyYoucan,receiveYoucan,hydrateYoucan} from '../../../../server/youcan';
export async function POST(req:Request){
 if(!secret()||!storeId())return Response.json({error:'Not configured'},{status:503});
 if(Number(req.headers.get('content-length'))>500000)return new Response(null,{status:413});
 const raw=await req.text();if(raw.length>500000)return new Response(null,{status:413});
 if(!verifyYoucan(raw,req.headers.get('x-youcan-signature')??'',secret()))return new Response(null,{status:401});
 let b:any;try{b=JSON.parse(raw)}catch{return new Response(null,{status:400})}
 if(b.event_name==='app.uninstalled'){if(b.data?.store_id!==storeId())return new Response(null,{status:403});getSqlite().connection.prepare('DELETE FROM youcan_connections WHERE store_id=?').run(storeId());return Response.json({ok:true})}
 if(!['order.created','order.updated'].includes(b.event_name))return new Response(null,{status:204});
 if(b.data?.store_id!==storeId())return new Response(null,{status:403});
 const eventAt=Date.parse(b.event_happened_at);if(!Number.isFinite(eventAt))return new Response(null,{status:400});
 try{const db=getSqlite().connection;if(!db.prepare('SELECT 1 FROM youcan_connections WHERE store_id=?').get(storeId()))return new Response(null,{status:410});receiveYoucan(db,b.data,new Date(eventAt).toISOString());await hydrateYoucan(db,b.data.id);return Response.json({ok:true})}catch{return Response.json({error:'Import pending; retry delivery'},{status:503})}
}
