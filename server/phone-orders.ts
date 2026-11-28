import type {DatabaseSync} from 'node:sqlite';
import {duplicatePhone} from '../app/duplicate-order-rules.ts';
const decode=(raw:unknown)=>{try{return JSON.parse(String(raw))}catch{return {}}};
const phones=(p:any)=>[...new Set([duplicatePhone(p.phone),duplicatePhone(p.phone2)].filter(p=>/^0[67]\d{8}$/.test(p)))];
const productKey=(value:unknown)=>typeof value==='string'?value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' '):'';
function products(p:any){
 const items=p.stockItems??p.items;
 const lines=p.productLines??p.lines;
 const identities=Array.isArray(lines)&&lines.length
  ? lines.map((line:any)=>({stockId:productKey(line.stockId),sku:productKey(line.sku),name:productKey(line.name)}))
  : String(p.product??'').split(' + ').map((name,index)=>({
     stockId:productKey(items?.[index]?.stockId??(index===0?p.atlasStockId:undefined)),
     sku:productKey(index===0?p.atlasSku:undefined),
     name:productKey(name.replace(/ × \d+$/,''))
    }));
 return identities.filter(line=>line.stockId||line.sku||line.name);
}
function samePhoneAndProduct(a:any,b:any){
 const numbers=phones(a);
 if(!phones(b).some(phone=>numbers.includes(phone)))return false;
 const left=products(a),right=products(b);
 if(!left.length||!right.length)return true;
 return left.some(x=>right.some(y=>
  !!(x.stockId&&x.stockId===y.stockId||x.sku&&x.sku===y.sku||x.name&&x.name===y.name)
 ));
}
function activeParcels(db:DatabaseSync){
 return db.prepare("SELECT id,payload,atlas_state_name AS state FROM orders WHERE status!='cancelled' AND atlas_state IS NOT 17").all().filter(o=>{
  const state=String(o.state??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return !['livre','livree','delivered','annule','annulee','cancelled','canceled','retourne','retournee','returned'].includes(state);
 });
}
export function activePhoneOrder(db:DatabaseSync,p:any,excludeWebsiteId?:string){
 if(!phones(p).length)return null;
 const parcel=activeParcels(db).find(o=>samePhoneAndProduct(p,decode(o.payload)));
 if(parcel)return {kind:'order',id:String(parcel.id)};
 const pending=db.prepare("SELECT id,payload,prepared_payload FROM youcan_orders WHERE deleted_at IS NULL AND local_order_id IS NULL AND duplicate_of IS NULL AND review_status!='cancelled' AND store_id=? ORDER BY received_at,id").all(process.env.YOUCAN_STORE_ID??'');
 const row=pending.find(o=>o.id!==excludeWebsiteId&&!decode(o.payload).blocked&&samePhoneAndProduct(p,decode(o.prepared_payload??o.payload)));
 return row?{kind:'website',id:String(row.id)}:null;
}
// Keep confirmed duplicate decisions after delivery, and release old phone-only
// decisions when the original order proves that the products were different.
export function reconcileWebsiteDuplicates(db:DatabaseSync,store:string){
 db.exec('BEGIN IMMEDIATE');
 try{
  const parcels=activeParcels(db);
  const rows=db.prepare('SELECT id,payload,prepared_payload,review_status,local_order_id,duplicate_of FROM youcan_orders WHERE store_id=? AND deleted_at IS NULL ORDER BY received_at,id').all(store);
  const originalParcel=db.prepare('SELECT payload FROM orders WHERE id=?');
  const originalWebsite=db.prepare('SELECT payload,prepared_payload FROM youcan_orders WHERE id=? AND store_id=?');
  const seen=parcels.map(row=>({id:'order:'+row.id,payload:decode(row.payload)}));
  const setDuplicate=db.prepare('UPDATE youcan_orders SET duplicate_of=? WHERE id=? AND local_order_id IS NULL');
  let count=0;
  for(const row of rows){
   if(row.local_order_id||row.review_status==='cancelled'||decode(row.payload).blocked)continue;
   const payload=decode(row.prepared_payload??row.payload);
   if(typeof row.duplicate_of==='string'){
    const [kind,id]=row.duplicate_of.split(':',2);
    const original=kind==='order'?originalParcel.get(id):originalWebsite.get(id,store);
    if(!original||samePhoneAndProduct(payload,decode(original.prepared_payload??original.payload)))continue;
   }
   const duplicate=seen.find(entry=>samePhoneAndProduct(payload,entry.payload));
   if(duplicate){setDuplicate.run(duplicate.id,row.id);count++;}
   else{
    if(row.duplicate_of)setDuplicate.run(null,row.id);
    seen.push({id:'website:'+row.id,payload});
   }
  }
  db.exec('COMMIT');return count;
 }catch(e){db.exec('ROLLBACK');throw e}
}
