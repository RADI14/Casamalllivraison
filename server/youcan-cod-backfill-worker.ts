import {getSqlite} from './sqlite';
import {connection,storeId,secret,youcanRequest} from './youcan';
import {runYoucanCodBackfillBatch} from './youcan-cod-backfill-job';
let started=false;
export function startYoucanCodBackfillWorker(){
 if(started||process.env.YOUCAN_COD_BACKFILL_AUTO==='false'||!storeId()||!secret())return;started=true;
 const tick=async()=>{
  let delay=60000;
  try{
   const db=getSqlite().connection;
   const state=db.prepare('SELECT done FROM youcan_cod_backfill_jobs WHERE store_id=?').get(storeId());if(state?.done)return;
   const token=connection(db),result=await runYoucanCodBackfillBatch(db,storeId(),id=>youcanRequest(token,'/orders/'+encodeURIComponent(id)));
   console.info('[youcan-cod-backfill]',JSON.stringify(result));
   if(result.done)return;if(!result.busy&&!result.failed)delay=2000;
  }catch{console.info('[youcan-cod-backfill] Pending; retrying when the YouCan connection is available.')}
  setTimeout(()=>{void tick()},delay).unref();
 };
 setTimeout(()=>{void tick()},5000).unref();
}
