import type {DatabaseSync} from 'node:sqlite';
import {tokenHash} from './passwords.ts';
import {presenceTimeoutMs,summarizePresence} from '../app/presence-rules.ts';

export function recordPresence(db:DatabaseSync,token:string,now=Date.now()){
 // Identity comes only from the authenticated session, never from the request body.
 const result=db.prepare(`INSERT INTO team_presence(session_hash,email,started_at,last_seen)
 SELECT token_hash,email,?,? FROM app_sessions WHERE token_hash=? AND expires>?
 ON CONFLICT(session_hash) DO UPDATE SET
 started_at=CASE WHEN team_presence.last_seen<=?-? THEN excluded.started_at ELSE team_presence.started_at END,
 last_seen=excluded.last_seen`).run(now,now,tokenHash(token),now,now,presenceTimeoutMs);
 return result.changes>0;
}
export function readTeamPresence(db:DatabaseSync,now=Date.now()){
 const team=db.prepare('SELECT email,active FROM members WHERE deleted_at IS NULL').all() as {email:string;active:number}[];
 const signals=db.prepare(`SELECT p.email,p.started_at AS startedAt,p.last_seen AS lastSeen,
 CASE WHEN s.expires>? THEN 1 ELSE 0 END AS validSession
 FROM team_presence p LEFT JOIN app_sessions s ON s.token_hash=p.session_hash AND s.email=p.email`).all(now) as {email:string;startedAt:number;lastSeen:number;validSession:number}[];
 const grouped=new Map<string,typeof signals>();for(const s of signals){const own=grouped.get(s.email)??[];own.push(s);grouped.set(s.email,own)}
 return team.map(m=>summarizePresence(m.email,m.active===1,(grouped.get(m.email)??[]).map(s=>({...s,validSession:!!s.validSession})),now));
}
