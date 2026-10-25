export function duplicatePhone(value:unknown){return typeof value==='string'?value.replace(/[^0-9]/g,'').replace(/^(00212|212)/,'0'):''}
const clean=(v:unknown)=>typeof v==='string'?v.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g,' '):'';
export function duplicateOrders(records:any[],candidate:{phone:string;stockId:string;sku:string;product:string},now=Date.now()){
 const phone=duplicatePhone(candidate.phone);if(!phone)return [];
 return records.filter(o=>{
  if(o.status==='cancelled'||now-Date.parse(o.createdAt)>7*86400000||Date.parse(o.createdAt)>now)return false;
  let p:any;try{p=JSON.parse(o.payload)}catch{return false}
  if(duplicatePhone(p.phone)!==phone)return false;
  if(Array.isArray(p.stockItems)&&p.stockItems.length)return p.stockItems.some((s:any)=>s.stockId===candidate.stockId);
  if(p.atlasSku&&candidate.sku)return p.atlasSku===candidate.sku;
  return clean(p.product)===clean(candidate.product);
 });
}
