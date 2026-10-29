import {financialReport,transportCost} from './finance-rules.ts';
import {deliveryTimestamp} from './delivery-date-rules.ts';
import {moroccoDay,validDay} from './team-statistics.ts';
import {shiftDay,shiftMonth} from './date-range-rules.ts';
import {commissionOrderLedger} from './commission-order-ledger.ts';
export function simpleDashboard(input:any,month:string,today=moroccoDay(new Date())){
 if(!/^\d{4}-\d{2}$/.test(month)||!validDay(month+'-01'))throw Error('Mois invalide.');
 const from=month+'-01',to=shiftDay(shiftMonth(month,1)+'-01',-1),inside=(day:string)=>day>=from&&day<=to;
 const records=input.orders,monthly=records.filter((o:any)=>inside(moroccoDay(o.createdAt))),yesterday=shiftDay(today,-1);
 let undated=0,extraShipping=0,missingCancelled=0;const deliveryIds=new Set<string>();
 const accounting=records.flatMap((o:any)=>{if(o.tracking&&o.atlasState===17&&o.status!=='cancelled'){const at=deliveryTimestamp(JSON.parse(o.payload).atlasDeliveredAt);if(!at){undated++;return []}if(inside(moroccoDay(at)))deliveryIds.add(o.id);return [{...o,createdAt:at}]}
 if(o.status==='cancelled'&&o.tracking&&inside(moroccoDay(o.createdAt))){const fee=transportCost(o);extraShipping+=fee.value;if(fee.missing)missingCancelled++;}return [o]});
 const total=financialReport(input.products,accounting,input.expenses,input.team,from,to).total;
 total.transport+=extraShipping;total.totalCosts+=extraShipping;total.missingTransport+=missingCancelled;
 total.net=total.missingCost||total.missingTransport||undated?null:total.revenue-total.totalCosts;
 const ledger=commissionOrderLedger(records,input.payments,input.allocations).states;let due=0;
 for(const id of deliveryIds)due+=ledger.get(id)?.commissionDueCents??0;
 return {month,today,yesterday,todayOrders:records.filter((o:any)=>moroccoDay(o.createdAt)===today).length,yesterdayOrders:records.filter((o:any)=>moroccoDay(o.createdAt)===yesterday).length,monthOrders:monthly.length,revenue:total.revenue,profit:total.net,charges:total.totalCosts,commission:total.commission,commissionDue:due,missingCost:total.missingCost,missingTransport:total.missingTransport,undated,asOf:new Date().toISOString()};
}
