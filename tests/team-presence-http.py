"""Read-only mock carrier checks; all order writes stay in a temporary SQLite database."""
import os,subprocess,tempfile,time,urllib.request,urllib.error,json,secrets,sqlite3,uuid
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
with tempfile.TemporaryDirectory() as temp:
 password=secrets.token_urlsafe(24);dbfile=temp+'/app.sqlite';preload=temp+'/atlas.mjs'
 Path(preload).write_text("const original=globalThis.fetch;globalThis.fetch=(url,options)=>{if(String(url).startsWith('https://api.atlaslivraison.com/'))throw Error('No carrier calls in analysis test');return original(url,options)}")
 env={**os.environ,'SQLITE_PATH':dbfile,'OWNER_EMAIL':'owner@test.com','ADMIN_PASSWORD':password,'ATLAS_API_KEY':'mock-api-key','PORT':'3192','HOSTNAME':'127.0.0.1','NODE_ENV':'production','APP_URL':'http://127.0.0.1:3192'}
 log=open('/tmp/team-presence-http.log','w');proc=subprocess.Popen(['node','--import',preload,'.next/standalone/server.js'],cwd=root,env=env,stdout=log,stderr=log);base='http://127.0.0.1:3192'
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
  assert req('/api/presence')[0]==403
  assert req('/api/presence',{})[0]==403
  agentpass=secrets.token_urlsafe(24)
  assert req('/api/team',{'action':'create','name':'Agent','email':'a@test.com','password':agentpass},owner)[0]==200
  assert req('/api/team',{'action':'create','name':'Second','email':'b@test.com','password':agentpass},owner)[0]==200
  def login(email):
   status,h,_=req('/api/auth/login',{'email':email,'password':agentpass});assert status==200;return h['Set-Cookie'].split(';')[0]
  agent=login('a@test.com');second=login('a@test.com')
  assert req('/api/presence',cookie=agent)[0]==403
  assert req('/api/presence',{},agent,origin='http://untrusted.test')[0]==403
  assert req('/api/presence',{'email':'b@test.com'},agent)[0]==200
  def states():
   status,h,data=req('/api/presence',cookie=owner);assert status==200 and 'no-store' in h['Cache-Control'];return {m['email']:m for m in data['members']}
  initial=states();a=initial['a@test.com'];assert a['online'] and a['startedAt'] and a['lastSeen'];assert not initial['b@test.com']['online']
  assert set(a)=={'email','online','startedAt','lastSeen'}
  assert req('/api/presence',{},agent)[0]==200
  assert states()['a@test.com']['startedAt']==a['startedAt']
  # A second session keeps the account online when the first logs out.
  assert req('/api/presence',{},second)[0]==200
  assert req('/api/auth/logout',{},agent)[0]==200
  assert states()['a@test.com']['online']
  assert req('/api/auth/logout',{},second)[0]==200
  offline=states()['a@test.com'];assert not offline['online'] and offline['lastSeen'] and offline['startedAt'] is None
  agent=login('a@test.com');assert req('/api/presence',{},agent)[0]==200
  fixture=sqlite3.connect(dbfile);fixture.execute("UPDATE team_presence SET last_seen=last_seen-120000 WHERE email='a@test.com'");fixture.commit();fixture.close()
  assert not states()['a@test.com']['online']
  assert req('/api/presence',{},agent)[0]==200
  assert states()['a@test.com']['startedAt']>a['startedAt']
  assert req('/api/team',{'action':'toggle','email':'a@test.com','active':False},owner)[0]==200
  assert not states()['a@test.com']['online'] and req('/api/presence',{},agent)[0]==403
  team=req('/api/team',cookie=owner)[2]['members'];m=next(m for m in team if m['email']=='a@test.com')
  assert req('/api/team',{'action':'remove','email':m['email'],'name':m['name'],'originalActive':m['active'],'createdAt':m['createdAt']},owner)[0]==200
  assert 'a@test.com' not in states()
  print('PASS: presence role and origin checks, authenticated identity, duration, expiry, multiple sessions, logout, suspension and removal')
 finally:
  proc.terminate();proc.wait(timeout=10);log.close()
