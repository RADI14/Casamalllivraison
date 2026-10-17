import sqlite3,pathlib,re,json
root=pathlib.Path(__file__).resolve().parents[1]
c=sqlite3.connect(':memory:')
for p in sorted((root/'drizzle').glob('*.sql')):c.executescript(p.read_text())
source=(root/'app/api/orders/route.ts').read_text()
queries=re.findall(r"\.prepare\((?:'([^']*)'|`([^`]*)`)\)",source)
queries=[a or b for a,b in queries]
assert len(queries)==3,len(queries)
release,restock,cancel=queries
# Legacy local-stock reservations remain cancellable after switching new orders to Atlas stock.
reserve="INSERT INTO orders(id,payload,created_by,created_email,created_at,updated_at,commission_rate,product_id,unit_cost_cents,transport_estimate_cents) SELECT ?,?,?,?,?,?,?,id,cost_cents,transport_cents FROM products WHERE id=? AND active=1 AND stock>=?"
subtract="UPDATE products SET stock=stock-? WHERE id=? AND EXISTS(SELECT 1 FROM orders WHERE id=?)"
ledger="INSERT INTO stock_movements(id,product_id,order_id,delta,reason,actor,created_at) SELECT ?,product_id,id,?,?,?,? FROM orders WHERE id=?"
c.execute("INSERT INTO products(id,sku,name,stock,cost_cents,sale_cents,created_at) VALUES('p','sku','Press',3,4000,19900,'now')")
c.commit()
def reserve_order(order_id,qty):
 with c:
  c.execute(reserve,(order_id,json.dumps({'quantity':qty,'price':199}),'Agent','agent@example.com','now','now',10,'p',qty))
  c.execute(subtract,(qty,'p',order_id))
  c.execute(ledger,(order_id+':reserve',-qty,'reserve','agent@example.com','now',order_id))
def cancel_order(order_id,qty):
 with c:
  c.execute(release,(order_id+':release',qty,'cancel','agent@example.com','now',order_id))
  c.execute(restock,(qty,'p',order_id,order_id+':release'))
  c.execute(cancel,('now',order_id))
reserve_order('o1',2)
reserve_order('o2',2)
assert c.execute('SELECT stock FROM products').fetchone()[0]==1
assert c.execute('SELECT count(*) FROM orders').fetchone()[0]==1
assert c.execute('SELECT count(*) FROM stock_movements').fetchone()[0]==1
c.execute('UPDATE products SET cost_cents=9999');c.commit()
assert c.execute('SELECT unit_cost_cents FROM orders').fetchone()[0]==4000
cancel_order('o1',2);cancel_order('o1',2)
assert c.execute('SELECT stock FROM products').fetchone()[0]==3
assert c.execute('SELECT count(*) FROM stock_movements').fetchone()[0]==2
reserve_order('o3',3)
c.execute("UPDATE orders SET status='sent',tracking='AT3' WHERE id='o3'");c.commit()
cancel_order('o3',3)
assert c.execute('SELECT stock FROM products').fetchone()[0]==0
assert c.execute("SELECT status FROM orders WHERE id='o3'").fetchone()[0]=='sent'
source=(root/'app/api/products/route.ts').read_text()
adjust=re.findall(r"\.prepare\('([^']*)'\)",source)
assert len(adjust)==2
with c:
 c.execute(adjust[0],('adjust-negative',-1,'correction','admin','now','p',-1))
 c.execute(adjust[1],(-1,'p','adjust-negative'))
assert c.execute('SELECT stock FROM products').fetchone()[0]==0
with c:
 c.execute(adjust[0],('physical-return',3,'return received','admin','now','p',3))
 c.execute(adjust[1],(3,'p','physical-return'))
assert c.execute('SELECT stock FROM products').fetchone()[0]==3
print('Inventory SQL passed: atomic reservation, insufficient stock, snapshot costs, cancellation idempotence, sent-order protection and manual adjustments.')
