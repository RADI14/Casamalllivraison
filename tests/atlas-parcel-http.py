"""Read-only mock carrier checks; all order writes stay in a temporary SQLite database."""
import os,subprocess,tempfile,time,urllib.request,urllib.error,json,secrets,sqlite3,uuid
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
with tempfile.TemporaryDirectory() as temp:
 password=secrets.token_urlsafe(24);dbfile=temp+'/app.sqlite';preload=temp+'/atlas.mjs'
 Path(preload).write_text("import {appendFileSync} from 'node:fs';const original=globalThis.fetch;const parcels=new Map();\nglobalThis.fetch=async(url,options={})=>{\n if(!String(url).startsWith('https://api.atlaslivraison.com/'))return original(url,options);\n const u=new URL(String(url)),parts=u.pathname.split('/'),type=parts.at(-1),code=['messages','history','action'].includes(type)?parts.at(-2):type;\n appendFileSync(process.env.MOCK_LOG,JSON.stringify({code,type,method:options.method??'GET',body:options.body?JSON.parse(options.body):null})+'\\n');\n if(type==='cities')return Response.json({success:true,data:[{id:'rabat',name:'Rabat'}]});\n if(code==='ALLFAIL'||code==='MSGFAIL'&&type==='messages')return Response.json({success:false,message:'Temporary failure'},{status:503});\n if(code==='RATE')return Response.json({success:false},{status:429,headers:{'Retry-After':'60'}});\n const base=parcels.get(code)??{code:code==='WRONG'?'other':code,stateId:code==='NEW'?1:code==='DELIVERED'?17:12,stateName:'Pas de réponse',fullname:'Client',phone:'0612345678',address:'Original address',cityId:'kenitra',cityName:'Kenitra',price:120,product:'Press',quantity:1,note:'',cfees:'30.00'};\n if(type==='messages'){const page=Number(u.searchParams.get('page'));const newest=(code==='DESC'?page===1:page===2);return Response.json({success:true,data:[{id:'m-'+page,message:newest?'Latest message':'Older message',createdAt:newest?'2026-10-20T12:00:00Z':'2026-10-19T12:00:00Z',senderName:'Agence Casa',senderType:'agency',hasAttachment:true,attachmentUrl:'NEVER-EXPOSE',token:'NEVER-EXPOSE'}],pagination:{page,limit:50,total:51,totalPages:2}})}\n if(type==='history')return Response.json({success:true,data:[{stateId:1,stateName:'Nouveau',entity:'Shop',at:'2026-10-18T12:00:00Z',privateNote:'NEVER-EXPOSE'}]});\n if(type==='action'){\n  if(code==='REFUSE')return Response.json({success:false,message:'Action refused mock-api-key'},{status:400});\n  if(code==='UNKNOWN')throw Error('Network timeout');\n  if(code==='RACE')await new Promise(resolve=>setTimeout(resolve,400));\n  const b=JSON.parse(options.body),updated={...base,stateId:b.action==='reschedule'?16:24,stateName:b.action==='reschedule'?'Reporté / Programmé':'Intérêt confirmé',...(b.recipientPhone?{phone:b.recipientPhone}:{}),...(b.recipientCityId?{cityId:b.recipientCityId,cityName:'Rabat',cfees:'40.00'}:{})};parcels.set(code,updated);return Response.json({success:true,data:{code,stateId:updated.stateId,stateName:updated.stateName}});\n }\n return Response.json({success:true,data:base});\n};")
 env={**os.environ,'SQLITE_PATH':dbfile,'MOCK_LOG':temp+'/requests.jsonl','OWNER_EMAIL':'owner@test.com','ADMIN_PASSWORD':password,'ATLAS_API_KEY':'mock-api-key','PORT':'3192','HOSTNAME':'127.0.0.1','NODE_ENV':'production','APP_URL':'http://127.0.0.1:3192'}
 log=open('/tmp/atlas-parcel-http.log','w');proc=subprocess.Popen(['node','--import',preload,'.next/standalone/server.js'],cwd=root,env=env,stdout=log,stderr=log);base='http://127.0.0.1:3192'
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
  fixture=sqlite3.connect(dbfile)
  payload={'fullname':'Client','phone':'0612345678','address':'Original address','cityId':'kenitra','cityName':'Kenitra','product':'Press','quantity':1,'price':120,'note':''}
  for code in ['ASC','DESC','MSGFAIL','ALLFAIL','WRONG','NEW','DELIVERED','ACTION','RETURN','RECIPIENT','REFUSE','UNKNOWN','RACE','AGENT','REPORT','RATE']:
   fixture.execute('INSERT INTO orders(id,payload,status,tracking,created_by,created_email,commission_rate,created_at,updated_at,atlas_state,unit_cost_cents,transport_actual_cents) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',(code,json.dumps(payload),'sent',code,'Agent','a@test.com' if code=='AGENT' else 'owner@test.com',10,'2026-10-20T12:00:00Z','2026-10-20T12:00:00Z',12,5000,3000))
  fixture.commit()
  def feed(code,extra='',cookie=owner):return req('/api/atlas-parcel?id='+code+extra,cookie=cookie)
  def action(code,payload=None,requestid=None,cookie=owner,confirmed=False,state=12):return req('/api/atlas-parcel',{'id':code,'requestId':requestid or str(uuid.uuid4()),'payload':payload or {'action':'confirm_interest'},'expectedStateId':state,'confirmed':confirmed},cookie)
  def requests():return [json.loads(line) for line in Path(temp+'/requests.jsonl').read_text().splitlines()]
  assert feed('ASC',cookie='')[0]==403 and feed('ASC',cookie=agent)[0]==404
  assert feed('missing')[0]==404 and feed('ASC','&page=0')[0]==400
  assert feed('AGENT',cookie=agent)[0]==200
  asc=feed('ASC')[2];assert asc['messages']['page']==2 and asc['messages']['items'][0]['message']=='Latest message',asc
  assert asc['detail']['data']['price']==120 and len(asc['history']['items'])==1
  assert 'NEVER-EXPOSE' not in json.dumps(asc)
  revision=fixture.execute("SELECT updated_at FROM orders WHERE id='ASC'").fetchone()[0]
  n=len(requests());assert feed('ASC')[0]==200 and len(requests())==n
  assert fixture.execute("SELECT updated_at FROM orders WHERE id='ASC'").fetchone()[0]==revision # shared carrier cache
  assert feed('ASC','&page=1')[2]['messages']['olderPage'] is None
  desc=feed('DESC')[2];assert desc['messages']['page']==1 and desc['messages']['olderPage']==2
  partial=feed('MSGFAIL');assert partial[0]==200 and 'messages'in partial[2]['errors'] and 'detail'in partial[2]
  assert feed('ALLFAIL')[0]==502 and 'detail'in feed('WRONG')[2]['errors']
  assert action('ASC',cookie=agent)[0]==404
  assert action('NEW',state=1)[0]==409 and action('DELIVERED',state=17)[0]==409
  assert action('ACTION',payload={'action':'confirm_interest','stateId':17})[0]==400
  assert action('ACTION',payload={'action':'reschedule','scheduledDate':'2020-01-01'})[0]==400
  assert action('ACTION',state=99)[0]==409
  assert req('/api/atlas-parcel',{'id':'ACTION'},owner,origin='https://evil.test')[0]==403
  token=str(uuid.uuid4());assert action('ACTION',requestid=token)[0]==200
  assert action('ACTION',requestid=token)[0]==200
  assert action('ACTION',requestid=token,payload={'action':'cancel_return'})[0]==409
  assert sum(x['code']=='ACTION' and x['type']=='action' for x in requests())==1
  row=fixture.execute("SELECT created_email,commission_rate,unit_cost_cents,atlas_state FROM orders WHERE id='ACTION'").fetchone();assert row==('owner@test.com',10,5000,24),row
  assert action('REPORT',payload={'action':'reschedule','scheduledDate':'2099-01-01'})[0]==200
  assert action('RETURN',payload={'action':'return_request'})[0]==400
  assert action('RETURN',payload={'action':'return_request'},confirmed=True)[0]==200
  assert action('RECIPIENT',payload={'action':'change_recipient','recipientPhone':'+212 7 12 34 56 78','recipientCityId':'rabat'})[0]==200
  recipient=feed('RECIPIENT')[2];assert recipient['detail']['data']['stateId']==24
  p=json.loads(fixture.execute("SELECT payload FROM orders WHERE id='RECIPIENT'").fetchone()[0]);assert p['phone']=='0712345678' and p['cityName']=='Rabat',p
  refusal=action('REFUSE');assert refusal[0]==502 and 'mock-api-key' not in json.dumps(refusal[2])
  assert fixture.execute("SELECT atlas_state FROM orders WHERE id='REFUSE'").fetchone()[0]==12
  unknownid=str(uuid.uuid4());assert action('UNKNOWN',requestid=unknownid)[2]['outcome']=='unknown'
  assert action('UNKNOWN',requestid=unknownid)[0]==409
  assert sum(x['code']=='UNKNOWN' and x['type']=='action' for x in requests())==1
  from concurrent.futures import ThreadPoolExecutor
  with ThreadPoolExecutor(2) as pool:
   first=pool.submit(action,'RACE');time.sleep(.1)
   assert action('RACE')[0]==409
   assert feed('RACE')[0]==200
   assert first.result()[0]==200
  assert fixture.execute('SELECT COUNT(*) FROM order_edit_locks').fetchone()[0]==0
  assert feed('RATE')[0]==502
  n=len(requests());assert feed('RATE')[0]==502 and len(requests())==n
  print('PASS: scoped chat/history, pagination in both directions, cache and partial failures, status actions, return confirmation, preserved accounting, replay prevention, ambiguous writes, locking, CSRF and rate-limit cooldown')

 finally:
  proc.terminate();proc.wait(timeout=10);log.close()
