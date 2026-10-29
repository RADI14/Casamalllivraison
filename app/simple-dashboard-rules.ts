import {normalizeEmail} from './rules.ts';
import {financialReport,transportCost} from './finance-rules.ts';
import {deliveryTimestamp} from './delivery-date-rules.ts';
import {moroccoDay,validDay} from './team-statistics.ts';
import {shiftDay,shiftMonth} from './date-range-rules.ts';
import {commissionOrderLedger} from './commission-order-ledger.ts';
export function simpleDashboard(input:any,month:string,today=moroccoDay(new Date()),range?:{from:string;to:string}){
 if(!/^\d{4}-\d{2}$/.test(month)||!validDay(month+'-01'))throw Error('Mois invalide.');
 const from=range?.from??month+'-01',to=range?.to??shiftDay(shiftMonth(month,1)+'-01',-1);
 if(!validDay(from)||!validDay(to)||from>to)throw Error('Période invalide.');
 const inside=(day:string)=>day>=from&&day<=to;
 const records=input.orders,monthly=records.filter((o:any)=>inside(moroccoDay(o.createdAt))),yesterday=shiftDay(today,-1);
 let undated=0,extraShipping=0,missingCancelled=0;const deliveryIds=new Set<string>();
 const accounting=records.flatMap((o:any)=>{if(o.tracking&&o.atlasState===17&&o.status!=='cancelled'){const at=deliveryTimestamp(JSON.parse(o.payload).atlasDeliveredAt);if(!at){undated++;return []}if(inside(moroccoDay(at)))deliveryIds.add(o.id);return [{...o,createdAt:at}]}
 if(o.status==='cancelled'&&o.tracking&&inside(moroccoDay(o.createdAt))){const fee=transportCost(o);extraShipping+=fee.value;if(fee.missing)missingCancelled++;}return [o]});
 const tableDay=from<=today&&to>=today?today:to,tableMonth=tableDay.slice(0,7),monthFrom=tableMonth+'-01',monthTo=shiftDay(shiftMonth(tableMonth,1)+'-01',-1),inMonth=(day:string)=>day>=monthFrom&&day<=monthTo;
 const monthReport=financialReport(input.products,accounting,input.expenses,input.team,monthFrom,monthTo);
 const report=financialReport(input.products,accounting,input.expenses,input.team,from,to),total=report.total;
 total.transport+=extraShipping;total.totalCosts+=extraShipping;total.missingTransport+=missingCancelled;
 total.net=total.missingCost||total.missingTransport||undated?null:total.revenue-total.totalCosts;
 const ledger=commissionOrderLedger(records,input.payments,input.allocations).states;let due=0;
 for(const id of deliveryIds)due+=ledger.get(id)?.commissionDueCents??0;
 const members=report.members.filter((m:any)=>!input.team.find((t:any)=>normalizeEmail(t.email)===normalizeEmail(m.email))?.deletedAt).map((m:any)=>{
 const own=records.filter((o:any)=>normalizeEmail(o.createdEmail??'')===normalizeEmail(m.email));
 let extra=0,missing=0,unknown=0,commissionDue=0;
 for(const o of own){if(o.status==='cancelled'&&o.tracking&&inside(moroccoDay(o.createdAt))){const fee=transportCost(o);extra+=fee.value;if(fee.missing)missing++}if(o.tracking&&o.atlasState===17&&o.status!=='cancelled'&&!deliveryTimestamp(JSON.parse(o.payload).atlasDeliveredAt))unknown++;if(deliveryIds.has(o.id))commissionDue+=ledger.get(o.id)?.commissionDueCents??0;}
 const daily=new Map<string,{date:string;entered:number;delivered:number}>();
 const point=(date:string)=>{if(!daily.has(date))daily.set(date,{date,entered:0,delivered:0});return daily.get(date)!};
 for(const o of own){const created=moroccoDay(o.createdAt);if(inside(created))point(created).entered++;if(deliveryIds.has(o.id)){const delivered=moroccoDay(deliveryTimestamp(JSON.parse(o.payload).atlasDeliveredAt)!);point(delivered).delivered++;}}
 const monthFinance=monthReport.members.find((r:any)=>normalizeEmail(r.email)===normalizeEmail(m.email))!;
 let monthlyExtra=0,monthlyMissing=0,monthCommissionDue=0;
 for(const o of own){if(o.tracking&&o.atlasState===17&&o.status!=='cancelled'){const at=deliveryTimestamp(JSON.parse(o.payload).atlasDeliveredAt);if(at&&inMonth(moroccoDay(at)))monthCommissionDue+=ledger.get(o.id)?.commissionDueCents??0;}if(o.status==='cancelled'&&o.tracking&&inMonth(moroccoDay(o.createdAt))){const fee=transportCost(o);monthlyExtra+=fee.value;if(fee.missing)monthlyMissing++;}}
 const monthOrders=own.filter((o:any)=>inMonth(moroccoDay(o.createdAt))),cohortDelivered=monthOrders.filter((o:any)=>o.tracking&&o.atlasState===17&&o.status!=='cancelled').length;
 const monthProfit=monthFinance.missingCost||monthFinance.missingTransport||monthlyMissing||unknown?null:monthFinance.revenue-monthFinance.totalCosts-monthlyExtra;
 const charges=m.totalCosts+extra;
 return {dayOrders:own.filter((o:any)=>moroccoDay(o.createdAt)===tableDay).length,monthOrders:monthOrders.length,monthDelivered:monthFinance.delivered,monthProfit,monthCommission:monthFinance.commission,monthCommissionDue,monthDeliveryRate:monthOrders.length?cohortDelivered/monthOrders.length*100:null,cohortDelivered,daily:[...daily.values()].sort((a,b)=>a.date.localeCompare(b.date)),undatedDeliveries:unknown,email:m.email,name:m.name,active:input.team.find((t:any)=>normalizeEmail(t.email)===normalizeEmail(m.email))?.active===1,todayOrders:own.filter((o:any)=>moroccoDay(o.createdAt)===today).length,yesterdayOrders:own.filter((o:any)=>moroccoDay(o.createdAt)===yesterday).length,periodOrders:own.filter((o:any)=>inside(moroccoDay(o.createdAt))).length,delivered:m.delivered,revenue:m.revenue,ads:m.ads,charges,profit:m.missingCost||m.missingTransport||missing||unknown?null:m.revenue-charges,commission:m.commission,commissionDue};
 }).sort((a:any,b:any)=>b.periodOrders-a.periodOrders||a.name.localeCompare(b.name));
 return {members,tableDay,tableMonth,month,from,to,today,yesterday,todayOrders:records.filter((o:any)=>moroccoDay(o.createdAt)===today).length,yesterdayOrders:records.filter((o:any)=>moroccoDay(o.createdAt)===yesterday).length,monthOrders:monthly.length,periodOrders:monthly.length,revenue:total.revenue,profit:total.net,charges:total.totalCosts,commission:total.commission,commissionDue:due,missingCost:total.missingCost,missingTransport:total.missingTransport,undated,asOf:new Date().toISOString()};
}
