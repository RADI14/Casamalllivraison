"""Read-only mock carrier checks; all order writes stay in a temporary SQLite database."""
import os,subprocess,tempfile,time,urllib.request,urllib.error,json,secrets,sqlite3,uuid
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
with tempfile.TemporaryDirectory() as temp:
 password=secrets.token_urlsafe(24);dbfile=temp+'/app.sqlite';preload=temp+'/atlas.mjs'
 Path(preload).write_text("const original=globalThis.fetch;globalThis.fetch=(url,options)=>{if(String(url).startsWith('https://api.atlaslivraison.com/'))throw Error('No carrier calls in analysis test');return original(url,options)}")
 env={**os.environ,'SQLITE_PATH':dbfile,'OWNER_EMAIL':'owner@test.com','ADMIN_PASSWORD':password,'ATLAS_API_KEY':'mock-api-key','PORT':'3191','HOSTNAME':'127.0.0.1','NODE_ENV':'production','APP_URL':'http://127.0.0.1:3191'}
 log=open('/tmp/team-analysis-http.log','w');proc=subprocess.Popen(['node','--import',preload,'.next/standalone/server.js'],cwd=root,env=env,stdout=log,stderr=log);base='http://127.0.0.1:3191'
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
  agentpass=secrets.token_urlsafe(24)
  assert req('/api/team',{'action':'create','name':'Agent','email':'a@test.com','password':agentpass},owner)[0]==200
  _,h,_=req('/api/auth/login',{'email':'a@test.com','password':agentpass});agent=h['Set-Cookie'].split(';')[0]
  assert req('/api/team',{'action':'create','name':'Second agent','email':'b@test.com','password':agentpass},owner)[0]==200
  fixture=sqlite3.connect(dbfile)
  def order(code,who,day,price=100,state=17,status='sent'):
   payload={'fullname':'Client','phone':'0612345678','product':'Press','quantity':1,'price':price}
   fixture.execute('INSERT INTO orders(id,payload,status,tracking,created_by,created_email,commission_rate,created_at,updated_at,atlas_state,unit_cost_cents,transport_actual_cents) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',(code,json.dumps(payload),status,code,'Agent',who,10,day+'T12:00:00Z',day+'T12:00:00Z',state,5000,2000))
  order('a1','a@test.com','2026-10-20');order('a2','a@test.com','2026-10-20');order('a3','a@test.com','2026-10-19',150)
  order('cancel','a@test.com','2026-10-20',999,status='cancelled');order('b1','b@test.com','2026-10-20',999,state=1)
  for who,amount in [('a@test.com',1000),('b@test.com',0)]:fixture.execute('INSERT INTO ad_expenses(id,product_id,member_email,date,amount_cents,channel,category,cost_type,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',(who,'p',who,'2026-10-20',amount,'Meta','ads','variable','','2026-10-20T12:00:00Z'))
  fixture.commit()
  assert req('/api/dashboard?from=2026-10-20&to=2026-10-20')[0]==403
  assert req('/api/dashboard?from=2026-10-20&to=2026-10-20',cookie=agent)[0]==403
  assert req('/api/dashboard?from=2026-02-30&to=2026-10-20',cookie=owner)[0]==400
  assert req('/api/dashboard?from=2026-10-21&to=2026-10-20',cookie=owner)[0]==400
  def report(day,end):return {m['email']:m for m in req('/api/dashboard?from='+day+'&to='+end,cookie=owner)[2]['members']}
  one=report('2026-10-20','2026-10-20');a=one['a@test.com'];b=one['b@test.com']
  assert a['orders']==3 and a['business']['delivered']==2 and a['business']['revenue']==20000,a
  assert a['business']['commission']==2000 and a['business']['ads']==1000 and a['business']['attributedNet']==3000,a
  assert b['business']['revenue']==0 and b['business']['commission']==0 and b['business']['attributedNet']==-2000,b
  period=report('2026-10-19','2026-10-20')['a@test.com'];assert period['business']['revenue']==35000 and period['business']['attributedNet']==10000,period
  empty=report('2026-10-18','2026-10-18');assert len(empty)==2 and all(m['orders']==0 and m['business']['revenue']==0 for m in empty.values())
  assert empty['a@test.com']['business']['attributedNet'] is None
  print('PASS: day/range agent analysis, revenue vs pending COD, cancellations, costs, commissions, explicit zero advertising, no-data agents, invalid periods and admin-only access')

 finally:
  proc.terminate();proc.wait(timeout=10);log.close()
