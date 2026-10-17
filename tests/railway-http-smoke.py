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
  team=json.loads(req('/api/team',cookie=owner)[2])['members'];member=next(x for x in team if x['email']=='a@test.com')
  newpass=secrets.token_urlsafe(24)
  update={'action':'update','oldEmail':member['email'],'email':'new@test.com','name':'Renamed','active':True,'originalName':member['name'],'originalActive':member['active'],'createdAt':member['createdAt'],'password':newpass}
  assert req('/api/team',update,cookie=owner)[0]==200
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
  print('PASS: production HTTP login, origin rejection, forged headers, agent isolation, preserved COD amount, account rename/password reset, session revocation, suspension, logout, rate limiting and SQLite persistence.')
 finally:p.terminate();p.wait(timeout=15);log.close()
