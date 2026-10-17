import {randomBytes} from 'node:crypto';
import {getSqlite} from './sqlite';
import {tokenHash} from './passwords';
export const cookieName='casamall_session';
export const sessionSeconds=60*60*12;
export function createSession(email:string){const db=getSqlite().connection,now=Date.now();db.prepare('DELETE FROM app_sessions WHERE expires<=?').run(now);const token=randomBytes(32).toString('base64url');db.prepare('INSERT INTO app_sessions VALUES(?,?,?)').run(tokenHash(token),email,now+sessionSeconds*1000);return token}
export function sessionEmail(token:string|undefined){if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token))return null;const row=getSqlite().connection.prepare('SELECT email FROM app_sessions WHERE token_hash=? AND expires>?').get(tokenHash(token),Date.now());return typeof row?.email==='string'?row.email:null}
export function deleteSession(token:string|undefined){if(token)getSqlite().connection.prepare('DELETE FROM app_sessions WHERE token_hash=?').run(tokenHash(token))}
