import {sameOrigin} from '../../../../server/request-origin';
import {getSqlite} from '../../../../server/sqlite';
import {sameSecret,verifyPassword,hashPassword} from '../../../../server/passwords';
import {createSession,cookieName,sessionSeconds} from '../../../../server/sessions';
import {NextResponse} from 'next/server';
export const runtime='nodejs';
export async function POST(req:Request){
 if(!sameOrigin(req))return NextResponse.json({error:'Origine refusée'}, {status:403});
 const b:any=await req.json().catch(()=>null);if(typeof b?.email!=='string'||b.email.length>254||typeof b.password!=='string'||b.password.length>128)return NextResponse.json({error:'Invalid credentials'}, {status:400});
 const owner=process.env.OWNER_EMAIL?.trim().toLowerCase(),adminPassword=process.env.ADMIN_PASSWORD;if(!owner||!adminPassword||adminPassword.length<12||!process.env.SQLITE_PATH)return NextResponse.json({error:'Hosting setup required'}, {status:503});
 const email=b.email.trim().toLowerCase(),db=getSqlite().connection,now=Date.now();
 // Global and account limits cannot be bypassed by spoofing proxy IP headers.
 const keys=['global','email:'+email];for(const key of keys){const row=db.prepare('SELECT * FROM app_login_attempts WHERE key=?').get(key);if(row&&Number(row.reset_at)>now&&Number(row.attempts)>=(key==='global'?100:10))return NextResponse.json({error:'Too many attempts. Try again in 15 minutes.'},{status:429});}
 for(const key of keys)db.prepare('INSERT INTO app_login_attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<=? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END').run(key,now+900000,now,now);
 db.prepare('DELETE FROM app_login_attempts WHERE reset_at<?').run(now-900000);
 let ok=false;if(email===owner)ok=sameSecret(b.password,adminPassword);else{const row=db.prepare('SELECT c.password_hash FROM app_credentials c JOIN members m ON m.email=c.email WHERE c.email=? AND m.active=1').get(email);ok=await verifyPassword(b.password,typeof row?.password_hash==='string'?row.password_hash:await hashPassword('unusable-dummy-password'));}
 if(!ok)return NextResponse.json({error:'Invalid email or password.'},{status:401});db.prepare('DELETE FROM app_login_attempts WHERE key=?').run('email:'+email);
 const res=NextResponse.json({ok:true});res.cookies.set(cookieName,createSession(email),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:sessionSeconds});res.headers.set('Cache-Control','no-store');return res;
}
