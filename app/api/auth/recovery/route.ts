import {NextResponse} from 'next/server';
import {sameOrigin} from '../../../../server/request-origin';
import {getSqlite} from '../../../../server/sqlite';
import {tokenHash} from '../../../../server/passwords';
export const runtime='nodejs';
// No password or token is returned. An authenticated administrator must verify
// the requester's identity separately before changing a team account password.
export async function POST(req:Request){
 if(!sameOrigin(req))return NextResponse.json({error:'Origine refusée'},{status:403});
 const b:any=await req.json().catch(()=>null);
 if(typeof b?.email!=='string'||b.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim()))return NextResponse.json({error:'Invalid recovery email.'},{status:400});
 const email=b.email.trim().toLowerCase(),db=getSqlite().connection,now=Date.now();
 const response=()=>NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 const keys=['recovery:global','recovery:'+tokenHash(email)];
 db.exec('BEGIN IMMEDIATE');
 try{
  for(const key of keys){const row=db.prepare('SELECT attempts,reset_at FROM app_login_attempts WHERE key=?').get(key);if(row&&Number(row.reset_at)>now&&Number(row.attempts)>=(key==='recovery:global'?50:3)){db.exec('COMMIT');return response()}}
  for(const key of keys)db.prepare('INSERT INTO app_login_attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<=? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END').run(key,now+3600000,now,now);
  db.prepare('DELETE FROM app_login_attempts WHERE key LIKE ? AND reset_at<?').run('recovery:%',now);
  db.prepare('INSERT INTO app_password_recovery(email,requested_at) SELECT email,? FROM members WHERE email=? AND active=1 ON CONFLICT(email) DO NOTHING').run(new Date(now).toISOString(),email);
  db.exec('COMMIT');return response();
 }catch(e){db.exec('ROLLBACK');throw e}
}
