import {getActor} from '../../access';
import {sameOrigin} from '../../../server/request-origin';
import {getSqlite} from '../../../server/sqlite';
import {allowedStockIds} from '../../../server/member-products';
import {atlasProductCatalogue} from '../../../server/atlas-product-catalog';
export async function GET(req:Request){
 if((await getActor())?.role!=='admin')return Response.json({error:'Accès administrateur requis'},{status:403});
 const email=new URL(req.url).searchParams.get('email')??'';
 try{const catalogue=await atlasProductCatalogue(process.env.ATLAS_API_KEY??'');return Response.json({selected:[...allowedStockIds(email)],...catalogue},{headers:{'Cache-Control':'private, no-store'}})}catch{return Response.json({error:'Catalogue en cours d’actualisation. Réessayez dans quelques instants.'},{status:503,headers:{'Retry-After':'30'}})}
}
export async function POST(req:Request){
 if((await getActor())?.role!=='admin'||!sameOrigin(req))return Response.json({error:'Accès refusé'},{status:403});
 const b:any=await req.json().catch(()=>null);if(!b||typeof b.email!=='string'||!Array.isArray(b.stockIds)||b.stockIds.length>2000||b.stockIds.some((id:unknown)=>typeof id!=='string'||!id||id.length>200))return Response.json({error:'Sélection invalide'},{status:400});
 const db=getSqlite().connection;if(!db.prepare('SELECT 1 FROM members WHERE email=? AND deleted_at IS NULL').get(b.email))return Response.json({error:'Compte introuvable'},{status:404});
 try{const catalogue=await atlasProductCatalogue(process.env.ATLAS_API_KEY??'');const valid=new Set([...catalogue.products.map(s=>s.stockId),...allowedStockIds(b.email)]);if(b.stockIds.some((id:string)=>!valid.has(id)))return Response.json({error:'Produit Atlas introuvable. Actualisez la sélection.'},{status:400});}catch{return Response.json({error:'Catalogue en cours d’actualisation. Réessayez dans quelques instants.'},{status:503,headers:{'Retry-After':'30'}})}
 db.exec('BEGIN IMMEDIATE');try{db.prepare('DELETE FROM member_products WHERE member_email=?').run(b.email);for(const id of new Set<string>(b.stockIds))db.prepare('INSERT INTO member_products(member_email,stock_id) VALUES(?,?)').run(b.email,id);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}
 return Response.json({ok:true});
}
