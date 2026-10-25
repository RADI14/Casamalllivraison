import {financialReport,transportCost} from './finance-rules.ts';
import {commissionOrderLedger,type Allocation} from './commission-order-ledger.ts';
import {moroccoDay,validDay} from './team-statistics.ts';
import {shiftDay} from './date-range-rules.ts';
import {normalizeEmail} from './rules.ts';
export type OperationsInput={team:any[];orders:any[];expenses:any[];products:any[];payments:any[];allocations:Allocation[];receipts:any[]};
export function operationsPeriod(from:string,to:string,today=moroccoDay(new Date())){
 const end=to||today,start=from||shiftDay(end,-6);
 if(!validDay(start)||!validDay(end)||start>end)throw Error('Choisissez une période valide.');
 const days=Math.round((Date.parse(end)-Date.parse(start))/86400000)+1;
 if(days>3660)throw Error('Période maximale : 10 ans.');
 return {from:start,to:end,previousFrom:shiftDay(start,-days),previousTo:shiftDay(start,-1)};
}
const inside=(day:string,from:string,to:string)=>(!from||day>=from)&&(!to||day<=to);
function metrics(input:OperationsInput,from:string,to:string){
 const selected=input.orders.filter(o=>inside(moroccoDay(o.createdAt),from,to)),f=financialReport(input.products,input.orders,input.expenses,input.team,from,to);
 const transmitted=selected.filter(o=>o.status!=='cancelled'&&o.tracking).length;
 return {...f,orders: selected.length,transmitted,deliveryRate:transmitted?f.total.delivered/transmitted*100:null};
}
export function operationsReport(input:OperationsInput,from='',to='',today=moroccoDay(new Date())){
 const period=operationsPeriod(from,to,today),current=metrics(input,period.from,period.to),previous=metrics(input,period.previousFrom,period.previousTo);
 const visible=input.team.filter(m=>!m.deletedAt),emails=new Set(visible.map(m=>normalizeEmail(m.email)));
 const selected=input.orders.filter(o=>inside(moroccoDay(o.createdAt),period.from,period.to)&&o.status!=='cancelled');
 const missingPurchase=selected.filter(o=>o.tracking&&o.atlasState===17&&o.unitCostCents==null);
 const missingDelivery=selected.filter(o=>transportCost(o).missing);
 const missingAds=current.members.filter(m=>emails.has(normalizeEmail(m.email))&&m.leads>0&&!m.adsEntries);
 const row=(o:any)=>({id:o.id,tracking:o.tracking??'',agent:o.createdBy,product:JSON.parse(o.payload).product,productId:o.productId,day:moroccoDay(o.createdAt)});
 const lifetime=financialReport(input.products,input.orders,[],input.team).total;
 const shipping=input.orders.filter(o=>o.tracking).map(transportCost),fees=shipping.reduce((sum,s)=>sum+s.value,0),missingFees=shipping.filter(s=>s.missing).length;
 const received=input.receipts.filter(r=>!r.voided_at).reduce((sum,r)=>sum+Number(r.amount_cents),0);
 const projected=missingFees?null:lifetime.revenue-fees;
 return {period,alerts:{missingPurchase:{count:missingPurchase.length,rows:missingPurchase.slice(0,50).map(row)},missingDelivery:{count:missingDelivery.length,rows:missingDelivery.slice(0,50).map(row)},missingAds:missingAds.map(m=>({email:m.email,name:m.name,orders:m.leads}))},comparison:{current:{orders:current.orders,delivered:current.total.delivered,deliveryRate:current.deliveryRate,revenue:current.total.revenue,net:current.total.net},previous:{orders:previous.orders,delivered:previous.total.delivered,deliveryRate:previous.deliveryRate,revenue:previous.total.revenue,net:previous.total.net},members:current.members.filter(m=>emails.has(normalizeEmail(m.email))).map(m=>({email:m.email,name:m.name,current:m,previous:previous.members.find(p=>normalizeEmail(p.email)===normalizeEmail(m.email))})),products:current.products.map(p=>({id:p.id,name:p.name,current:p,previous:previous.products.find(b=>b.id===p.id)??null}))},members:visible.map(m=>({email:m.email,name:m.name})),carrier:{scope:'all-time',deliveredSales:lifetime.revenue,fees,missingFees,projectedNet:projected,receivedCents:received,reconciliation:projected===null?null:projected-received,receipts:input.receipts.slice(0,100)}};
}
export function agentStatement(input:OperationsInput,email:string,from='',to=''){
 const person=input.team.find(m=>normalizeEmail(m.email)===normalizeEmail(email));if(!person)return null;
 const key=normalizeEmail(person.email),report=financialReport(input.products,input.orders,input.expenses,input.team,from,to),summary=report.members.find(m=>normalizeEmail(m.email)===key)!;
 const {states}=commissionOrderLedger(input.orders,input.payments,input.allocations);
 const selected=input.orders.filter(o=>normalizeEmail(o.createdEmail??'')===key&&inside(moroccoDay(o.createdAt),from,to));
 const rows=selected.map(o=>{const p=JSON.parse(o.payload),fee=transportCost(o),delivered=o.status!=='cancelled'&&o.tracking&&o.atlasState===17,state=states.get(o.id);return {id:o.id,tracking:o.tracking??'',day:moroccoDay(o.createdAt),client:p.fullname??'',product:p.product??'',quantity:p.quantity,status:o.status==='cancelled'?'Annulé':o.atlasStateName??o.status,salesCents:delivered?Math.round(p.price*100):0,deliveryCents:o.status==='cancelled'?0:fee.missing?null:fee.value,purchaseCents:delivered?o.unitCostCents==null?null:o.unitCostCents*p.quantity:0,paidCents:state?.commissionPaidCents??0,dueCents:state?.commissionDueCents??0}});
 return {person:{name:person.name,email:person.email},from,to,summary,rows,allocatedPaidCents:rows.reduce((s,r)=>s+r.paidCents,0),dueCents:rows.reduce((s,r)=>s+r.dueCents,0),payments:input.payments.filter(p=>normalizeEmail(p.memberEmail)===key&&inside(moroccoDay(p.paidAt),from,to)),expenses:input.expenses.filter(e=>normalizeEmail(e.memberEmail??'')===key&&inside(e.date,from,to))};
}
