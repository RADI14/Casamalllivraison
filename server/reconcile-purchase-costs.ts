import type {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {legacyPack} from '../app/upsell-commission.ts';
/** Fill only missing delivered-order costs using saved prices and unambiguous identities. */
export function reconcilePurchaseCosts(db:DatabaseSync,key?:string){
 const products=db.prepare('SELECT id,sku,name,cost_cents AS cost FROM products').all() as {id:string;sku:string;name:string;cost:number}[];
 const byId=new Map(products.map(p=>[p.id,p])),bySku=new Map(products.map(p=>[p.sku,p])),names=new Map<string,Set<string>>(),stocks=new Map<string,string>();
 const remember=(name:string,sku:string)=>{if(!name?.trim()||!sku)return;const n=name.trim();if(!names.has(n))names.set(n,new Set());names.get(n)!.add(sku)};
 products.forEach(p=>remember(p.name,p.sku));
 const catalog=key?db.prepare('SELECT products FROM atlas_product_catalog WHERE scope=?').all(createHash('sha256').update(key).digest('hex')):db.prepare('SELECT products FROM atlas_product_catalog').all();
 for(const row of catalog as {products:string}[]){try{for(const p of JSON.parse(row.products)){if(typeof p.stockId==='string'&&typeof p.sku==='string'&&p.sku){stocks.set(p.stockId,p.sku);if(typeof p.name==='string')remember(p.name,p.sku)}}}catch{}}
 const named=(name:string)=>{const skus=names.get(name?.trim());return skus?.size===1?bySku.get([...skus][0]):undefined};
 const valid=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=1&&Number(n)<=1000;
 const rows=db.prepare("SELECT id,payload,product_id AS productId,tracking,created_at AS createdAt FROM orders WHERE unit_cost_cents IS NULL AND purchase_total_cents IS NULL AND tracking IS NOT NULL AND atlas_state=17 AND status!='cancelled'").all() as any[];
 const update=db.prepare('UPDATE orders SET product_id=?,unit_cost_cents=?,purchase_total_cents=?,updated_at=? WHERE id=? AND unit_cost_cents IS NULL AND purchase_total_cents IS NULL AND payload=?');
 let updated=0;const missing:{tracking:string;product:string;quantity:number;reason:string;createdAt:string}[]=[];
 for(const row of rows){let p:any;try{p=JSON.parse(row.payload)}catch{continue}if(!p||typeof p!=='object')continue;
  let product=byId.get(row.productId),total:number|null=null,unit:number|null=null;
  if(valid(p.quantity)){
   if(Array.isArray(p.stockItems)&&p.stockItems.length){
    let sum=0,units=0,ok=true;const seen=new Set<string>();const linked=[];
    for(const item of p.stockItems){if(!item||typeof item.stockId!=='string'){ok=false;break}const sku=stocks.get(item.stockId),local=sku?bySku.get(sku):p.stockItems.length===1?product??bySku.get(p.atlasSku):undefined;if(!local||!valid(item.quantity)||seen.has(item.stockId)){ok=false;break}seen.add(item.stockId);units+=item.quantity;sum+=local.cost*item.quantity;linked.push(local)}
    if(ok&&units===p.quantity&&Number.isSafeInteger(sum)){total=sum;product=linked.length===1?linked[0]:undefined;unit=linked.length===1?linked[0].cost:null}
   }else{
    // A stale ID or explicit unknown SKU must not fall back to a similar name.
    const pack=legacyPack(p.product);product=product??(p.atlasSku?bySku.get(p.atlasSku):row.productId?undefined:named(p.product)??(pack?named(pack.name):undefined));
    if(product){const units=p.quantity===1&&pack&&named(pack.name)?.sku===product.sku?pack.quantity:p.quantity;total=product.cost*units;unit=units===p.quantity?product.cost:null}
   }
  }
  if(total!==null&&Number.isSafeInteger(total)&&total>=0)updated+=Number(update.run(product?.id??null,unit,total,new Date().toISOString(),row.id,row.payload).changes);
  else missing.push({tracking:row.tracking,product:String(p.product??''),quantity:p.quantity,createdAt:row.createdAt,reason:'Produit non associé de façon certaine à un coût enregistré'});
 }
 return {updated,remaining:missing.length,missing};
}
