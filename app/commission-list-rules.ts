import {moroccoDay} from './team-statistics.ts';
import {normalizeEmail} from './rules.ts';
export function deliveredCommissionOrders(orders:any[],members:any[],agent='all'){
 const allowed=new Set(members.map(m=>normalizeEmail(m.email)));
 return orders.filter(o=>o.tracking&&o.atlasState===17&&o.status!=='cancelled'&&allowed.has(normalizeEmail(o.createdEmail??''))&&(agent==='all'||normalizeEmail(o.createdEmail??'')===normalizeEmail(agent)));
}
export function filterCommissionList(rows:any[],filters:{payment:string;from:string;to:string;query:string}){
 const q=filters.query.trim().toLowerCase();
 return rows.filter(o=>{const day=moroccoDay(o.createdAt);return (filters.payment==='all'||o.commissionPaymentStatus===filters.payment)&&(!filters.from||day>=filters.from)&&(!filters.to||day<=filters.to)&&(!q||[o.tracking,o.payload?.fullname,o.createdBy].join(' ').toLowerCase().includes(q))});
}
