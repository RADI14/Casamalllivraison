import {audited} from '../../../server/audited-request';
import {getActor} from '../../access';
import {getSqlite} from '../../../server/sqlite';
import {sameOrigin} from '../../../server/request-origin';
import {cents} from '../../finance-rules';
import {validDay,moroccoDay} from '../../team-statistics';
async function handlePost(req:Request){
 const actor=await getActor();if(actor?.role!=='admin')return Response.json({error:'Accès administrateur requis'},{status:403});
 if(!sameOrigin(req))return Response.json({error:'Origine refusée'},{status:403});
 const b:any=await req.json().catch(()=>null),db=getSqlite().connection,now=new Date().toISOString();
 if(!b||typeof b.id!=='string'||!/^[0-9a-f-]{36}$/i.test(b.id))return Response.json({error:'Champs invalides'},{status:400});
 if(b.action==='void'){const r=db.prepare('UPDATE carrier_receipts SET voided_at=?,voided_by=? WHERE id=? AND voided_at IS NULL').run(now,actor.email,b.id);return Response.json({ok:true,updated:r.changes})}
 const amount=cents(b.amount);
 if(b.action!=='create'||amount===null||amount<=0||typeof b.reference!=='string'||!b.reference.trim()||b.reference.length>100||typeof b.date!=='string'||!validDay(b.date)||b.date>moroccoDay(new Date())||typeof b.note!=='string'||b.note.length>500||b.confirmed!==true)return Response.json({error:'Vérifiez le montant, la date et la confirmation de réception.'},{status:400});
 const ref=b.reference.trim().toLocaleUpperCase(),existing=db.prepare('SELECT * FROM carrier_receipts WHERE id=?').get(b.id);
 if(existing)return existing.reference===ref&&existing.amount_cents===amount&&existing.received_on===b.date&&existing.note===b.note?Response.json({ok:true}):Response.json({error:'Référence de saisie déjà utilisée.'},{status:409});
 try{db.prepare('INSERT INTO carrier_receipts(id,reference,amount_cents,received_on,note,created_by,created_at) VALUES(?,?,?,?,?,?,?)').run(b.id,ref,amount,b.date,b.note,actor.email,now)}catch(e){if(String(e).includes('UNIQUE'))return Response.json({error:'Cette référence existe déjà. Consultez l’historique.'},{status:409});throw e}
 return Response.json({ok:true},{status:201});
}

export const POST=audited(handlePost);
