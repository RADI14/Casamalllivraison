import {expenseCategory,expenseInPeriod} from './expense-rules.ts';
import {financialReport} from './finance-rules.ts';
import {commission} from './rules.ts';
import {moroccoDay} from './team-statistics.ts';

type Product = {id:string;sku:string;name:string;stock:number|null};
type Parcel = Parameters<typeof commission>[0] & {
 id:string;productId:string|null;payload:string;createdAt:string;
};
export type WebsiteLead = {
 local_order_id:string|null;payload:string;received_at:string;review_status:string;
};
type Expense = {productId?:string|null;date:string;category?:string;amountCents:number};
const ratio=(value:number,divisor:number)=>divisor>0?value/divisor:null;

export function productPerformance(catalog:Product[],parcels:Parcel[],website:WebsiteLead[],expenses:Expense[],from='',to=''){
 const products=new Map(catalog.map(p=>[p.id,p]));
 const bySku=new Map(catalog.map(p=>[p.sku,p]));
 const counts=new Map<string,{leads:number;confirmed:number;upsells:number;upsellCommission:number}>();
 const linked=new Map(website.filter(w=>w.local_order_id).map(w=>[w.local_order_id,w]));
 const inside=(stamp:string)=>{const day=moroccoDay(stamp);return (!from||day>=from)&&(!to||day<=to)};
 function product(sku:string|undefined,name:string|undefined,bundle=false){
  const cleanName=name?.trim()||'—';
  const known=sku?bySku.get(sku):undefined;
  if(known)return known.id;
  const matches=!sku&&!bundle?catalog.filter(p=>p.name===cleanName):[];
  if(matches.length===1)return matches[0].id;
  const id=sku?'sku:'+sku:(bundle?'bundle:':'name:')+cleanName;
  if(!products.has(id))products.set(id,{id,sku:sku||'—',name:cleanName,stock:null});
  return id;
 }
 function tally(id:string,confirmed:boolean,upsell=false,upsellCommission=0){
  const row=counts.get(id)??{leads:0,confirmed:0,upsells:0,upsellCommission:0};
  row.leads++;
  row.confirmed+=Number(confirmed);
  row.upsells+=Number(upsell);
  row.upsellCommission+=upsellCommission;
  counts.set(id,row);
 }
 const selected=parcels.flatMap(o=>{
  const lead=linked.get(o.id);
  if(!inside(lead?.received_at??o.createdAt))return [];
  const p=JSON.parse(o.payload);
  const id=o.productId&&products.has(o.productId)?o.productId:product(p.atlasSku,p.product,p.stockItems?.length>1);
  const active=o.status!=='cancelled';
  const delivered=active&&o.tracking&&o.atlasState===17;
  tally(id,active&&(lead?lead.review_status==='confirmed'||!!o.tracking:true),
   !!delivered&&p.quantity>1,Math.max(0,commission(o)-10)*100);
  return [{...o,productId:id}];
 });
 for(const w of website){
  if(w.local_order_id||!inside(w.received_at))continue;
  const {lines=[]}=JSON.parse(w.payload) as {lines?:{sku?:string;name?:string;quantity:number}[]};
  const name=lines.length>1?lines.map(line=>line.name+' × '+line.quantity).join(' + '):lines[0]?.name;
  const id=product(lines.length===1?lines[0]?.sku:undefined,name,lines.length>1);
  tally(id,w.review_status==='confirmed');
 }
 const costs=financialReport([...products.values()],selected,expenses.filter(e=>expenseCategory(e)!=='ads'&&expenseInPeriod(e,from,to)),[]);
 const ads=new Map<string,number>();
 let unassignedAds=0;
 for(const e of expenses){
  if(expenseCategory(e)!=='ads'||!expenseInPeriod(e,from,to))continue;
  if(e.productId&&products.has(e.productId))ads.set(e.productId,(ads.get(e.productId)??0)+e.amountCents);
  else unassignedAds+=e.amountCents;
 }
 const rows=costs.products.filter(p=>counts.has(p.id)||ads.has(p.id)||p.overheads).map(p=>{
  const {leads,confirmed,upsells,upsellCommission}=counts.get(p.id)??{leads:0,confirmed:0,upsells:0,upsellCommission:0};
  const spend=ads.get(p.id)??null;
  const profit=p.net===null||spend===null?null:p.net-spend;
  return {id:p.id as string,name:p.name as string,sku:p.sku as string,leads,confirmed,
   delivered:p.delivered as number,units:p.units as number,upsells,upsellCommission,spend,profit,
   confirmationRate:ratio(confirmed,leads),deliveryRate:ratio(p.delivered,confirmed),
   upsellRate:ratio(upsells,p.delivered),cpl:spend===null?null:ratio(spend,leads),
   cpd:spend===null?null:ratio(spend,p.delivered),profitPerPiece:profit===null?null:ratio(profit,p.units),
   roi:profit===null||spend===null?null:ratio(profit,spend),
   breakEvenAds:p.net as number|null,breakEvenCpl:p.net===null?null:ratio(p.net,leads)};
 }).sort((a,b)=>b.leads-a.leads||a.name.localeCompare(b.name));
 return {rows,unassignedAds};
}
