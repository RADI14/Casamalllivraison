import {refreshedAtlasStocks} from '../../../server/atlas-stock-refresh';
import {isOpenParcel} from '../../business-controls-rules';
import {purchaseCost} from '../../purchase-cost';
import {getActor} from '../../access';
import {loadOperations} from '../../../server/operations-data';
import {simpleDashboard} from '../../simple-dashboard-rules';
import {moroccoDay,validDay} from '../../team-statistics';
export async function GET(req:Request){
 if((await getActor())?.role!=='admin')return Response.json({error:'Accès administrateur requis'},{status:403});
 const params=new URL(req.url).searchParams,month=params.get('month')||moroccoDay(new Date()).slice(0,7);
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return Response.json({error:'Mois invalide.'},{status:400});
 const from=params.get('from'),to=params.get('to');
 if((from!==null||to!==null)&&(!from||!to||!validDay(from)||!validDay(to)||from>to))return Response.json({error:'Période invalide.'},{status:400});
 const key=process.env.ATLAS_API_KEY;
 const [input,snapshot]=await Promise.all([loadOperations(),key?refreshedAtlasStocks(key).catch(()=>null):null]);
 const unitCosts=new Map(input.products.map(product=>[product.sku,product.costCents]));
 const stock=inventoryValue((snapshot?.stocks??[]).filter(row=>row.available>0).map(row=>{
  const cost=row.sku?unitCosts.get(row.sku):null;
  return cost==null?null:cost*row.available;
 }));
 const transit=inventoryValue(input.orders.filter(isOpenParcel).map(purchaseCost));
 const inventory={stock:snapshot?stock:null,stockAsOf:snapshot?.updatedAt,transit};
 return Response.json({...simpleDashboard(input,month,undefined,from&&to?{from,to}:undefined),inventory},{headers:{'Cache-Control':'private, no-store'}});
}

function inventoryValue(costs:(number|null)[]){
 let cents=0,missing=0;
 for(const cost of costs){
  if(cost===null||!Number.isSafeInteger(cost)||cost<0)missing++;
  else cents+=cost;
 }
 return {cents,missing};
}
