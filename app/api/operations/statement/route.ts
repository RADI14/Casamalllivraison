import {getActor} from '../../../access';
import {loadOperations} from '../../../../server/operations-data';
import {agentStatement} from '../../../operations-rules';
import {validDay} from '../../../team-statistics';
import {statementXlsx,statementHtml} from '../../../../server/statement-export';
export async function GET(req:Request){
 if((await getActor())?.role!=='admin')return Response.json({error:'Accès administrateur requis'},{status:403});
 const q=new URL(req.url).searchParams,from=q.get('from')??'',to=q.get('to')??'',format=q.get('format')??'json';
 if((from&&!validDay(from))||(to&&!validDay(to))||(from&&to&&from>to)||!['json','xlsx','print'].includes(format))return Response.json({error:'Champs invalides'},{status:400});
 const statement=agentStatement(await loadOperations(),q.get('email')??'',from,to);if(!statement)return Response.json({error:'Collaboratrice introuvable'},{status:404});
 const headers={'Cache-Control':'private, no-store'};
 if(format==='print')return new Response(statementHtml(statement),{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
 if(format==='xlsx')return new Response(new Uint8Array(statementXlsx(statement)),{headers:{...headers,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="releve-collaboratrice.xlsx"'}});
 return Response.json(statement,{headers});
}
