import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {tokenHash} from '../server/passwords.ts';
import {recordPresence,readTeamPresence} from '../server/team-presence.ts';
import {startPresenceHeartbeat} from '../app/presence-heartbeat.ts';
import {presenceTimeoutMs,presenceIdleMs} from '../app/presence-rules.ts';
function database(){const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE members(email TEXT PRIMARY KEY,active INTEGER,deleted_at TEXT);
 CREATE TABLE app_sessions(token_hash TEXT PRIMARY KEY,email TEXT,expires INTEGER);
 INSERT INTO members VALUES('a@test.com',1,NULL),('b@test.com',1,NULL),('s@test.com',0,NULL),('removed@test.com',0,'removed');`);db.exec(readFileSync(new URL('../drizzle/0014_team_presence.sql',import.meta.url),'utf8'));return db}
const now=2000000000000;
function session(db,token,email='a@test.com',expires=now+1000000){db.prepare('INSERT INTO app_sessions VALUES(?,?,?)').run(tokenHash(token),email,expires)}
test('duration continues on heartbeat, expires at 90 seconds and restarts after a gap',()=>{
 const db=database();session(db,'one');assert.ok(recordPresence(db,'one',now));recordPresence(db,'one',now+30000);
 let a=readTeamPresence(db,now+60000).find(x=>x.email==='a@test.com');assert.equal(a.online,true);assert.equal(a.startedAt,now);
 a=readTeamPresence(db,now+120000).find(x=>x.email==='a@test.com');assert.equal(a.online,false);assert.equal(a.startedAt,null);assert.equal(a.lastSeen,now+30000);
 recordPresence(db,'one',now+120000);assert.equal(readTeamPresence(db,now+120000)[0].startedAt,now+120000);db.close();
});
test('multiple sessions, logout, expired sessions, suspension and removal are handled without exposing tokens',()=>{
 const db=database();session(db,'one');session(db,'two');session(db,'expired','b@test.com',now-1);session(db,'suspended','s@test.com');
 recordPresence(db,'one',now);recordPresence(db,'two',now+30000);assert.equal(recordPresence(db,'expired',now),false);recordPresence(db,'suspended',now);
 db.prepare('DELETE FROM app_sessions WHERE token_hash=?').run(tokenHash('one'));
 let list=readTeamPresence(db,now+40000);assert.equal(list[0].online,true);assert.equal(list[0].startedAt,now+30000);assert.equal(list.find(x=>x.email==='s@test.com').online,false);assert.ok(!list.some(x=>x.email==='removed@test.com'));
 db.prepare('DELETE FROM app_sessions WHERE token_hash=?').run(tokenHash('two'));
 list=readTeamPresence(db,now+40000);assert.equal(list[0].online,false);assert.equal(list[0].lastSeen,now+30000);assert.deepEqual(Object.keys(list[0]).sort(),['email','lastSeen','online','startedAt']);db.close();
});
test('client signals stop for hidden tabs and inactivity; typing resumes them; cleanup removes listeners',async()=>{
 let time=now,count=0,timer;const win=new EventTarget(),doc=new EventTarget();doc.visibilityState='visible';win.setInterval=fn=>(timer=fn,1);win.clearInterval=()=>{timer=null};
 const stop=startPresenceHeartbeat(doc,win,async()=>{count++},()=>time);await Promise.resolve();assert.equal(count,1);
 time+=30000;await timer();assert.equal(count,2);doc.visibilityState='hidden';time+=30000;await timer();assert.equal(count,2);
 doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));await Promise.resolve();assert.equal(count,3);
 time+=presenceIdleMs;await timer();assert.equal(count,3);win.dispatchEvent(new Event('keydown'));await Promise.resolve();assert.equal(count,4);
 stop();time+=presenceTimeoutMs;win.dispatchEvent(new Event('keydown'));await Promise.resolve();assert.equal(count,4);assert.equal(timer,null);
});
