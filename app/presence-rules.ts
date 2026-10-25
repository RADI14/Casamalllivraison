export const presenceTimeoutMs=90000;
export const presenceHeartbeatMs=30000;
export const presenceIdleMs=5*60000;
export type Presence={email:string;online:boolean;startedAt:number|null;lastSeen:number|null};
type Signal={startedAt:number;lastSeen:number;validSession:boolean};
export function summarizePresence(email:string,active:boolean,signals:Signal[],now:number):Presence{
 const recent=signals.filter(s=>active&&s.validSession&&s.lastSeen<=now&&now-s.lastSeen<presenceTimeoutMs);
 return {email,online:recent.length>0,startedAt:recent.length?Math.min(...recent.map(s=>s.startedAt)):null,lastSeen:signals.length?Math.max(...signals.map(s=>s.lastSeen)):null};
}
