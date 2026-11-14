import type {DatabaseSync} from 'node:sqlite';
import {backfillYoucanCod} from './youcan-cod-backfill.ts';
export async function runYoucanCodBackfillBatch(db:DatabaseSync,store:string,readOrder:(id:string)=>Promise<any>,now=Date.now()){
 db.prepare('INSERT INTO youcan_cod_backfill_jobs(store_id) VALUES(?) ON CONFLICT DO NOTHING').run(store);
 const lock=db.prepare('UPDATE youcan_cod_backfill_jobs SET lease_until=? WHERE store_id=? AND done=0 AND lease_until<=?').run(now+60000,store,now);
 if(!lock.changes){const job=db.prepare('SELECT done,adjusted,review_refs FROM youcan_cod_backfill_jobs WHERE store_id=?').get(store)!;return {done:!!job.done,adjusted:Number(job.adjusted),review:JSON.parse(String(job.review_refs)).length,busy:!job.done,failed:0}}
 const job=db.prepare('SELECT * FROM youcan_cod_backfill_jobs WHERE store_id=?').get(store)!;
 try{
  const batch=await backfillYoucanCod(db,store,readOrder,String(job.after_id));
  const refs=[...new Set([...JSON.parse(String(job.review_refs)),...batch.review])];
  const done=!batch.failed.length&&!batch.next;
  db.prepare('UPDATE youcan_cod_backfill_jobs SET after_id=?,done=?,lease_until=0,adjusted=adjusted+?,review_refs=? WHERE store_id=?').run(batch.failed.length?String(job.after_id):batch.next??String(job.after_id),done?1:0,batch.adjusted,JSON.stringify(refs),store);
  return {done,adjusted:Number(job.adjusted)+batch.adjusted,review:refs.length,busy:false,failed:batch.failed.length};
 }catch(e){db.prepare('UPDATE youcan_cod_backfill_jobs SET lease_until=0 WHERE store_id=?').run(store);throw e}
}
