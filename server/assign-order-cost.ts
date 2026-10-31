import type {DatabaseSync} from 'node:sqlite';
export function assignOrderCost(db:DatabaseSync,b:any){
 if(typeof b?.orderId!=='string'||!b.orderId||typeof b.productId!=='string'||!b.productId||typeof b.expectedUpdatedAt!=='string'||!Number.isSafeInteger(b.costCents)||b.costCents<0||!Number.isInteger(b.totalUnits)||b.totalUnits<1||b.totalUnits>1000)throw Object.assign(Error('Champs invalides.'),{status:400});
 db.exec('BEGIN IMMEDIATE');try{
 const p=db.prepare('SELECT id,cost_cents FROM products WHERE id=?').get(b.productId) as any;
 const o=db.prepare('SELECT * FROM orders WHERE id=?').get(b.orderId) as any;
 if(!p||!o)throw Object.assign(Error('Commande ou produit introuvable.'),{status:404});
 if(p.cost_cents!==b.costCents||o.updated_at!==b.expectedUpdatedAt||o.unit_cost_cents!==null||o.status==='cancelled'||!o.tracking||o.atlas_state!==17)throw Object.assign(Error('Données modifiées. Actualisez avant de compléter le coût.'),{status:409});
 const quantity=JSON.parse(o.payload).quantity,total=p.cost_cents*b.totalUnits;
 if(!Number.isInteger(quantity)||quantity<1||!Number.isSafeInteger(total)||total%quantity!==0)throw Object.assign(Error('Le coût total doit se répartir exactement sur la quantité Atlas.'),{status:400});
 db.prepare('UPDATE orders SET product_id=?,unit_cost_cents=?,updated_at=? WHERE id=? AND unit_cost_cents IS NULL').run(p.id,total/quantity,new Date().toISOString(),o.id);
 db.exec('COMMIT');return {updated:1,totalCostCents:total};
 }catch(e){db.exec('ROLLBACK');throw e}
}
