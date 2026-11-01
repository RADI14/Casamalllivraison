import {getActor} from '../../access';
import {sameOrigin} from '../../../server/request-origin';
import {getSqlite} from '../../../server/sqlite';
import {allowedStockIds} from '../../../server/member-products';
import {atlasRead,normalizeStocks} from '../../atlas-stock';
export async function GET(req:Request){
 if((await getActor())?.role!=='admin')return Response.json({error:'Accès administrateur requis'},{status:403});
 const email=new URL(req.url).searchParams.get('email')??'';
 try{return Response.json({selected:[...allowedStockIds(email)],products:normalizeStocks(await atlasRead(process.env.ATLAS_API_KEY??'','/stocks'))},{headers:{'Cache-Control':'private, no-store'}})}catch{return Response.json({error:'Stock Atlas indisponible.'},{status:502})}
}
export async function POST(req:Request){
 if((await getActor())?.role!=='admin'||!sameOrigin(req))return Response.json({error:'Accès refusé'},{status:403});
 const b:any=await req.json().catch(()=>null);if(!b||typeof b.email!=='string'||!Array.isArray(b.stockIds)||b.stockIds.length>2000||b.stockIds.some((id:unknown)=>typeof id!=='string'||!id||id.length>200))return Response.json({error:'Sélection invalide'},{status:400});
 const db=getSqlite().connection;if(!db.prepare('SELECT 1 FROM members WHERE email=? AND deleted_at IS NULL').get(b.email))return Response.json({error:'Compte introuvable'},{status:404});
 try{const stocks=normalizeStocks(await atlasRead(process.env.ATLAS_API_KEY??'','/stocks'));const valid=new Set(stocks.map(s=>s.stockId));if(b.stockIds.some((id:string)=>!valid.has(id)))return Response.json({error:'Produit Atlas introuvable. Actualisez la sélection.'},{status:400});}catch{return Response.json({error:'Stock Atlas indisponible.'},{status:502})}
 db.exec('BEGIN IMMEDIATE');try{db.prepare('DELETE FROM member_products WHERE member_email=?').run(b.email);for(const id of new Set<string>(b.stockIds))db.prepare('INSERT INTO member_products(member_email,stock_id) VALUES(?,?)').run(b.email,id);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}
 return Response.json({ok:true});
}
