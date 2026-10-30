import {financialReport} from './finance-rules.ts';
import {moroccoDay} from './team-statistics.ts';

// The same cohort and financial rules as the finance summary: order creation
// dates plus expense entry dates, with delivery reflecting the latest Atlas state.
export function businessAnalytics(orders:any[], expenses:any[], from='', to='') {
 const inside=(day:string)=>(!from||day>=from)&&(!to||day<=to);
 const selected=orders.filter(o=>inside(moroccoDay(o.createdAt)));
 const charges=expenses.filter(e=>inside(e.date));
 const days=[...selected.map(o=>moroccoDay(o.createdAt)),...charges.map(e=>e.date)].sort();
 const start=from||days[0]||to||moroccoDay(new Date());
 const end=to||days.at(-1)||from||start;
 const span=Math.max(1,Math.round((Date.parse(end)-Date.parse(start))/86400000)+1);
 const monthly=span>90;
 const key=(day:string)=>monthly?day.slice(0,7):day;
 const buckets=new Map<string,{orders:any[];expenses:any[]}>();
 for(let d=new Date(start+'T12:00:00Z');d.toISOString().slice(0,10)<=end;monthly?d.setUTCMonth(d.getUTCMonth()+1,1):d.setUTCDate(d.getUTCDate()+1)){
  buckets.set(key(d.toISOString().slice(0,10)),{orders:[],expenses:[]});
 }
 for(const o of selected){const k=key(moroccoDay(o.createdAt));if(!buckets.has(k))buckets.set(k,{orders:[],expenses:[]});buckets.get(k)!.orders.push(o)}
 for(const e of charges){const k=key(e.date);if(!buckets.has(k))buckets.set(k,{orders:[],expenses:[]});buckets.get(k)!.expenses.push(e)}
 const statuses={delivered:0,otherTransmitted:0,drafts:0,errors:0,cancelled:0,other:0};
 for(const o of selected){if(o.status==='cancelled')statuses.cancelled++;else if(o.tracking&&o.atlasState===17)statuses.delivered++;else if(o.tracking)statuses.otherTransmitted++;else if(o.status==='error')statuses.errors++;else if(o.status==='draft')statuses.drafts++;else statuses.other++}
 const timeline=[...buckets].sort(([a],[b])=>a.localeCompare(b)).map(([date,b])=>{
  const f=financialReport([],b.orders,monthly?b.expenses:b.expenses.filter(e=>!e.accountingMonth),[]).total;
  return {date,orders:b.orders.length,delivered:f.delivered,revenue:f.revenue,costs:f.missingCost||f.missingTransport?null:f.totalCosts,net:f.net};
 });
 return {granularity:monthly?'month':'day',start,end,statuses,totalOrders:selected.length,transmitted:statuses.delivered+statuses.otherTransmitted,timeline};
}
export type BusinessAnalytics=ReturnType<typeof businessAnalytics>;
