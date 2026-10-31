import {getSqlite,type SqliteDatabase} from './sqlite.ts';
type Actor={email:string;role:'admin'|'agent'};
export function assertConversationAccess(id:string,actor:Actor,db=getSqlite()){
 const row=db.connection.prepare('SELECT c.*,o.created_email FROM whatsapp_conversations c JOIN orders o ON o.id=c.order_id WHERE c.id=?').get(id) as any;
 if(!row||(actor.role!=='admin'&&(row.assigned_email?row.assigned_email!==actor.email:row.created_email!==actor.email)))throw Error('Conversation introuvable.');
 return row;
}
export function assertEnrollmentAccess(orderId:string,actor:Actor,db=getSqlite()){
 const row=db.connection.prepare('SELECT created_email FROM orders WHERE id=?').get(orderId) as any;
 if(!row||(actor.role!=='admin'&&row.created_email!==actor.email))throw Error('Commande introuvable.');
 const existing=db.connection.prepare('SELECT id FROM whatsapp_conversations WHERE order_id=?').get(orderId) as any;
 if(existing)assertConversationAccess(existing.id,actor,db);
}
export function teamConversations(actor:Actor,db=getSqlite()){
 const where=actor.role==='admin'?'':'WHERE (c.assigned_email=? OR (c.assigned_email IS NULL AND o.created_email=?))';
 return db.connection.prepare(`SELECT c.*,o.payload,o.created_by AS order_author,
 (SELECT body FROM whatsapp_messages WHERE conversation_id=c.id ORDER BY rowid DESC LIMIT 1) AS preview
 FROM whatsapp_conversations c JOIN orders o ON o.id=c.order_id ${where} ORDER BY c.updated_at DESC LIMIT 500`).all(...(actor.role==='admin'?[]:[actor.email,actor.email])).map((r:any)=>({...r,payload:JSON.parse(r.payload)}));
}
export function confirmationTeam(db=getSqlite()){
 return db.connection.prepare('SELECT email,name FROM members WHERE active=1 AND deleted_at IS NULL ORDER BY name').all();
}
export function assignConversation(id:string,email:string|null,actor:Actor,db:SqliteDatabase=getSqlite()){
 if(actor.role!=='admin')throw Error('Accès administrateur requis.');
 assertConversationAccess(id,actor,db);
 if(email&&!db.connection.prepare('SELECT 1 FROM members WHERE email=? AND active=1 AND deleted_at IS NULL').get(email))throw Error('Collaboratrice inactive ou introuvable.');
 const at=new Date().toISOString();
 const result=db.connection.prepare('UPDATE whatsapp_conversations SET assigned_email=?,paused=1,updated_at=? WHERE id=? AND ai_lock_until<?').run(email,at,id,Date.now());
 if(!Number(result.changes))throw Error('Une opération est en cours. Réessayez après son traitement.');
 db.connection.prepare('INSERT INTO whatsapp_audit VALUES(?,?,?,?,?)').run(crypto.randomUUID(),id,actor.email,'assigned:'+(email??'unassigned'),at);
}
