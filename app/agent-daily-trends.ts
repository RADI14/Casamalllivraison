import {dailyDeliveries} from './delivery-date-rules.ts';
import {financialReport} from './finance-rules.ts';
import {moroccoDay} from './team-statistics.ts';
import {shiftDay} from './date-range-rules.ts';
import {normalizeEmail} from './rules.ts';

// Cohorts follow the dashboard: creation day, latest delivery state, dated expenses.
export function agentDailyTrends(team:any[],orders:any[],expenses:any[],end=moroccoDay(new Date())){
 const start=shiftDay(end,-9),days=Array.from({length:10},(_,i)=>shiftDay(start,i));
 const buckets=new Map(days.map(date=>[date,{orders:[] as any[],expenses:[] as any[]}]));
 for(const o of orders)buckets.get(moroccoDay(o.createdAt))?.orders.push(o);
 for(const e of expenses)buckets.get(e.date)?.expenses.push(e);
 const points=new Map(team.map(m=>[normalizeEmail(m.email),[] as {date:string;orders:number;delivered:number;revenue:number;net:number|null}[]]));
 for(const date of days){const bucket=buckets.get(date)!;const report=financialReport([],bucket.orders,bucket.expenses,team);
  for(const m of report.members)points.get(normalizeEmail(m.email))!.push({date,orders:m.leads,delivered:m.delivered,revenue:m.revenue,net:m.attributedNet});
 }
 const deliveries=dailyDeliveries(team,orders,days);
 const totals=financialReport([],orders.filter(o=>buckets.has(moroccoDay(o.createdAt))),expenses.filter(e=>buckets.has(e.date)),team);
 return {start,end,members:team.map(m=>{const total=totals.members.find(t=>normalizeEmail(t.email)===normalizeEmail(m.email))!;return {email:m.email,name:m.name,active:m.active,deletedAt:m.deletedAt??null,deliveryPoints:deliveries.get(normalizeEmail(m.email))!.points,undatedDeliveries:deliveries.get(normalizeEmail(m.email))!.undated,points:points.get(normalizeEmail(m.email))!,totals:{orders:total.leads,delivered:total.delivered,revenue:total.revenue,net:total.attributedNet}}})};
}
export type AgentDailyTrends=ReturnType<typeof agentDailyTrends>;
