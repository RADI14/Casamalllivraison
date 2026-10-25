"""Read-only mock carrier checks; all order writes stay in a temporary SQLite database."""
import os,subprocess,tempfile,time,urllib.request,urllib.error,json,secrets,sqlite3,uuid
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
with tempfile.TemporaryDirectory() as temp:
 password=secrets.token_urlsafe(24);dbfile=temp+'/app.sqlite';preload=temp+'/atlas.mjs'
 Path(preload).write_text("const original=globalThis.fetch;globalThis.fetch=(url,options)=>{if(String(url).startsWith('https://api.atlaslivraison.com/'))throw Error('No carrier calls in analysis test');return original(url,options)}")
 env={**os.environ,'SQLITE_PATH':dbfile,'OWNER_EMAIL':'owner@test.com','ADMIN_PASSWORD':password,'ATLAS_API_KEY':'mock-api-key','PORT':'3192','HOSTNAME':'127.0.0.1','NODE_ENV':'production','APP_URL':'http://127.0.0.1:3192'}
 log=open('/tmp/dashboard-paid-http.log','w');proc=subprocess.Popen(['node','--import',preload,'.next/standalone/server.js'],cwd=root,env=env,stdout=log,stderr=log);base='http://127.0.0.1:3192'
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
  assert req('/api/dashboard')[0]==403
  fixture=sqlite3.connect(dbfile)
  fixture.execute("INSERT INTO members(email,name,active,created_at) VALUES('a@test.com','A',1,'2026-10-24')")
  for oid,day in [('old','2026-10-24'),('one','2026-10-25'),('two','2026-10-25')]:
   fixture.execute('INSERT INTO orders(id,payload,status,tracking,created_by,created_email,commission_rate,created_at,updated_at,atlas_state,unit_cost_cents,transport_actual_cents) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',(oid,json.dumps({'fullname':'Demo','product':'Demo','quantity':1,'price':100}),'sent',oid,'A','a@test.com',10,day+'T12:00:00Z',day+'T12:00:00Z',17,2000,1000))
  fixture.commit();fixture.close()
  def dashboard(period=''):
   status,_,data=req('/api/dashboard'+period,cookie=owner);assert status==200;return data
  def agent(data):return next(m for m in data['members'] if m['email']=='a@test.com')
  before=dashboard();assert agent(before)['commissionDueCents']==3000 and before['settlement']['dueCents']==3000
  finance=req('/api/finance',cookie=owner)[2]['total']
  day='?from=2026-10-25&to=2026-10-25'
  assert agent(dashboard(day))['commissionDueCents']==2000
  assert req('/api/commissions',{'id':str(uuid.uuid4()),'email':'a@test.com','amountCents':1000,'note':'Paid one','orderIds':['one']},owner)[0]==201
  after=dashboard();assert agent(after)['commissionDueCents']==2000 and after['settlement']['dueCents']==2000
  assert agent(dashboard(day))['commissionDueCents']==1000
  assert agent(dashboard('?from=2026-10-24&to=2026-10-24'))['commissionDueCents']==1000
  assert req('/api/commissions',{'id':str(uuid.uuid4()),'email':'a@test.com','amountCents':2000,'note':'Paid batch','orderIds':['old','two']},owner)[0]==201
  after=dashboard();assert agent(after)['commissionDueCents']==0 and after['settlement']['dueCents']==0
  assert agent(dashboard(day))['commissionDueCents']==0
  assert after['totals']==before['totals'] and agent(after)['business']==agent(before)['business']
  assert req('/api/finance',cookie=owner)[2]['total']==finance
  print('PASS: individual and batch payments remove dashboard dues immediately; date filters, earned totals and profit preserved')
 finally:
  proc.terminate();proc.wait(timeout=10);log.close()
