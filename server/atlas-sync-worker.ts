import {randomUUID} from 'node:crypto';
import {getSqlite} from './sqlite';
import {auditActor} from './audit-context';
import {syncAtlasBatch} from './atlas-sync';
import {startAtlasSyncLoop} from './atlas-sync-loop';
const state=globalThis as typeof globalThis & {atlasSyncWorkerStarted?:boolean};
export function startAtlasSyncWorker(){
 if(state.atlasSyncWorkerStarted||process.env.ATLAS_AUTO_SYNC==='false'||!process.env.ATLAS_API_KEY)return;
 state.atlasSyncWorkerStarted=true;
 const owner=randomUUID();
 startAtlasSyncLoop(async cursor=>auditActor.run('system:atlas-sync',async()=>{
  const db=getSqlite().connection,now=Date.now();
  // A database lease also prevents overlapping workers during rolling deployments.
  db.exec('CREATE TABLE IF NOT EXISTS atlas_sync_lease (id INTEGER PRIMARY KEY CHECK(id=1),owner TEXT NOT NULL,expires INTEGER NOT NULL)');
  const lease=db.prepare('INSERT INTO atlas_sync_lease(id,owner,expires) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,expires=excluded.expires WHERE atlas_sync_lease.expires<? OR atlas_sync_lease.owner=? RETURNING owner').get(owner,now+180000,now,owner);
  if(!lease)return {nextCursor:cursor??null,retryAfterMs:30000};
  try{return await syncAtlasBatch(process.env.ATLAS_API_KEY!,cursor)}finally{db.prepare('DELETE FROM atlas_sync_lease WHERE id=1 AND owner=?').run(owner)}
 }));
 console.info('[atlas-sync] Background synchronization enabled (60s between full scans).');
}
