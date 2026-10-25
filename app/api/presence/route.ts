import {cookies} from 'next/headers';
import {getActor} from '../../access';
import {sameOrigin} from '../../../server/request-origin';
import {cookieName} from '../../../server/sessions';
import {getSqlite} from '../../../server/sqlite';
import {readTeamPresence,recordPresence} from '../../../server/team-presence';
const out=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(req:Request){
 if(!sameOrigin(req))return out({error:'Origine refusée'},403);
 const actor=await getActor();if(!actor)return out({error:'Accès non autorisé'},403);
 const token=(await cookies()).get(cookieName)?.value;
 if(!token||!recordPresence(getSqlite().connection,token))return out({error:'Accès non autorisé'},403);
 return out({ok:true});
}
export async function GET(){
 const actor=await getActor();if(actor?.role!=='admin')return out({error:'Accès administrateur requis'},403);
 const now=Date.now();return out({members:readTeamPresence(getSqlite().connection,now),asOf:now});
}
