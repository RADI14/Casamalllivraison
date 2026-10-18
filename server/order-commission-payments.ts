import type {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {commissionOrderLedger,type Allocation} from '../app/commission-order-ledger.ts';
import {commission,normalizeEmail} from '../app/rules.ts';
import {tokenHash} from './passwords.ts';
const orderColumns='id,created_email AS createdEmail,created_at AS createdAt,status,tracking,atlas_state AS atlasState,commission_rate AS commissionRate';
export function loadCommissionLedger(db:DatabaseSync,email?:string){
 const orders=db.prepare('SELECT '+orderColumns+' FROM orders'+(email?' WHERE lower(trim(created_email))=?':'')).all(...(email?[email]:[])) as any[];
 const payments=db.prepare('SELECT id,member_email AS memberEmail,amount_cents AS amountCents,paid_at AS paidAt FROM commission_payments'+(email?' WHERE member_email=?':'')).all(...(email?[email]:[])) as any[];
 const allocations=db.prepare('SELECT a.id,a.order_id AS orderId,a.payment_id AS paymentId,a.amount_cents AS amountCents,a.created_at AS createdAt,a.released_at AS releasedAt FROM commission_order_allocations a JOIN commission_payments p ON p.id=a.payment_id'+(email?' WHERE p.member_email=?':'')).all(...(email?[email]:[])) as Allocation[];
 return {orders,allocations,...commissionOrderLedger(orders,payments,allocations)};
}
export type PaymentRequest={id:string;email:string;amountCents:number;note:string;orderIds?:string[]};
export class CommissionPaymentError extends Error{readonly status:number;constructor(message:string,status=409){super(message);this.status=status}}
export function recordOrderCommissionPayment(db:DatabaseSync,b:PaymentRequest,actor:string){
 if(b.orderIds&&(!b.orderIds.length||new Set(b.orderIds).size!==b.orderIds.length))throw new CommissionPaymentError('Champs invalides',400);
 const email=normalizeEmail(b.email),hash=tokenHash(JSON.stringify([email,b.orderIds?[...b.orderIds].sort():'all',b.amountCents]));
 db.exec('BEGIN IMMEDIATE');
 try{
  const existing=db.prepare('SELECT member_email,amount_cents,selection_hash FROM commission_payments WHERE id=?').get(b.id);
  if(existing){if(existing.member_email!==email||existing.amount_cents!==b.amountCents||(existing.selection_hash!==null&&existing.selection_hash!==hash))throw new CommissionPaymentError('Payment reference already used.');db.exec('COMMIT');return {ok:true,id:b.id,replayed:true}}
  if(!db.prepare('SELECT email FROM members WHERE email=?').get(email))throw new CommissionPaymentError('Collaboratrice introuvable',404);
  const ledger=loadCommissionLedger(db,email),byId=new Map(ledger.orders.map(o=>[o.id,o]));
  const ids=b.orderIds??ledger.orders.filter(o=>ledger.states.get(o.id)!.commissionDueCents>0).map(o=>o.id);
  if(!ids.length||ids.some(id=>!byId.has(id)||!commission(byId.get(id))))throw new CommissionPaymentError('Selected commission orders changed. Refresh before confirming payment.');
  const amount=ids.reduce((sum,id)=>sum+ledger.states.get(id)!.commissionDueCents,0);
  if(amount<=0||amount!==b.amountCents)throw new CommissionPaymentError('Commission balance changed. Refresh before confirming payment.');
  const now=new Date().toISOString(),preserve=new Set(ledger.planned.map(a=>a.sourceId).filter(Boolean));
  for(const a of ledger.allocations)if(!a.releasedAt&&!preserve.has(a.id))db.prepare('UPDATE commission_order_allocations SET released_at=? WHERE id=? AND released_at IS NULL').run(now,a.id);
  for(const a of ledger.planned)if(!a.sourceId)db.prepare('INSERT INTO commission_order_allocations(id,order_id,payment_id,amount_cents,created_at) VALUES(?,?,?,?,?)').run(randomUUID(),a.orderId,a.paymentId,a.amountCents,now);
  db.prepare('INSERT INTO commission_payments(id,member_email,amount_cents,paid_at,paid_by,note,selection_hash) VALUES(?,?,?,?,?,?,?)').run(b.id,email,amount,now,actor,b.note,hash);
  for(const id of ids){const due=ledger.states.get(id)!.commissionDueCents;if(due>0)db.prepare('INSERT INTO commission_order_allocations(id,order_id,payment_id,amount_cents,created_at) VALUES(?,?,?,?,?)').run(randomUUID(),id,b.id,due,now)}
  db.exec('COMMIT');return {ok:true,id:b.id,paidOrders:ids.length,amountCents:amount};
 }catch(e){db.exec('ROLLBACK');throw e}
}
