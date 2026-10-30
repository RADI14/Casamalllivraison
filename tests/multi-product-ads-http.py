"""Read-only mock carrier checks; all order writes stay in a temporary SQLite database."""
import os,subprocess,tempfile,time,urllib.request,urllib.error,json,secrets,sqlite3,uuid
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
with tempfile.TemporaryDirectory() as temp:
 password=secrets.token_urlsafe(24);dbfile=temp+'/app.sqlite';preload=temp+'/atlas.mjs'
 Path(preload).write_text("const original=globalThis.fetch;globalThis.fetch=(url,options)=>{if(String(url).startsWith('https://api.atlaslivraison.com/'))throw Error('No carrier calls in analysis test');if(String(url).startsWith('https://open.er-api.com/'))return Promise.resolve(Response.json({result:'success',base_code:'USD',rates:{MAD:9.5},time_last_update_unix:Math.floor(Date.now()/1000)}));return original(url,options)}")
 env={**os.environ,'SQLITE_PATH':dbfile,'OWNER_EMAIL':'owner@test.com','ADMIN_PASSWORD':password,'ATLAS_API_KEY':'mock-api-key','PORT':'3193','HOSTNAME':'127.0.0.1','NODE_ENV':'production','APP_URL':'http://127.0.0.1:3193'}
 log=open('/tmp/multi-product-ads-http.log','w');proc=subprocess.Popen(['node','--import',preload,'.next/standalone/server.js'],cwd=root,env=env,stdout=log,stderr=log);base='http://127.0.0.1:3193'
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
  assert req('/api/exchange-rate')[0]==403
  assert req('/api/expenses')[0]==403
  quote=req('/api/exchange-rate',cookie=owner);assert quote[0]==200 and quote[2]['rate']==9.5
  fixture=sqlite3.connect(dbfile)
  fixture.execute("INSERT INTO members(email,name,active,created_at) VALUES('a@test.com','A',1,'2026-10-24')")
  fixture.execute("INSERT INTO products(id,sku,name,stock,cost_cents,sale_cents,created_at) VALUES('p','P','P',10,100,1000,'2026-10-24')")
  fixture.execute("INSERT INTO ad_expenses(id,date,amount_cents,channel,created_at) VALUES('legacy','2026-10-24',1234,'Meta Ads','2026-10-24')")
  fixture.commit();fixture.close()
  body={'date':'2026-10-24','category':'ads','costType':'variable','productId':'p','memberEmail':'a@test.com','channel':'Meta Ads','amount':'10.01','currency':'USD','exchangeRate':'9.123456','note':'Test','amountCents':1}
  assert req('/api/expenses',body)[0]==403
  assert req('/api/expenses',body,owner,origin='http://untrusted.test')[0]==403
  assert req('/api/expenses',body,owner)[0]==201
  rows=req('/api/expenses',cookie=owner)[2]['expenses'];row=next(e for e in rows if e['id']!='legacy')
  assert row['amountCents']==9133 and row['originalAmountCents']==1001 and row['exchangeRateMicros']==9123456 and row['currency']=='USD'
  assert next(e for e in rows if e['id']=='legacy')['currency']=='MAD'
  finance=req('/api/finance',cookie=owner)[2];assert finance['total']['ads']==10367 and finance['total']['net']==-10367
  assert next(m for m in finance['members'] if m['email']=='a@test.com')['ads']==9133
  # Editing unrelated fields roundtrips saved USD amounts without double conversion.
  update={**body,'id':row['id'],'action':'update','note':'Updated'}
  assert req('/api/expenses',update,owner)[0]==200
  assert next(e for e in req('/api/expenses',cookie=owner)[2]['expenses'] if e['id']==row['id'])['amountCents']==9133
  for change in [{'currency':'EUR'},{'exchangeRate':''},{'exchangeRate':None},{'exchangeRate':0},{'exchangeRate':101},{'amount':-1},{'amount':'1.001'}]:
   assert req('/api/expenses',{**update,**change},owner)[0]==400
  assert req('/api/expenses',{k:v for k,v in update.items() if k!='exchangeRate'},owner)[0]==400
  assert req('/api/expenses',{**update,'currency':'MAD','amount':'99.99'},owner)[0]==200
  row=next(e for e in req('/api/expenses',cookie=owner)[2]['expenses'] if e['id']==row['id'])
  assert row['amountCents']==9999 and row['originalAmountCents']==9999 and row['exchangeRateMicros']==1000000
  assert req('/api/expenses',{'action':'delete','id':row['id']},owner)[0]==200
  assert req('/api/finance',cookie=owner)[2]['total']['ads']==1234
  fixture=sqlite3.connect(dbfile)
  for pid in ['q','r']:
   fixture.execute("INSERT INTO products(id,sku,name,stock,cost_cents,sale_cents,created_at) VALUES(?,?,?,10,100,1000,'2026-10-24')",(pid,pid,pid))
  fixture.commit();fixture.close()
  multi={**body,'productIds':['p','q','r'],'note':'Shared spend'}
  assert req('/api/expenses',multi)[0]==403
  assert req('/api/expenses',multi,owner,origin='http://untrusted.test')[0]==403
  result=req('/api/expenses',multi,owner);assert result[0]==201 and result[2]['entries']==3
  shared=[e for e in req('/api/expenses',cookie=owner)[2]['expenses'] if e['note']=='Shared spend']
  assert len(shared)==3 and sum(e['amountCents'] for e in shared)==9133 and sum(e['originalAmountCents'] for e in shared)==1001
  assert {e['productId'] for e in shared}=={'p','q','r'} and all(e['memberEmail']=='a@test.com' and e['date']=='2026-10-24' for e in shared)
  before=len(req('/api/expenses',cookie=owner)[2]['expenses'])
  for ids in [[],['p','p'],['p','missing'],['p',None]]:
   assert req('/api/expenses',{**multi,'productIds':ids},owner)[0]==400
   assert len(req('/api/expenses',cookie=owner)[2]['expenses'])==before
  assert req('/api/expenses',{**multi,'action':'update','id':shared[0]['id']},owner)[0]==400
  for e in shared:
   update_part={**body,'action':'update','id':e['id'],'productId':e['productId'],'amount':str(e['originalAmountCents']/100),'note':'Updated shared note'}
   assert req('/api/expenses',update_part,owner)[0]==200
   saved=next(x for x in req('/api/expenses',cookie=owner)[2]['expenses'] if x['id']==e['id'])
   assert saved['amountCents']==e['amountCents']
  assert req('/api/finance',cookie=owner)[2]['total']['ads']==1234+9133
  print('PASS: multi-product totals, invalid IDs without partial writes, per-product edits, authentication and currency; currency API access, stored conversion, legacy DH, totals, edit, invalid inputs and deletion')
 finally:
  proc.terminate();proc.wait(timeout=10);log.close()
