import {getActor} from '../../access';
import {getSqlite} from '../../../server/sqlite';
import {loadOperations} from '../../../server/operations-data';
import {agingAlerts,monthlyControls,monthRange} from '../../business-controls-rules';
import {atlasRead,normalizeStocks} from '../../atlas-stock';
import {sameOrigin} from '../../../server/request-origin';
const out=(body:any,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:Request){
 if((await getActor())?.role!=='admin')return out({error:'Accès administrateur requis.'},403);
 const q=new URL(req.url).searchParams,month=q.get('month')??new Date().toISOString().slice(0,7);try{monthRange(month)}catch{return out({error:'Mois invalide.'},400)}
 const sql=getSqlite().connection,settings=sql.prepare('SELECT * FROM business_settings WHERE id=1').get() as any;
 if(q.get('view')==='audit'){
  const raw=q.get('before'),before=raw?Number(raw):Number.MAX_SAFE_INTEGER;if(!Number.isSafeInteger(before)||before<1)return out({error:'Page invalide.'},400);
  const entity=q.get('entity')??'',allowed=['orders','products','ad_expenses','commission_payments','members','settings'];if(entity&&!allowed.includes(entity))return out({error:'Filtre invalide.'},400);
  const rows=sql.prepare('SELECT * FROM audit_events WHERE id<?'+(entity?' AND entity=?':'')+' ORDER BY id DESC LIMIT 51').all(...(entity?[before,entity]:[before])) as any[];
  return out({events:rows.slice(0,50),next:rows.length>50?rows[49].id:null});
 }
 const input=await loadOperations(),report=monthlyControls(input,month);let stocks:any[]=[],stockError:string|null=null,stockAsOf:string|null=null;
 if(process.env.ATLAS_API_KEY){try{stocks=normalizeStocks(await atlasRead(process.env.ATLAS_API_KEY,'/stocks'));stockAsOf=new Date().toISOString()}catch{stockError='Atlas indisponible : stock non vérifié.'}}else stockError='Connexion Atlas non configurée.';
 return out({settings,alerts:agingAlerts(input.orders,settings),stock:{error:stockError,asOf:stockAsOf,low:stocks.filter(s=>s.available<=settings.stock_threshold)},report:{...report,orders:undefined},asOf:new Date().toISOString()});
}
export async function POST(req:Request){
 const actor=await getActor();if(actor?.role!=='admin'||!sameOrigin(req))return out({error:'Accès refusé.'},403);let b:any;try{b=await req.json()}catch{return out({error:'Champs invalides.'},400)}
 if(!Number.isInteger(b.age_days)||b.age_days<1||b.age_days>365||!Number.isInteger(b.sync_days)||b.sync_days<1||b.sync_days>90||!Number.isInteger(b.stock_threshold)||b.stock_threshold<0||b.stock_threshold>100000)return out({error:'Seuils invalides.'},400);
 const sql=getSqlite().connection,old=sql.prepare('SELECT * FROM business_settings WHERE id=1').get();sql.exec('BEGIN IMMEDIATE');try{sql.prepare('UPDATE business_settings SET age_days=?,sync_days=?,stock_threshold=? WHERE id=1').run(b.age_days,b.sync_days,b.stock_threshold);sql.prepare("INSERT INTO audit_events(entity,entity_id,action,actor,before_json,after_json) VALUES('settings','1','update',?,?,?)").run(actor.email,JSON.stringify(old),JSON.stringify(b));sql.exec('COMMIT')}catch(e){sql.exec('ROLLBACK');throw e}return out({ok:true});
}
