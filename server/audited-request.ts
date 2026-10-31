import {getActor} from '../app/access';
import {auditActor} from './audit-context';
export function audited(handler:(req:Request)=>Promise<Response>){return async(req:Request)=>{const actor=await getActor();return auditActor.run(actor?.email??'system',()=>handler(req));};}
