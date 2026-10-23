"""Read-only mock carrier checks; all order writes stay in a temporary SQLite database."""
import os,subprocess,tempfile,time,urllib.request,urllib.error,json,secrets,sqlite3,uuid
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
with tempfile.TemporaryDirectory() as temp:
 password=secrets.token_urlsafe(24);dbfile=temp+'/app.sqlite';preload=temp+'/atlas.mjs'
 Path(preload).write_text("const original=globalThis.fetch;globalThis.fetch=(url,options)=>{if(String(url).startsWith('https://api.atlaslivraison.com/'))throw Error('No carrier calls in analysis test');return original(url,options)}")
 env={**os.environ,'SQLITE_PATH':dbfile,'OWNER_EMAIL':'owner@test.com','ADMIN_PASSWORD':password,'ATLAS_API_KEY':'mock-api-key','PORT':'3192','HOSTNAME':'127.0.0.1','NODE_ENV':'production','APP_URL':'http://127.0.0.1:3192'}
 log=open('/tmp/team-removal-http.log','w');proc=subprocess.Popen(['node','--import',preload,'.next/standalone/server.js'],cwd=root,env=env,stdout=log,stderr=log);base='http://127.0.0.1:3192'
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
  members=req('/api/team',cookie=owner)[2]['members'];m=next(x for x in members if x['email']=='a@test.com')
  remove={'action':'remove','email':m['email'],'name':m['name'],'originalActive':m['active'],'createdAt':m['createdAt']}
  assert req('/api/team',remove,agent)[0]==403
  assert req('/api/team',remove,owner,origin='http://untrusted.test')[0]==403
  assert req('/api/team',{**remove,'email':'owner@test.com'},owner)[0]==400
  assert req('/api/team',{**remove,'name':'Stale'},owner)[0]==409
  assert req('/api/orders',cookie=agent)[0]==200
  assert req('/api/team',remove,owner)[0]==200
  listed=req('/api/team',cookie=owner)[2];assert all(x['email']!='a@test.com' for x in listed['members'])
  gone=next(x for x in listed['removedMembers'] if x['email']=='a@test.com');assert gone['active']==0
  assert req('/api/auth/login',{'email':'a@test.com','password':agentpass})[0]==401
  assert req('/api/orders',cookie=agent)[0] in (401,403)
  assert req('/api/team',{**remove,'action':'update','oldEmail':m['email'],'originalName':m['name'],'active':True},owner)[0]==409
  assert req('/api/team',{'action':'toggle','email':m['email'],'active':True},owner)[0]==200
  assert req('/api/auth/login',{'email':'a@test.com','password':agentpass})[0]==401
  restore={**remove,'action':'restore','originalActive':0,'deletedAt':gone['deletedAt']}
  assert req('/api/team',restore,owner)[0]==200
  assert req('/api/auth/login',{'email':'a@test.com','password':agentpass})[0]==401
  assert req('/api/team',{'action':'toggle','email':m['email'],'active':True},owner)[0]==200
  assert req('/api/auth/login',{'email':'a@test.com','password':agentpass})[0]==200
  assert req('/api/orders',cookie=agent)[0] in (401,403)
  print('PASS: administrator-only removal, origin and owner protection, stale snapshot, revoked session, login blocked, restoration and explicit reactivation')
 finally:
  proc.terminate();proc.wait(timeout=10);log.close()
