import {getActor} from '../../access';
import {getSqlite} from '../../../server/sqlite';
import {sameOrigin} from '../../../server/request-origin';
import {storeId,secret,hydrateYoucan,youcanRequest,connection} from '../../../server/youcan';
const out=(b:any,status=200)=>Response.json(b,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){const actor=await getActor();if(!actor)return out({error:'Connexion requise'},401);const db=getSqlite().connection;
 const rows=db.prepare('SELECT y.*,o.tracking,o.status AS order_status FROM youcan_orders y LEFT JOIN orders o ON o.id=y.local_order_id WHERE y.store_id=?'+(actor.role==='admin'?'':' AND y.assigned_email=?')+' ORDER BY y.received_at DESC LIMIT 500').all(...(actor.role==='admin'?[storeId()]:[storeId(),actor.email]));
 const c=db.prepare('SELECT connected_at,expires_at FROM youcan_connections WHERE store_id=?').get(storeId());
 return out({orders:rows.map(r=>({...r,payload:JSON.parse(String(r.payload))})),configured:!!(secret()&&storeId()),connected:!!c&&Number(c.expires_at)>Date.now(),...(actor.role==='admin'?{members:db.prepare('SELECT email,name FROM members WHERE active=1 AND deleted_at IS NULL').all()}:{}),isAdmin:actor.role==='admin'});
}
export async function POST(req:Request){const actor=await getActor();if(!actor)return out({error:'Connexion requise'},401);if(!sameOrigin(req))return out({error:'Origine refusée'},403);let b:any;try{b=await req.json()}catch{return out({error:'Requête invalide'},400)}const db=getSqlite().connection;
 try{
 if(['subscribe','refresh','assign'].includes(b.action)&&actor.role!=='admin')return out({error:'Accès administrateur requis'},403);
 if(b.action==='subscribe'&&actor.role==='admin'){for(const event of ['order.created','order.updated','app.uninstalled'])await youcanRequest(connection(db),'/resthooks/subscribe',{event,target_url:'https://fastlivraison.com/api/youcan/webhook'});return out({ok:true})}
 if(b.action==='refresh'&&actor.role==='admin'){const pending=db.prepare('SELECT remote_id FROM youcan_orders WHERE store_id=? AND hydrated=0 AND local_order_id IS NULL LIMIT 10').all(storeId());for(const p of pending)await hydrateYoucan(db,String(p.remote_id));return out({ok:true})}
 if(typeof b.id!=='string')return out({error:'Commande invalide'},400);
 const row=db.prepare('SELECT * FROM youcan_orders WHERE id=? AND store_id=?').get(b.id,storeId());if(!row||actor.role!=='admin'&&row.assigned_email!==actor.email)return out({error:'Commande introuvable'},404);
 if(b.action==='assign'&&actor.role==='admin'){if(row.local_order_id)return out({error:'Commande déjà confirmée'},409);if(!db.prepare('SELECT 1 FROM members WHERE email=? AND active=1 AND deleted_at IS NULL').get(b.email))return out({error:'Collaboratrice introuvable'},400);db.prepare('UPDATE youcan_orders SET assigned_email=? WHERE id=? AND local_order_id IS NULL').run(b.email,b.id);return out({ok:true})}
 return out({error:'Action refusée'},403);
 }catch(e){return out({error:(e as Error).message},502)}
}
