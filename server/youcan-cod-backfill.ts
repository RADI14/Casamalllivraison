import type {DatabaseSync} from 'node:sqlite';
export async function backfillYoucanCod(db:DatabaseSync,store:string,readOrder:(id:string)=>Promise<any>,afterId=''){
 const rows=db.prepare('SELECT id,remote_id,reference,payload,prepared_payload FROM youcan_orders WHERE store_id=? AND id>? AND local_order_id IS NULL AND duplicate_of IS NULL ORDER BY id LIMIT 5').all(store,afterId);
 const results=await Promise.all(rows.map(async row=>{
  try{
   const response=await readOrder(String(row.remote_id)),source=response?.data??response,old=JSON.parse(String(row.payload)),prepared=row.prepared_payload?JSON.parse(String(row.prepared_payload)):null;
   const base=Number(source?.total),currency=source?.currency??source?.customer_currency?.code??'MAD',target=Math.round(base*100+100)/100;
   if(source?.id!==row.remote_id||old.currency!=='MAD'||currency!=='MAD'||!Number.isFinite(base)||base<=0||target>1000000||![base,target].includes(old.price))return {kind:'review',reference:String(row.reference)};
   const next={...old,price:target},nextPrepared=prepared?{...prepared}:null;
   if(nextPrepared){
    const price=Number(nextPrepared.price);
    if(!Number.isFinite(price)||price<=0)return {kind:'review',reference:String(row.reference)};
    // Preserve a manually corrected 100 DH when the source was 99 DH.
    if(price===base||old.price===base&&price!==target)nextPrepared.price=Math.round(price*100+100)/100;
    if(nextPrepared.price>1000000)return {kind:'review',reference:String(row.reference)};
   }
   const changed=next.price!==old.price||nextPrepared?.price!==prepared?.price;
   return {kind:changed?'adjusted':'already',row,payload:JSON.stringify(next),prepared:nextPrepared?JSON.stringify(nextPrepared):null};
  }catch{return {kind:'failed',reference:String(row.reference)}}
 }));
 let adjusted=0,already=0;const review:string[]=[],failed:string[]=[];
 db.exec('BEGIN IMMEDIATE');
 try{
  for(const result of results){
   if(result.kind==='review'){review.push(result.reference!);continue}if(result.kind==='failed'){failed.push(result.reference!);continue}
   if(result.kind==='already'){already++;continue}
   const row=result.row!;
   const update=db.prepare('UPDATE youcan_orders SET payload=?,prepared_payload=?,review_updated_at=? WHERE id=? AND store_id=? AND local_order_id IS NULL AND duplicate_of IS NULL AND payload=? AND prepared_payload IS ?').run(result.payload!,result.prepared!,new Date().toISOString(),row.id,store,row.payload,row.prepared_payload);
   if(update.changes)adjusted++;else failed.push(String(row.reference));
  }
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e}
 return {adjusted,already,review,failed,next:rows.length===5?String(rows[rows.length-1].id):null};
}
