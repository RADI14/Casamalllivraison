import {businessAnalytics} from '../../business-analytics';
import {getActor} from '../../access';
import {getDb} from '../../../db';
import {products,orders,adExpenses,members} from '../../../db/schema';
import {financialReport,transportCost} from '../../finance-rules';
import {validDay,moroccoDay} from '../../team-statistics';
export async function GET(req:Request){
 const a=await getActor();if(a?.role!=='admin')return Response.json({error:'Accès administrateur requis'},{status:403});
 const q=new URL(req.url).searchParams,from=q.get('from')??'',to=q.get('to')??'';
 if((from&&!validDay(from))||(to&&!validDay(to))||(from&&to&&from>to))return Response.json({error:'Choisissez une période valide.'},{status:400});
 const db=getDb();const [p,o,e,m]=await Promise.all([db.select().from(products),db.select().from(orders),db.select().from(adExpenses),db.select().from(members)]);
 const report=financialReport(p,o,e,m,from,to);
 // Preserve historical accounting totals; hide removed people only in dashboard views.
 if(q.get('view')==='dashboard'){
  const removed=new Set(m.filter(member=>member.deletedAt).map(member=>member.email.trim().toLowerCase()));
  report.members=report.members.filter(member=>!removed.has(member.email.trim().toLowerCase()));
  report.adBreakdown=report.adBreakdown.filter(row=>!removed.has(row.memberEmail.trim().toLowerCase()));
 }
 return Response.json({...report,analytics:businessAnalytics(o,e,from,to),shipments:o.filter(o=>o.tracking&&(!from||moroccoDay(o.createdAt)>=from)&&(!to||moroccoDay(o.createdAt)<=to)).map(o=>({id:o.id,tracking:o.tracking,client:JSON.parse(o.payload).fullname,product:JSON.parse(o.payload).product,...transportCost(o),actual:o.transportActualCents}))},{headers:{'Cache-Control':'private, no-store'}});
}
