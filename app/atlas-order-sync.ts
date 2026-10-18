import {cents} from './finance-rules.ts';
/** Atlas owns parcel details; local authorship and accounting records stay local. */
export function atlasOrderSnapshot(saved:Record<string,any>,remote:Record<string,any>){
 const payload={...saved};
 for(const field of ['fullname','phone','address','cityId','cityName','product']){
  if(typeof remote[field]==='string'&&remote[field].trim()&&remote[field].length<=1000)payload[field]=remote[field];
 }
 for(const field of ['phone2','note','storeId']){
  if(remote[field]===null)payload[field]='';
  else if(typeof remote[field]==='string'&&remote[field].length<=1000)payload[field]=remote[field];
 }
 // Do not retain the old city's label when Atlas supplies only a new identifier.
 if(payload.cityId!==saved.cityId&&!(typeof remote.cityName==='string'&&remote.cityName.trim()))payload.cityName=payload.cityId;
 const price=cents(remote.price);if(price!==null)payload.price=price/100;
 const quantity=typeof remote.quantity==='number'||typeof remote.quantity==='string'&&remote.quantity.trim()?Number(remote.quantity):NaN;
 if(Number.isInteger(quantity)&&quantity>=1&&quantity<=1000)payload.quantity=quantity;
 for(const field of ['openpackage','change','allowtry']){
  if(typeof remote[field]==='boolean')payload[field]=remote[field];
  else if(remote[field]===0||remote[field]===1)payload[field]=remote[field]===1;
 }
 const productChanged=payload.product!==saved.product;
 // A changed product description cannot prove the SKU or purchase cost of the new item.
 if(productChanged){delete payload.atlasSku;delete payload.stockItems;}
 else if(Array.isArray(saved.stockItems)&&saved.stockItems.length===1&&payload.quantity!==saved.quantity)payload.stockItems=[{...saved.stockItems[0],quantity:payload.quantity}];
 const stateName=typeof remote.stateName==='string'?remote.stateName:null;
 const state=stateName?.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 const cancelled=remote.cancelled===true||['annule','annulee','cancelled','canceled'].includes(state??'');
 return {payload,productChanged,cancelled,stateName,transportCents:cents(remote.cfees)};
}
