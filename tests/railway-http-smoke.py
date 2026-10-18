import os,subprocess,tempfile,time,urllib.request,urllib.error,json,secrets,sqlite3
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
with tempfile.TemporaryDirectory() as temp:
 password=secrets.token_urlsafe(24);dbfile=temp+'/app.sqlite';env={**os.environ,'SQLITE_PATH':dbfile,'OWNER_EMAIL':'owner@test.com','ADMIN_PASSWORD':password,'PORT':'3187','HOSTNAME':'127.0.0.1','NODE_ENV':'production','APP_URL':'http://127.0.0.1:3187'}
 log=open('/tmp/railway-http.log','w');p=subprocess.Popen(['node','.next/standalone/server.js'],cwd=root,env=env,stdout=log,stderr=log)
 base='http://127.0.0.1:3187'
 def req(path,body=None,cookie='',origin=True,spoof=False):
  headers={'Content-Type':'application/json'}
  if origin: headers['Origin']=base
  if cookie:headers['Cookie']=cookie
  if spoof:headers.update({'oai-authenticated-user-email':'owner@test.com','cf-access-jwt-assertion':'forged'})
  request=urllib.request.Request(base+path,headers=headers,data=json.dumps(body).encode() if body is not None else None)
  try:r=urllib.request.urlopen(request);return r.status,r.headers,r.read().decode()
  except urllib.error.HTTPError as e:return e.code,e.headers,e.read().decode()
 try:
  for _ in range(100):
   try:
    if req('/api/health')[0]==200:break
   except Exception:pass
   if p.poll() is not None:raise RuntimeError('server exited')
   time.sleep(.2)
  else:raise RuntimeError('health timed out')
  assert req('/api/orders',spoof=True)[0]==403
  assert req('/api/auth/login',{'email':'owner@test.com','password':password},origin=False)[0]==403
  bad=req('/api/auth/login',{'email':'owner@test.com','password':'wrong'});assert bad[0]==401,(bad[0],bad[2])
  status,h,_=req('/api/auth/login',{'email':'owner@test.com','password':password});assert status==200
  owner=h['Set-Cookie'].split(';')[0];assert all(x in h['Set-Cookie'] for x in ['HttpOnly','Secure','SameSite=lax'])
  assert req('/api/orders',cookie=owner)[0]==200
  agentpass=secrets.token_urlsafe(24)
  for name,email in [('Agent A','a@test.com'),('Agent B','b@test.com')]:assert req('/api/team',{'action':'create','name':name,'email':email,'password':agentpass},cookie=owner)[0]==200
  # Create local drafts only, without any carrier credentials or external request.
  def draft(name):return {'action':'create','payload':{'fulfillmentMode':'normal','fullname':name,'phone':'0612345678','phone2':'','address':'10 rue des fleurs Kenitra','cityName':'Kenitra','cityId':'','storeId':'','product':'Test product','quantity':1,'price':199,'note':'','openpackage':True}}
  agents={}
  for email in ['a@test.com','b@test.com']:
   status,h,_=req('/api/auth/login',{'email':email,'password':agentpass});assert status==200;cookie=h['Set-Cookie'].split(';')[0];agents[email]=cookie
   assert req('/api/orders',draft(email),cookie=cookie)[0]==201
   assert req('/api/team',cookie=cookie)[0]==403
  for email,cookie in agents.items():
   status,_,data=req('/api/orders',cookie=cookie);rows=json.loads(data)['orders'];assert len(rows)==1 and rows[0]['createdEmail']==email and rows[0]['payload']['price']==199
  assert len(json.loads(req('/api/orders',cookie=owner)[2])['orders'])==2
  allrows=json.loads(req('/api/orders',cookie=owner)[2])['orders'];other=next(r for r in allrows if r['createdEmail']=='b@test.com')['id']
  scoped=json.loads(req('/api/orders?createdEmail=b@test.com',cookie=agents['a@test.com'])[2])['orders'];assert all(r['createdEmail']=='a@test.com' for r in scoped)
  assert req('/api/orders',{'action':'cancel','id':other},cookie=agents['a@test.com'])[0]==409
  assert req('/api/orders',{'action':'send','id':other},cookie=agents['a@test.com'])[0] in [404,409]
  expense={'date':'2026-10-18','amount':'199.50','category':'chatgpt','costType':'fixed','channel':'ChatGPT','note':'Subscription','productId':'','memberEmail':''}
  for path in ['/api/expenses','/api/finance']:
   assert req(path,cookie=agents['a@test.com'])[0]==403
  assert req('/api/expenses',expense,cookie=agents['a@test.com'])[0]==403
  assert req('/api/expenses',expense,cookie=owner,origin=False)[0]==403
  assert req('/api/expenses',{**expense,'category':'invalid'},cookie=owner)[0]==400
  assert req('/api/expenses',None,cookie=owner)[0]==200
  assert req('/api/expenses',expense,cookie=owner)[0]==201
  rows=json.loads(req('/api/expenses',cookie=owner)[2])['expenses'];assert len(rows)==1 and rows[0]['category']=='chatgpt' and rows[0]['costType']=='fixed' and rows[0]['amountCents']==19950
  report=json.loads(req('/api/finance?from=2026-10-18&to=2026-10-18',cookie=owner)[2]);assert report['total']['overheads']==19950 and report['total']['net']==-19950 and report['total']['ads']==0
  dashboard=json.loads(req('/api/dashboard',cookie=owner)[2]);assert dashboard['members']
  assert req('/api/expenses',{'action':'delete','id':rows[0]['id']},cookie=owner)[0]==200
  assert json.loads(req('/api/finance',cookie=owner)[2])['total']['overheads']==0
  recovery='/api/auth/recovery'
  assert req(recovery,{'email':'a@test.com'},origin=False)[0]==403
  assert req(recovery,{'email':'bad'})[0]==400
  for email in ['a@test.com','unknown@test.com','owner@test.com']:
   status,_,body=req(recovery,{'email':email});assert status==200 and json.loads(body)=={'ok':True}
   assert 'password' not in body and 'token' not in body
  for _ in range(5):assert req(recovery,{'email':'a@test.com'})[0]==200
  requestdb=sqlite3.connect(dbfile)
  assert requestdb.execute('SELECT COUNT(*) FROM app_password_recovery').fetchone()[0]==1
  assert req('/api/auth/login',{'email':'a@test.com','password':agentpass})[0]==200
  assert req('/api/team',cookie=agents['a@test.com'])[0]==403
  recoveryteam=json.loads(req('/api/team',cookie=owner)[2])['members'];assert next(m for m in recoveryteam if m['email']=='a@test.com')['recoveryRequestedAt']
  team=json.loads(req('/api/team',cookie=owner)[2])['members'];member=next(x for x in team if x['email']=='a@test.com')
  newpass=secrets.token_urlsafe(24)
  update={'action':'update','oldEmail':member['email'],'email':'new@test.com','name':'Renamed','active':True,'originalName':member['name'],'originalActive':member['active'],'createdAt':member['createdAt'],'password':newpass}
  assert req('/api/team',update,cookie=owner)[0]==200
  assert requestdb.execute('SELECT COUNT(*) FROM app_password_recovery').fetchone()[0]==0
  requestdb.close()
  assert req('/api/orders',cookie=agents['a@test.com'])[0]==403
  assert req('/api/auth/login',{'email':'a@test.com','password':agentpass})[0]==401
  status,h,_=req('/api/auth/login',{'email':'new@test.com','password':newpass});assert status==200;newcookie=h['Set-Cookie'].split(';')[0]
  rows=json.loads(req('/api/orders',cookie=newcookie)[2])['orders'];assert len(rows)==1 and rows[0]['createdEmail']=='new@test.com'
  assert req('/api/team',{'action':'toggle','email':'new@test.com','active':False},cookie=owner)[0]==200
  assert req('/api/orders',cookie=newcookie)[0]==403
  assert req('/api/auth/login',{'email':'new@test.com','password':newpass})[0]==401
  assert req('/api/auth/logout',{},cookie=owner)[0]==200
  assert req('/api/orders',cookie=owner)[0]==403
  for _ in range(11):status,_,_=req('/api/auth/login',{'email':'none@test.com','password':'wrong'})
  assert status==429
  db=sqlite3.connect(dbfile);assert db.execute('SELECT COUNT(*) FROM orders').fetchone()[0]==2
  assert all(not x[0].startswith(agentpass) for x in db.execute('SELECT password_hash FROM app_credentials'))
  print('PASS: production HTTP login, origin rejection, forged headers, agent isolation, preserved COD amount, account rename/password reset, session revocation, suspension, logout, rate limiting SQLite persistence and admin-reviewed password recovery.')
 finally:p.terminate();p.wait(timeout=15);log.close()
