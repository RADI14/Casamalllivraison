import {audited} from '../../../server/audited-request';
import {sameOrigin} from '../../../server/request-origin';
import {env} from '../../../server/runtime';
import {getActor,orderScope} from '../../access';
import {syncAtlasBatch} from '../../../server/atlas-sync';
async function handlePost(req:Request){
 const a=await getActor();if(!a)return Response.json({error:'Accès non autorisé'},{status:403});if(!sameOrigin(req))return Response.json({error:'Origine refusée'},{status:403});const key=env.ATLAS_API_KEY;if(!key)return Response.json({error:'Connectez Atlas pour synchroniser les livraisons.'},{status:409});
 const body:any=await req.json().catch(()=>({}));const cursor=body?.cursor;if(cursor!==undefined&&(typeof cursor!=='string'||!cursor||cursor.length>200))return Response.json({error:'Curseur invalide'},{status:400});
 const result=await syncAtlasBatch(key,cursor,orderScope(a));
 return Response.json(result,{status:result.retryAfterMs?429:200,headers:result.retryAfterMs?{'Retry-After':String(Math.ceil(result.retryAfterMs/1000))}:undefined});
}
export const POST=audited(handlePost);
