"""Read-only mock carrier checks; all order writes stay in a temporary SQLite database."""
import os,subprocess,tempfile,time,urllib.request,urllib.error,json,secrets,sqlite3,uuid,io
from datetime import datetime,timezone,timedelta
from openpyxl import load_workbook
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
with tempfile.TemporaryDirectory() as temp:
 password=secrets.token_urlsafe(24);dbfile=temp+'/app.sqlite';preload=temp+'/atlas.mjs'
 Path(preload).write_text("const original=globalThis.fetch;globalThis.fetch=(url,options={})=>{if(String(url).endsWith('/stocks'))return Promise.resolve(Response.json({success:true,data:[{stockId:'stock-test',sku:'TEST',name:'Stock product',available:100,frozen:false}]}));if(String(url).startsWith('https://api.atlaslivraison.com/')&&options.method==='POST'&&String(url).endsWith('/colis'))return Promise.resolve(Response.json({success:true,data:{code:'TEST-'+options.headers['Idempotency-Key'],cfees:35}}));if(String(url).startsWith('https://api.atlaslivraison.com/'))throw Error('Unexpected carrier call');return original(url,options)}")

 env={**os.environ,'SQLITE_PATH':dbfile,'OWNER_EMAIL':'owner@test.com','ADMIN_PASSWORD':password,'ATLAS_API_KEY':'mock-api-key','PORT':'3192','HOSTNAME':'127.0.0.1','NODE_ENV':'production','APP_URL':'http://127.0.0.1:3192'}
 log=open('/tmp/operations-http.log','w');proc=subprocess.Popen(['node','--import',preload,'.next/standalone/server.js'],cwd=root,env=env,stdout=log,stderr=log);base='http://127.0.0.1:3192'
 def req(path,body=None,cookie='',origin=base,raw=False):
  headers={'Content-Type':'application/json','Origin':origin}
  if cookie:headers['Cookie']=cookie
  request=urllib.request.Request(base+path,headers=headers,data=json.dumps(body).encode() if body is not None else None)
  try:r=urllib.request.urlopen(request);return r.status,r.headers,(r.read() if raw else json.loads(r.read()))
  except urllib.error.HTTPError as e:return e.code,e.headers,(e.read() if raw else json.loads(e.read()))
 try:
  for _ in range(100):
   try:
    if req('/api/health')[0]==200:break
   except Exception:pass
   if proc.poll() is not None:raise RuntimeError('server exited')
   time.sleep(.2)
  else:raise RuntimeError('health timed out')
  status,h,_=req('/api/auth/login',{'email':'owner@test.com','password':password});assert status==200;owner=h['Set-Cookie'].split(';')[0]
  assert req('/api/product-costs?view=missing')[0]==403
  db=sqlite3.connect(dbfile);db.create_function('audit_actor',0,lambda:'fixture')
  db.execute("INSERT INTO products(id,sku,name,stock,cost_cents,sale_cents,created_at) VALUES('p','SKU','Squeegee',10,2500,9900,'now')")
  payload=json.dumps({'product':'Squeegee x2','quantity':1,'price':199})
  db.execute("INSERT INTO orders(id,payload,status,tracking,created_by,created_at,updated_at,atlas_state) VALUES('o',?,'sent','STK','A','2026-10-10','stamp',17)",(payload,));db.commit()
  status,h,data=req('/api/product-costs?view=missing',cookie=owner);assert status==200 and len(data['orders'])==1 and data['orders'][0]['quantity']==1
  b={'action':'assign','orderId':'o','productId':'p','costCents':2500,'totalUnits':2,'expectedUpdatedAt':'stamp'}
  assert req('/api/product-costs',b,owner,origin='https://untrusted.test')[0]==403
  assert req('/api/product-costs',{**b,'costCents':1},owner)[0]==409
  assert req('/api/product-costs',b,owner)[2]['updated']==1
  assert req('/api/product-costs',b,owner)[0]==409
  assert req('/api/product-costs?view=missing',cookie=owner)[2]['orders']==[]
  assert db.execute('SELECT unit_cost_cents,payload FROM orders').fetchone()==(5000,payload)
  assert db.execute('SELECT stock,cost_cents,sale_cents FROM products').fetchone()==(10,2500,9900)
  audit=db.execute("SELECT actor,after_json FROM audit_events WHERE entity='orders' ORDER BY id DESC LIMIT 1").fetchone();assert audit[0]=='owner@test.com' and json.loads(audit[1])['unit_cost_cents']==5000
  db.close()
  print('PASS: explicit cost linking, pack count, admin-only, CSRF, stale rejection, preserved Atlas data and audit attribution')
 finally:
  proc.terminate();proc.wait(timeout=10);log.close()
