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
 return Response.json(simpleDashboard(await loadOperations(),month,undefined,from&&to?{from,to}:undefined),{headers:{'Cache-Control':'private, no-store'}});
}
