import {moroccoDay,validDay} from './team-statistics.ts';
import {financialReport} from './finance-rules.ts';
import {normalizeEmail} from './rules.ts';
export function monthRange(month:string){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!validDay(month+'-01'))throw Error('Mois invalide.');const last=new Date(month+'-01T12:00:00Z');last.setUTCMonth(last.getUTCMonth()+1,0);return {from:month+'-01',to:last.toISOString().slice(0,10)};}
export function agingAlerts(orders:any[],settings:{age_days:number;sync_days:number},now=Date.now()){
 const days=(date:string|null)=>date&&Number.isFinite(Date.parse(date))?Math.max(0,Math.floor((now-Date.parse(date))/86400000)):null;
 return orders.filter(o=>o.tracking&&o.status!=='cancelled'&&o.atlasState!==17&&!/^retourn[ée]s?$/i.test((o.atlasStateName??'').trim())).flatMap(o=>{
 const age=days(o.createdAt),syncAge=days(o.syncedAt),reasons=[];if(age!==null&&age>=settings.age_days)reasons.push('old');if(syncAge===null||syncAge>=settings.sync_days)reasons.push('sync');if(!reasons.length)return [];
 const p=typeof o.payload==='string'?JSON.parse(o.payload):o.payload;return [{id:o.id,tracking:o.tracking,client:p.fullname,product:p.product,agent:o.createdBy,state:o.atlasStateName??o.status,age,syncAge,reasons,createdAt:o.createdAt,syncedAt:o.syncedAt}];
 }).sort((a,b)=>(b.age??0)-(a.age??0));
}
function split(amount:number,weights:{id:string;weight:number}[]){const sum=weights.reduce((n,w)=>n+w.weight,0),result=new Map<string,number>();if(sum<=0)return result;let used=0;weights.forEach((w,i)=>{const value=i===weights.length-1?amount-used:Math.floor(amount*w.weight/sum);result.set(w.id,value);used+=value;});return result;}
export function monthlyControls(input:any,month:string){
 const {from,to}=monthRange(month);
 const reportOrders=input.orders.map((o:any)=>{const p=typeof o.payload==='string'?JSON.parse(o.payload):o.payload;return {...o,payload:JSON.stringify(p),productId:o.productId||'name:'+String(p.product??'Sans produit').trim()};});
 const names=new Map<string,any>(input.products.map((p:any)=>[p.id,p]));for(const o of reportOrders)if(!names.has(o.productId)){const p=JSON.parse(o.payload);names.set(o.productId,{id:o.productId,name:p.product||'Sans produit',sku:p.atlasSku??'—',stock:null});}
 const finance=financialReport([...names.values()],reportOrders,input.expenses,input.team,from,to);
 const products=finance.products.filter((p:any)=>p.orders>0||p.overheads>0||p.ads>0).map((p:any)=>({...p,allocatedAds:0,allocatedShared:0,directNet:p.net,estimatedNet:null as number|null}));
 const byId=new Map<string,any>(products.map((p:any)=>[p.id,p]));let unallocatedAds=0,unallocatedShared=0;
 for(const agent of finance.adBreakdown){const revenues=new Map<string,number>();for(const o of reportOrders){if(normalizeEmail(o.createdEmail??'')!==agent.memberEmail||o.status==='cancelled'||!o.tracking||o.atlasState!==17||moroccoDay(o.createdAt)<from||moroccoDay(o.createdAt)>to)continue;const p=JSON.parse(o.payload);revenues.set(o.productId,(revenues.get(o.productId)??0)+Math.round(Number(p.price)*100));}const allocation=split(agent.ads,[...revenues].filter(([,w])=>w>0).map(([id,weight])=>({id,weight})));if(!allocation.size)unallocatedAds+=agent.ads;for(const [id,value] of allocation)byId.get(id).allocatedAds+=value;}
 const shared=split(finance.generalOverheads,products.filter((p:any)=>p.revenue>0).map((p:any)=>({id:p.id,weight:p.revenue})));if(!shared.size)unallocatedShared=finance.generalOverheads;for(const [id,value] of shared)byId.get(id).allocatedShared+=value;
 for(const p of products)p.estimatedNet=p.directNet===null?null:p.directNet-p.allocatedAds-p.allocatedShared;
 const orders=reportOrders.filter((o:any)=>{const day=moroccoDay(o.createdAt);return day>=from&&day<=to;});
 return {month,from,to,finance,products,unallocatedAds,unallocatedShared,orders:orders.map((o:any)=>({...o,payload:JSON.parse(o.payload)})),payments:input.payments.filter((p:any)=>{const day=moroccoDay(p.paidAt);return day>=from&&day<=to;})};
}
