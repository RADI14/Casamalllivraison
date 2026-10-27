import {moroccoDay} from './team-statistics.ts';
import {normalizeEmail} from './rules.ts';
export function deliveryTimestamp(value:unknown){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value))return null;
 const time=Date.parse(value);return Number.isFinite(time)&&time<=Date.now()?new Date(time).toISOString():null;
}
export function atlasDeliveredAt(history:unknown){
 if(!Array.isArray(history))throw Error('Historique Atlas invalide.');
 const dates=history.filter(h=>h?.stateId===17).map(h=>deliveryTimestamp(h.at)).filter((d):d is string=>d!==null).sort();
 return dates.at(-1)??null;
}
export function dailyDeliveries(team:any[],orders:any[],days:string[]){
 const result=new Map(team.map(m=>[normalizeEmail(m.email),{points:days.map(date=>({date,delivered:0})),undated:0}]));
 for(const o of orders){if(o.status==='cancelled'||!o.tracking||o.atlasState!==17)continue;const member=result.get(normalizeEmail(o.createdEmail??''));if(!member)continue;const payload=typeof o.payload==='string'?JSON.parse(o.payload):o.payload;const at=deliveryTimestamp(payload?.atlasDeliveredAt);if(!at){member.undated++;continue}const point=member.points.find(p=>p.date===moroccoDay(at));if(point)point.delivered++;}
 return result;
}
