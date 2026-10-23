import {getActor} from '../../access';
import {getDb} from '../../../db';
import {members,orders,adExpenses} from '../../../db/schema';
import {moroccoDay,validDay} from '../../team-statistics';
import {agentDailyTrends} from '../../agent-daily-trends';
export async function GET(req:Request){
 const actor=await getActor();if(actor?.role!=='admin')return Response.json({error:'Accès administrateur requis'},{status:403});
 const end=new URL(req.url).searchParams.get('to')||moroccoDay(new Date());
 if(!validDay(end)||end>moroccoDay(new Date()))return Response.json({error:'Choisissez une période valide.'},{status:400});
 const db=getDb();const [team,records,expenses]=await Promise.all([db.select().from(members),db.select().from(orders),db.select().from(adExpenses)]);
 return Response.json(agentDailyTrends(team,records,expenses,end),{headers:{'Cache-Control':'private, no-store'}});
}
