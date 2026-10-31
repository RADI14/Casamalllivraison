"""Read-only mock carrier checks; all order writes stay in a temporary SQLite database."""
import os,subprocess,tempfile,time,urllib.request,urllib.error,json,secrets,sqlite3,uuid
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
with tempfile.TemporaryDirectory() as temp:
 password=secrets.token_urlsafe(24);dbfile=temp+'/app.sqlite';preload=temp+'/atlas.mjs'
 Path(preload).write_text("const original=globalThis.fetch;globalThis.fetch=(url,options)=>{if(String(url).startsWith('https://api.atlaslivraison.com/'))throw Error('No carrier calls in analysis test');if(String(url).startsWith('https://open.er-api.com/'))return Promise.resolve(Response.json({result:'success',base_code:'USD',rates:{MAD:9.5},time_last_update_unix:Math.floor(Date.now()/1000)}));return original(url,options)}")
 env={**os.environ,'SQLITE_PATH':dbfile,'OWNER_EMAIL':'owner@test.com','ADMIN_PASSWORD':password,'ATLAS_API_KEY':'mock-api-key','PORT':'3192','HOSTNAME':'127.0.0.1','NODE_ENV':'production','APP_URL':'http://127.0.0.1:3192'}
 log=open('/tmp/expense-currency-http.log','w');proc=subprocess.Popen(['node','--import',preload,'.next/standalone/server.js'],cwd=root,env=env,stdout=log,stderr=log);base='http://127.0.0.1:3192'
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
  fixture=sqlite3.connect(dbfile);fixture.create_function('audit_actor',0,lambda:'test-fixture')
  fixture.execute("INSERT INTO members(email,name,active,created_at) VALUES('a@test.com','A',1,'2026-10-24')")
  fixture.execute("INSERT INTO products(id,sku,name,stock,cost_cents,sale_cents,created_at) VALUES('p','P','P',10,100,1000,'2026-10-24')")
  fixture.execute("INSERT INTO ad_expenses(id,date,amount_cents,channel,created_at) VALUES('legacy','2026-10-24',1234,'Meta Ads','2026-10-24')")
  fixture.commit();fixture.close()
  body={'date':'2026-10-24','category':'ads','costType':'variable','memberEmail':'a@test.com','channel':'Meta Ads','amount':'10.01','currency':'USD','exchangeRate':'9.123456','note':'Test','amountCents':1}
  assert req('/api/expenses',body)[0]==403
  assert req('/api/expenses',body,owner,origin='http://untrusted.test')[0]==403
  for missing in [None,'',' ']:
   assert req('/api/expenses',{**body,'memberEmail':missing},owner)[0]==400
  assert req('/api/expenses',body,owner)[0]==201
  rows=req('/api/expenses',cookie=owner)[2]['expenses'];row=next(e for e in rows if e['id']!='legacy')
  assert row['productId'] is None and row['costType']=='variable'
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
  # Product links from stale clients are ignored; one spend creates one charge.
  stale={**body,'productId':'missing-product','productIds':['p','q','r'],'costType':'fixed'}
  assert req('/api/expenses',stale,owner)[0]==201
  latest=[e for e in req('/api/expenses',cookie=owner)[2]['expenses'] if e['id']!='legacy']
  assert len(latest)==1 and latest[0]['productId'] is None and latest[0]['costType']=='variable'
  finance=req('/api/finance',cookie=owner)[2]
  assert finance['total']['ads']==10367 and finance['products'][0]['ads']==0
  assert next(m for m in finance['members'] if m['email']=='a@test.com')['ads']==9133
  print('PASS: currency API access, stored conversion, legacy DH, totals, edit, invalid inputs and deletion')
 finally:
  proc.terminate();proc.wait(timeout=10);log.close()
