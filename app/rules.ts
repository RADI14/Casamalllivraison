export type Actor = {email:string;role:'admin'|'agent'};
export const normalizeEmail=(email:string)=>email.trim().toLowerCase();
export function canAccessOrder(actor:Actor,order:{createdEmail:string|null}){return actor.role==='admin'||(!!order.createdEmail&&normalizeEmail(order.createdEmail)===actor.email)}
export function commission(order:{atlasState:number|null;tracking:string|null;commissionRate:number;status?:string}){return order.status!=='cancelled'&&order.tracking&&order.atlasState===17&&order.commissionRate===10?10:0}
