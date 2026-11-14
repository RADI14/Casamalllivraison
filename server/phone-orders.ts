import type {DatabaseSync} from 'node:sqlite';
import {duplicatePhone} from '../app/duplicate-order-rules.ts';
const decode=(raw:unknown)=>{try{return JSON.parse(String(raw))}catch{return {}}};
const phones=(p:any)=>[...new Set([duplicatePhone(p.phone),duplicatePhone(p.phone2)].filter(p=>/^0[67]\d{8}$/.test(p)))];
function activeParcels(db:DatabaseSync){
 return db.prepare("SELECT id,payload,atlas_state_name AS state FROM orders WHERE status!='cancelled' AND atlas_state IS NOT 17").all().filter(o=>{
  const state=String(o.state??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return !['livre','livree','delivered','annule','annulee','cancelled','canceled','retourne','retournee','returned'].includes(state);
 });
}
export function activePhoneOrder(db:DatabaseSync,p:any,excludeWebsiteId?:string){
 const wanted=new Set(phones(p));if(!wanted.size)return null;
 const parcel=activeParcels(db).find(o=>phones(decode(o.payload)).some(phone=>wanted.has(phone)));
 if(parcel)return {kind:'order',id:String(parcel.id)};
 const pending=db.prepare("SELECT id,payload,prepared_payload FROM youcan_orders WHERE local_order_id IS NULL AND duplicate_of IS NULL AND review_status!='cancelled' AND store_id=? ORDER BY received_at,id").all(process.env.YOUCAN_STORE_ID??'');
 const row=pending.find(o=>o.id!==excludeWebsiteId&&!decode(o.payload).blocked&&phones(decode(o.prepared_payload??o.payload)).some(phone=>wanted.has(phone)));
 return row?{kind:'website',id:String(row.id)}:null;
}
// Keep repeated source IDs for audit/replay, but expose and process one active
// order per normalized phone. A suppressed duplicate never reappears when the
// original is delivered; a genuinely new order after delivery is allowed.
export function reconcileWebsiteDuplicates(db:DatabaseSync,store:string){
 db.exec('BEGIN IMMEDIATE');
 try{
  const seen=new Map<string,string>();
  for(const o of activeParcels(db))for(const phone of phones(decode(o.payload)))if(!seen.has(phone))seen.set(phone,'order:'+o.id);
  const rows=db.prepare('SELECT id,payload,prepared_payload,review_status,local_order_id,duplicate_of FROM youcan_orders WHERE store_id=? ORDER BY received_at,id').all(store);
  let count=0;
  for(const row of rows){
   if(row.local_order_id||row.duplicate_of||row.review_status==='cancelled'||decode(row.payload).blocked)continue;
   const numbers=phones(decode(row.prepared_payload??row.payload));
   const duplicate=numbers.map(phone=>seen.get(phone)).find(Boolean);
   if(duplicate){db.prepare('UPDATE youcan_orders SET duplicate_of=? WHERE id=? AND local_order_id IS NULL AND duplicate_of IS NULL').run(duplicate,row.id);count++;}
   else for(const phone of numbers)seen.set(phone,'website:'+row.id);
  }
  db.exec('COMMIT');return count;
 }catch(e){db.exec('ROLLBACK');throw e}
}
