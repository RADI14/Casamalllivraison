import {getDb} from '../db';
import {members,orders,products,adExpenses,commissionPayments} from '../db/schema';
import {getSqlite} from './sqlite';
import type {OperationsInput} from '../app/operations-rules';
export async function loadOperations():Promise<OperationsInput>{
 const db=getDb(),[team,records,catalog,expenses,payments]=await Promise.all([db.select().from(members),db.select().from(orders),db.select().from(products),db.select().from(adExpenses),db.select().from(commissionPayments)]);
 const sql=getSqlite().connection;
 return {team,orders:records,products:catalog,expenses,payments,allocations:sql.prepare('SELECT id,order_id AS orderId,payment_id AS paymentId,amount_cents AS amountCents,created_at AS createdAt,released_at AS releasedAt FROM commission_order_allocations').all() as OperationsInput['allocations'],receipts:sql.prepare('SELECT id,reference,amount_cents,received_on,note,created_at,voided_at FROM carrier_receipts ORDER BY received_on DESC,created_at DESC').all()};
}
