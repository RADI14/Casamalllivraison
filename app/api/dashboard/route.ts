import {getActor} from '../../access';
import {getDb} from '../../../db';
import {members,orders,adExpenses,commissionPayments} from '../../../db/schema';
import {commissionBalances} from '../../commission-payments';
import {teamStatistics,validDay} from '../../team-statistics';
import {financialReport} from '../../finance-rules';
import {normalizeEmail} from '../../rules';
import {confirmationTeamMetrics} from '../../confirmation-team-metrics';
import {getSqlite} from '../../../server/sqlite';
export async function GET(req:Request){
 const actor=await getActor();if(actor?.role!=='admin')return Response.json({error:'Accès administrateur requis'},{status:403});
 const q=new URL(req.url).searchParams,from=q.get('from')??'',to=q.get('to')??'';
 if((from&&!validDay(from))||(to&&!validDay(to))||(from&&to&&from>to))return Response.json({error:'Choisissez une période valide.'},{status:400});
 const db=getDb();const [team,records,expenses,payments]=await Promise.all([db.select().from(members),db.select().from(orders),db.select().from(adExpenses),db.select().from(commissionPayments)]);
 const confirmations=getSqlite().connection.prepare('SELECT order_id,status FROM whatsapp_conversations').all() as {order_id:string;status:string}[];
 const confirmation=confirmationTeamMetrics(team,records,confirmations,from,to);
 const stats=teamStatistics(team,records,from,to),finance=financialReport([],records,expenses,team,from,to),byEmail=new Map(finance.members.map(m=>[normalizeEmail(m.email),m]));
 return Response.json({...stats,settlement:commissionBalances(team,records,payments).totals,members:stats.members.map(m=>({...m,confirmation:confirmation.get(normalizeEmail(m.email)),business:byEmail.get(normalizeEmail(m.email))})),unassignedMemberAds:finance.unassignedMemberAds,asOf:new Date().toISOString()},{headers:{'Cache-Control':'private, no-store'}});
}
