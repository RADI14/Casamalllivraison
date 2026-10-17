import {commission,normalizeEmail} from './rules.ts';
export type TeamMember={email:string;name:string;active:number};
export type StatisticOrder={createdEmail:string|null;createdAt:string;status:string;tracking:string|null;atlasState:number|null;commissionRate:number;syncedAt:string|null};
export function moroccoDay(value:string|Date){return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Casablanca',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
export function validDay(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;}
const zero=()=>({orders:0,transmitted:0,drafts:0,delivered:0,errors:0,unsynced:0,commission:0,deliveryRate:null as number|null});
export function teamStatistics(members:TeamMember[],orders:StatisticOrder[],from='',to=''){
 const rows=members.map(m=>({...m,...zero(),latestSync:null as string|null}));
 const byEmail=new Map(rows.map(m=>[normalizeEmail(m.email),m]));let excludedOrders=0;
 for(const o of orders){const day=moroccoDay(o.createdAt);if((from&&day<from)||(to&&day>to))continue;const m=o.createdEmail?byEmail.get(normalizeEmail(o.createdEmail)):null;if(!m){excludedOrders++;continue}
 m.orders++;if(o.tracking){m.transmitted++;if(o.atlasState===17)m.delivered++;if(o.atlasState===null)m.unsynced++}if(o.status==='draft')m.drafts++;if(o.status==='error')m.errors++;m.commission+=commission(o);if(o.syncedAt&&(!m.latestSync||o.syncedAt>m.latestSync))m.latestSync=o.syncedAt;
 }
 const total=zero();for(const r of rows){r.deliveryRate=r.transmitted?100*r.delivered/r.transmitted:null;for(const k of ['orders','transmitted','drafts','delivered','errors','unsynced','commission'] as const)total[k]+=r[k]}
 total.deliveryRate=total.transmitted?100*total.delivered/total.transmitted:null;
 return {members:rows.sort((a,b)=>b.orders-a.orders||a.name.localeCompare(b.name,'fr')),totals:total,activeMembers:members.filter(m=>m.active===1).length,totalMembers:members.length,excludedOrders,from,to};
}
