"""Read-only mock carrier checks; all order writes stay in a temporary SQLite database."""
import os,subprocess,tempfile,time,urllib.request,urllib.error,json,secrets,sqlite3,uuid
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
with tempfile.TemporaryDirectory() as temp:
 password=secrets.token_urlsafe(24);dbfile=temp+'/app.sqlite';preload=temp+'/atlas.mjs'
 remote_file=temp+'/remote.json'
 remote={'AT-A':{'code':'AT-A','stateId':17,'stateName':'Livré','product':'P','quantity':2,'price':'249.50','cfees':'35.00'},'AT-B':{'code':'AT-B','stateId':17,'stateName':'Livré','product':'P','quantity':1,'price':'159.00','cfees':'25.00'},'AT-P':{'code':'AT-P','stateId':12,'stateName':'En cours','product':'P','quantity':1,'price':'99.00','cfees':'20.00'}}
 Path(remote_file).write_text(json.dumps(remote))
 Path(preload).write_text("import {readFileSync} from 'node:fs'; const original=globalThis.fetch;globalThis.fetch=(url,options)=>{if(String(url).startsWith('https://api.atlaslivraison.com/api/external/colis/')){const code=decodeURIComponent(String(url).split('/').at(-1));const data=JSON.parse(readFileSync("+json.dumps(remote_file)+",'utf8'))[code];return Promise.resolve(Response.json({success:true,data}));}if(String(url).startsWith('https://api.atlaslivraison.com/'))throw Error('Unexpected carrier call');return original(url,options)}")

 env={**os.environ,'SQLITE_PATH':dbfile,'OWNER_EMAIL':'owner@test.com','ADMIN_PASSWORD':password,'ATLAS_API_KEY':'mock-api-key','PORT':'3192','HOSTNAME':'127.0.0.1','NODE_ENV':'production','APP_URL':'http://127.0.0.1:3192'}
 log=open('/tmp/atlas-agent-profit-http.log','w');proc=subprocess.Popen(['node','--import',preload,'.next/standalone/server.js'],cwd=root,env=env,stdout=log,stderr=log);base='http://127.0.0.1:3192'
 def req(path,body=None,cookie='',origin=base):
  headers={'Content-Type':'application/json','Origin':origin}
  if cookie:headers['Cookie']=cookie
  request=urllib.request.Request(base+path,headers=headers,data=json.dumps(body).encode() if body is not None else None)
  try:r=urllib.request.urlopen(request);return r.status,r.headers,json.loads(r.read())
  except urllib.error.HTTPError as e:return e.code,e.headers,json.loads(e.read())
 try:
  for _ in range(100):
   try:
    if req('/api/health')[0]==200:break
   except Exception:pass
   if proc.poll() is not None:raise RuntimeError('server exited')
   time.sleep(.2)
  else:raise RuntimeError('health timed out')
  status,h,_=req('/api/auth/login',{'email':'owner@test.com','password':password});assert status==200;owner=h['Set-Cookie'].split(';')[0]
  fixture=sqlite3.connect(dbfile);fixture.create_function('audit_actor',0,lambda:'test-fixture')
  fixture.execute("INSERT INTO members(email,name,active,created_at) VALUES('a@test.com','A',1,'2026-10-25'),('b@test.com','B',1,'2026-10-25')")
  fixture.execute("INSERT INTO products(id,sku,name,stock,cost_cents,sale_cents,created_at) VALUES('p','P','P',10,4000,99900,'2026-10-25')")
  for oid,email,code,cost in [('a','a@test.com','AT-A',4000),('b','b@test.com','AT-B',3000),('pending','a@test.com','AT-P',4000)]:
   fixture.execute('INSERT INTO orders(id,payload,status,tracking,created_by,created_email,commission_rate,created_at,updated_at,product_id,unit_cost_cents) VALUES(?,?,?,?,?,?,?,?,?,?,?)',(oid,json.dumps({'fullname':'Demo','product':'P','quantity':1,'price':999}),'sent',code,email,email,10,'2026-10-25T12:00:00Z','2026-10-25T12:00:00Z','p',cost))
  fixture.execute("INSERT INTO ad_expenses(id,member_email,product_id,date,amount_cents,channel,created_at) VALUES('ad','a@test.com','p','2026-10-25',2000,'Meta Ads','2026-10-25')")
  fixture.commit();fixture.close()
  def sync():
   status,_,data=req('/api/sync',{},owner);assert status==200 and data['updated']==3 and data['failed']==0,data
  def dashboard():
   status,_,data=req('/api/dashboard?from=2026-10-25&to=2026-10-25',cookie=owner);assert status==200;return {m['email']:m['business'] for m in data['members']}
  sync();d=dashboard();a=d['a@test.com'];b=d['b@test.com']
  assert a['revenue']==24950 and a['transport']==5500 and a['afterDelivery']==19450
  assert a['goodsCost']==8000 and a['commission']==1000 and a['netBeforeAds']==10450 and a['attributedNet']==8450
  assert b['revenue']==15900 and b['transport']==2500 and b['afterDelivery']==13400 and b['netBeforeAds']==9400 and b['attributedNet'] is None
  report=req('/api/finance',cookie=owner)[2];assert report['total']['revenue']==40850 and report['total']['transport']==8000
  sync();assert dashboard()==d
  remote['AT-A'].update(price='209.50',cfees='45.00');Path(remote_file).write_text(json.dumps(remote));sync()
  d=dashboard();assert d['a@test.com']['afterDelivery']==14450 and d['a@test.com']['attributedNet']==3450 and d['b@test.com']==b
  remote['AT-A']['stateId']=18;Path(remote_file).write_text(json.dumps(remote));sync()
  a=dashboard()['a@test.com'];assert a['revenue']==0 and a['commission']==0 and a['goodsCost']==0 and a['attributedNet']==-8500
  print('PASS: Atlas price and fees drive per-agent sales, delivery balance and profits; quantity, ad allocation, repeat sync and corrections validated')
 finally:
  proc.terminate();proc.wait(timeout=10);log.close()
