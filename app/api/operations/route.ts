import {getActor} from '../../access';
import {loadOperations} from '../../../server/operations-data';
import {operationsReport} from '../../operations-rules';
export async function GET(req:Request){
 if((await getActor())?.role!=='admin')return Response.json({error:'Accès administrateur requis'},{status:403});
 const q=new URL(req.url).searchParams;
 try{return Response.json(operationsReport(await loadOperations(),q.get('from')??'',q.get('to')??''),{headers:{'Cache-Control':'private, no-store'}})}catch(e){if(e instanceof Error&&/période|Période/.test(e.message))return Response.json({error:e.message},{status:400});throw e}
}
