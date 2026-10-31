import {getActor} from '../../../access';
import {loadOperations} from '../../../../server/operations-data';
import {monthlyControls,monthRange} from '../../../business-controls-rules';
import {businessWorkbook} from '../../../../server/business-report-export';
export async function GET(req:Request){
 if((await getActor())?.role!=='admin')return Response.json({error:'Accès administrateur requis.'},{status:403});
 const month=new URL(req.url).searchParams.get('month')??'';try{monthRange(month)}catch{return Response.json({error:'Mois invalide.'},{status:400})}
 const input=await loadOperations(),report=monthlyControls(input,month),buffer=businessWorkbook(report,input);
 return new Response(new Uint8Array(buffer),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="fastlivraison-${month}.xlsx"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
