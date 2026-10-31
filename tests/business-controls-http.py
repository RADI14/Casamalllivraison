"""Read-only mock carrier checks; all order writes stay in a temporary SQLite database."""
import os,subprocess,tempfile,time,urllib.request,urllib.error,json,secrets,sqlite3,uuid,io
from datetime import datetime,timezone,timedelta
from openpyxl import load_workbook
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
with tempfile.TemporaryDirectory() as temp:
 password=secrets.token_urlsafe(24);dbfile=temp+'/app.sqlite';preload=temp+'/atlas.mjs'
 Path(preload).write_text("const original=globalThis.fetch;globalThis.fetch=(url,options={})=>{if(String(url).endsWith('/stocks'))return Promise.resolve(Response.json({success:true,data:[{stockId:'stock-test',sku:'TEST',name:'Stock product',available:100,frozen:false}]}));if(String(url).startsWith('https://api.atlaslivraison.com/')&&options.method==='POST'&&String(url).endsWith('/colis'))return Promise.resolve(Response.json({success:true,data:{code:'TEST-'+options.headers['Idempotency-Key'],cfees:35}}));if(String(url).startsWith('https://api.atlaslivraison.com/'))throw Error('Unexpected carrier call');return original(url,options)}")

 env={**os.environ,'SQLITE_PATH':dbfile,'OWNER_EMAIL':'owner@test.com','ADMIN_PASSWORD':password,'ATLAS_API_KEY':'mock-api-key','PORT':'3192','HOSTNAME':'127.0.0.1','NODE_ENV':'production','APP_URL':'http://127.0.0.1:3192'}
 log=open('/tmp/operations-http.log','w');proc=subprocess.Popen(['node','--import',preload,'.next/standalone/server.js'],cwd=root,env=env,stdout=log,stderr=log);base='http://127.0.0.1:3192'
 def req(path,body=None,cookie='',origin=base,raw=False):
  headers={'Content-Type':'application/json','Origin':origin}
  if cookie:headers['Cookie']=cookie
  request=urllib.request.Request(base+path,headers=headers,data=json.dumps(body).encode() if body is not None else None)
  try:r=urllib.request.urlopen(request);return r.status,r.headers,(r.read() if raw else json.loads(r.read()))
  except urllib.error.HTTPError as e:return e.code,e.headers,(e.read() if raw else json.loads(e.read()))
 try:
  for _ in range(100):
   try:
    if req('/api/health')[0]==200:break
   except Exception:pass
   if proc.poll() is not None:raise RuntimeError('server exited')
   time.sleep(.2)
  else:raise RuntimeError('health timed out')
  for path in ['/api/business-controls','/api/business-controls/export?month=2026-10']:
   assert req(path)[0]==403
  status,h,_=req('/api/auth/login',{'email':'owner@test.com','password':password});assert status==200;owner=h['Set-Cookie'].split(';')[0]
  agentpass=secrets.token_urlsafe(24)
  assert req('/api/team',{'action':'create','name':'Agent','email':'a@test.com','password':agentpass},owner)[0]==200
  status,h,_=req('/api/auth/login',{'email':'a@test.com','password':agentpass});assert status==200;agent=h['Set-Cookie'].split(';')[0]
  for path in ['/api/business-controls','/api/business-controls/export?month=2026-10']:
   assert req(path,cookie=agent)[0]==403
  assert req('/api/business-controls?month=2026-13',cookie=owner)[0]==400
  status,h,data=req('/api/business-controls?month=2026-10',cookie=owner);assert status==200 and 'no-store' in h['Cache-Control'] and data['stock']['error'] is None
  assert data['settings']['age_days']==7 and data['stock']['low']==[]
  settings={'age_days':10,'sync_days':4,'stock_threshold':100}
  assert req('/api/business-controls',settings,owner,origin='https://untrusted.test')[0]==403
  assert req('/api/business-controls',{**settings,'age_days':0},owner)[0]==400
  assert req('/api/business-controls',settings,owner)[0]==200
  data=req('/api/business-controls?month=2026-10',cookie=owner)[2]
  assert data['settings']['age_days']==10 and data['stock']['low'][0]['available']==100
  history=req('/api/business-controls?view=audit',cookie=owner)[2]['events']
  assert history[0]['actor']=='owner@test.com' and history[0]['entity']=='settings'
  assert any(e['entity']=='members' and e['actor']=='owner@test.com' for e in history)
  assert req('/api/business-controls?view=audit&entity=app_credentials',cookie=owner)[0]==400
  assert req('/api/business-controls?view=audit&before=-1',cookie=owner)[0]==400
  status,h,excel=req('/api/business-controls/export?month=2026-10',cookie=owner,raw=True)
  assert status==200 and excel[:2]==b'PK' and 'attachment' in h['Content-Disposition']
  book=load_workbook(io.BytesIO(excel),data_only=False)
  assert book.sheetnames==['Synthese','Produits','Equipe','Depenses','Paiements','Commandes']
  assert book['Synthese']['B2'].value=='2026-10'
  localbook=load_workbook('/tmp/business-report-test.xlsx')
  assert localbook['Produits']['A2'].value=='P' and localbook['Commandes']['F2'].value==100
  assert localbook['Synthese']['B7'].data_type=='n'
  print('PASS: admin/agent access, CSRF, thresholds, live mocked Atlas low stock, attributed audit, monthly Excel and workbook parsing')
 finally:
  proc.terminate();proc.wait(timeout=10);log.close()
