import {env} from '../server/runtime';
import {getChatGPTUser} from './chatgpt-auth';
import {getDb} from '../db';
import {members,orders} from '../db/schema';
import {eq} from 'drizzle-orm';
import {normalizeEmail,type Actor} from './rules';
export async function getActor(){
 const u=await getChatGPTUser();if(!u)return null;
 const email=normalizeEmail(u.email),owner=(env as unknown as Record<string,string>).OWNER_EMAIL;
 if(owner&&email===normalizeEmail(owner))return {...u,email,role:'admin' as const};
 const [m]=await getDb().select().from(members).where(eq(members.email,email));
 return m?.active===1&&!m.deletedAt?{...u,email,displayName:m.name,role:'agent' as const}:null;
}
export function orderScope(actor:Actor){return actor.role==='admin'?undefined:eq(orders.createdEmail,actor.email)}
