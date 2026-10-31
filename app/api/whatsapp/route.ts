import {getActor} from '../../access';
import {sameOrigin} from '../../../server/request-origin';
import {connectionStatus,verifyMeta} from '../../../server/whatsapp-provider';
import {messages,enroll,setDisposition,setPaused,grantConsent,draftReply,sendMessage} from '../../../server/whatsapp-service';
import {assertConversationAccess,assertEnrollmentAccess,teamConversations,confirmationTeam,assignConversation} from '../../../server/whatsapp-team';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const actor=await getActor();if(!actor)return Response.json({error:'Accès refusé.'},{status:403});
 try{
  const id=new URL(req.url).searchParams.get('id');
  if(id){assertConversationAccess(id,actor);return Response.json({messages:messages(id)},{headers:{'Cache-Control':'no-store'}});}
  const connection=connectionStatus();
  return Response.json({connection:actor.role==='admin'?connection:{metaConfigured:connection.metaConfigured,aiConfigured:connection.aiConfigured,sendEnabled:connection.sendEnabled,autoReplyEnabled:connection.autoReplyEnabled},conversations:teamConversations(actor),team:actor.role==='admin'?confirmationTeam():[]},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Conversation introuvable.'},{status:404});}
}
export async function POST(req:Request){
 const actor=await getActor();if(!actor||!sameOrigin(req))return Response.json({error:'Accès refusé.'},{status:403});
 if(Number(req.headers.get('content-length')??0)>20000)return Response.json({error:'Requête trop grande.'},{status:413});
 try{
  const body=await req.text();if(body.length>20000)throw Error('Requête trop grande.');const b=JSON.parse(body);
  if(b.action==='check'){if(actor.role!=='admin')return Response.json({error:'Accès refusé.'},{status:403});return Response.json(await verifyMeta());}
  if(b.action==='enroll'){
   if(typeof b.orderId!=='string'||typeof b.consent!=='boolean')throw Error('Champs invalides.');
   assertEnrollmentAccess(b.orderId,actor);return Response.json({conversation:enroll(b.orderId,actor.email,b.consent)});
  }
  if(typeof b.id!=='string'||b.id.length>100)throw Error('Conversation invalide.');
  assertConversationAccess(b.id,actor);
  switch(b.action){
   case 'assign':if(b.email!==null&&(typeof b.email!=='string'||b.email.length>254))throw Error('Collaboratrice invalide.');assignConversation(b.id,b.email,actor);break;
   case 'consent':if(b.consent!==true)throw Error('Consentement requis.');grantConsent(b.id,actor.email);break;
   case 'status':setDisposition(b.id,b.status,actor.email);break;
   case 'pause':if(typeof b.paused!=='boolean')throw Error('Valeur invalide.');setPaused(b.id,b.paused,actor.email);break;
   case 'draft':return Response.json(await draftReply(b.id,actor.email));
   case 'send':if(!['template','text','buttons'].includes(b.kind))throw Error('Message invalide.');return Response.json(await sendMessage(b.id,actor.email,b.kind,typeof b.body==='string'?b.body:''));
   default:throw Error('Action inconnue.');
  }
  return Response.json({ok:true});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Erreur de confirmation.'},{status:409});}
}
