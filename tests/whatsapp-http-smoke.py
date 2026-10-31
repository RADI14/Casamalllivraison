import sqlite3,uuid,os,subprocess,tempfile,time,urllib.request,urllib.error,json,secrets
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
with tempfile.TemporaryDirectory() as temp:
 password=secrets.token_urlsafe(24)
 env={k:v for k,v in os.environ.items() if not k.startswith(('WHATSAPP_','OPENAI_'))}
 env.update(SQLITE_PATH=temp+'/app.sqlite',OWNER_EMAIL='owner@test.com',ADMIN_PASSWORD=password,PORT='3192',HOSTNAME='127.0.0.1',NODE_ENV='production',APP_URL='http://127.0.0.1:3192')
 log=open('/tmp/whatsapp-http-smoke.log','w');proc=subprocess.Popen(['node','.next/standalone/server.js'],cwd=root,env=env,stdout=log,stderr=log)
 base='http://127.0.0.1:3192'
 def req(path,body=None,cookie='',origin=base):
  headers={'Content-Type':'application/json','Origin':origin}
  if cookie:headers['Cookie']=cookie
  request=urllib.request.Request(base+path,headers=headers,data=json.dumps(body).encode() if body is not None else None)
  try:
   with urllib.request.urlopen(request,timeout=15) as r:return r.status,r.headers,r.read().decode()
  except urllib.error.HTTPError as e:return e.code,e.headers,e.read().decode()
 try:
  for _ in range(100):
   try:
    if req('/api/health')[0]==200:break
   except Exception:pass
   if proc.poll() is not None:raise RuntimeError('server exited')
   time.sleep(.2)
  else:raise RuntimeError('health timed out')
  assert req('/api/whatsapp')[0]==403
  s,h,_=req('/api/auth/login',{'email':'owner@test.com','password':password});assert s==200
  owner=h['Set-Cookie'].split(';')[0]
  s,_,body=req('/api/whatsapp',cookie=owner);assert s==200
  state=json.loads(body);assert state['connection']['sendEnabled'] is False and state['connection']['metaConfigured'] is False
  assert 'OPENAI_API_KEY' in state['connection']['aiMissing']
  assert req('/api/whatsapp',{'action':'check'},cookie=owner,origin='https://evil.test')[0]==403
  assert req('/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc')[0]==403
  assert req('/api/whatsapp/webhook',{})[0]==503
  agentpass=secrets.token_urlsafe(24)
  assert req('/api/team',{'action':'create','name':'Agent','email':'agent@test.com','password':agentpass},cookie=owner)[0]==200
  s,h,_=req('/api/auth/login',{'email':'agent@test.com','password':agentpass});assert s==200
  agent=h['Set-Cookie'].split(';')[0]
  assert req('/api/whatsapp',cookie=agent)[0]==200
  assert req('/api/whatsapp',{'action':'enroll','orderId':'x','consent':True},cookie=agent)[0]==409
  payload={'fulfillmentMode':'normal','fullname':'Test client','phone':'0612345678','phone2':'','address':'10 rue des fleurs Kenitra','cityName':'Kenitra','cityId':'','storeId':'','product':'Test product','quantity':1,'price':199,'note':'','openpackage':False}
  order_id=str(uuid.uuid4());fixture=sqlite3.connect(temp+'/app.sqlite');at='2026-10-18T12:00:00.000Z';fixture.execute('INSERT INTO orders(id,payload,created_by,created_email,created_at,updated_at,stock_released) VALUES(?,?,?,?,?,?,?)',(order_id,json.dumps(payload),'Owner','owner@test.com',at,at,1));fixture.commit();fixture.close()
  s,_,body=req('/api/whatsapp',{'action':'enroll','orderId':order_id,'consent':True},cookie=owner);assert s==200,body
  conversation=json.loads(body)['conversation'];assert conversation['paused']==1
  assert req('/api/whatsapp?id='+conversation['id'],cookie=agent)[0]==404
  assert req('/api/whatsapp',{'action':'status','id':conversation['id'],'status':'cancelled'},cookie=agent)[0]==409
  assert req('/api/whatsapp',{'action':'assign','id':conversation['id'],'email':'agent@test.com'},cookie=owner)[0]==200
  assert req('/api/whatsapp?id='+conversation['id'],cookie=agent)[0]==200
  assert req('/api/whatsapp',{'action':'assign','id':conversation['id'],'email':None},cookie=agent)[0]==409
  assert 'aiMissing' not in json.loads(req('/api/whatsapp',cookie=agent)[2])['connection']
  s,_,body=req('/api/whatsapp',{'action':'send','id':conversation['id'],'kind':'template'},cookie=owner);assert s==409
  assert req('/api/whatsapp',{'action':'status','id':conversation['id'],'status':'confirmed'},cookie=owner)[0]==200
  rows=json.loads(req('/api/orders',cookie=owner)[2])['orders'];assert rows[0]['status']=='draft' and rows[0]['payload']['price']==199
  print('WhatsApp HTTP smoke passed: admin access, agent isolation, CSRF, unconfigured webhook, enrollment, sending disabled, no order dispatch.')
 finally:
  proc.terminate()
  try:proc.wait(timeout=10)
  except subprocess.TimeoutExpired:proc.kill();proc.wait()
  log.close()
