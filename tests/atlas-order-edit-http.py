"""Read-only mock carrier checks; all order writes stay in a temporary SQLite database."""
import os,subprocess,tempfile,time,urllib.request,urllib.error,json,secrets,sqlite3,uuid
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
with tempfile.TemporaryDirectory() as temp:
 password=secrets.token_urlsafe(24);dbfile=temp+'/app.sqlite';preload=temp+'/atlas.mjs'
 Path(preload).write_text('''const original=globalThis.fetch;const parcels=new Map();
globalThis.fetch=async(url,options={})=>{
 if(!String(url).startsWith('https://api.atlaslivraison.com/'))return original(url,options);
 if(String(url).endsWith('/cities'))return Response.json({success:true,data:[{id:'rabat',name:'Rabat'}]});
 const code=String(url).split('/').pop();
 if(code==='READFAIL'&&parcels.has(code)&&options.method!=='PATCH')return Response.json({success:false},{status:503});
 const base=parcels.get(code)??{code,stateId:code==='COLLECTED'?2:1,stateName:'Nouveau',fullname:code==='EXTERNAL'?'External name':'Old name',phone:'0612345678',address:'Original address',cityId:'kenitra',cityName:'Kenitra',price:199,product:'Press',quantity:1,note:'',cfees:'30.00'};
 if(options.method==='PATCH'){
  const b=JSON.parse(options.body);if('stockItems'in b||'createdEmail'in b||'change'in b)throw Error('Forbidden field');
  if(code==='REFUSE'||code==='REFUSEPRODUCT')return Response.json({success:false,message:'Collected atl_mocksecret'}, {status:400});
  if(code==='RACE')await new Promise(resolve=>setTimeout(resolve,400));
  parcels.set(code,{...base,...b,...(b.cityId?{cityName:'Rabat',cfees:'40.00'}:{})});
  return Response.json({success:true,data:{code,...b}});
 }
 return Response.json({success:true,data:base});
};''')
 env={**os.environ,'SQLITE_PATH':dbfile,'OWNER_EMAIL':'owner@test.com','ADMIN_PASSWORD':password,'ATLAS_API_KEY':'mock-api-key','PORT':'3190','HOSTNAME':'127.0.0.1','NODE_ENV':'production','APP_URL':'http://127.0.0.1:3190'}
 log=open('/tmp/atlas-order-edit-http.log','w');proc=subprocess.Popen(['node','--import',preload,'.next/standalone/server.js'],cwd=root,env=env,stdout=log,stderr=log);base='http://127.0.0.1:3190'
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
  payload={'fullname':'Old name','phone':'0612345678','phone2':'0698765432','address':'Original address','cityId':'kenitra','cityName':'Kenitra','product':'Press','quantity':1,'price':199,'note':'','openpackage':True,'atlasSku':'P','stockItems':[{'stockId':'p','quantity':1}]}
  codes=['GOOD','COLLECTED','EXTERNAL','REFUSE','RACE','AGENT','READFAIL','QUANTITY','PRODUCT','REFUSEPRODUCT']
  for code in codes:fixture.execute('INSERT INTO orders(id,payload,status,tracking,created_by,created_email,commission_rate,created_at,updated_at,stock_released,product_id,unit_cost_cents) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',(code,json.dumps(payload),'sent',code,'Agent','a@test.com' if code=='AGENT' else 'owner@test.com',10,'2026-10-18T12:00:00Z','2026-10-18T12:00:00Z',1,'product-1',5000))
  fixture.commit()
  def edit(code,changes,cookie=owner,revision='2026-10-18T12:00:00Z',origin=base):return req('/api/orders',{'action':'edit','id':code,'expectedUpdatedAt':revision,'changes':changes},cookie,origin)[0]
  assert edit('GOOD',{'fullname':'New name'},cookie='')==403
  assert edit('GOOD',{'fullname':'New name'},origin='https://evil.test')==403
  assert edit('GOOD',{'fullname':'New name'},cookie=agent)==404
  assert edit('GOOD',{'fullname':'New name'},revision='stale')==409
  for bad in [{'createdEmail':'evil@test.com'},{'change':True},{'stockItems':[]},{'phone':'bad'},{'address':'short'},{'price':0}]:assert edit('GOOD',bad)==400,bad
  assert edit('COLLECTED',{'fullname':'New name'})==409
  assert edit('EXTERNAL',{'fullname':'New name'})==409
  assert edit('REFUSE',{'fullname':'New name'})==502
  assert fixture.execute("SELECT payload FROM orders WHERE id='REFUSE'").fetchone()[0]==json.dumps(payload)
  assert edit('GOOD',{'fullname':'New name','phone2':'','cityId':'rabat','price':279,'note':'Edited','openpackage':False})==200
  row=next(r for r in req('/api/orders',cookie=owner)[2]['orders'] if r['id']=='GOOD')
  assert row['payload']['fullname']=='New name' and row['payload']['cityName']=='Rabat' and row['payload']['price']==279 and row['transportActualCents']==4000,row
  assert row['productId']=='product-1' and row['unitCostCents']==5000 and row['createdEmail']=='owner@test.com' and row['commissionRate']==10
  assert row['payload']['stockItems']==payload['stockItems']
  assert edit('QUANTITY',{'quantity':3})==200
  quantity_row=next(r for r in req('/api/orders',cookie=owner)[2]['orders'] if r['id']=='QUANTITY')
  assert quantity_row['payload']['quantity']==3 and quantity_row['unitCostCents']==5000
  assert edit('PRODUCT',{'product':'Other product','quantity':2})==200
  product_row=next(r for r in req('/api/orders',cookie=owner)[2]['orders'] if r['id']=='PRODUCT')
  assert product_row['payload']['product']=='Other product' and product_row['payload']['quantity']==2
  assert product_row['productId'] is None and product_row['unitCostCents'] is None and 'stockItems' not in product_row['payload']
  assert product_row['createdEmail']=='owner@test.com' and product_row['commissionRate']==10
  assert edit('REFUSEPRODUCT',{'product':'Refused product','quantity':2})==502
  assert fixture.execute("SELECT payload FROM orders WHERE id='REFUSEPRODUCT'").fetchone()[0]==json.dumps(payload)
  assert edit('READFAIL',{'cityId':'rabat','note':'Confirmed patch'})==200
  fallback=next(r for r in req('/api/orders',cookie=owner)[2]['orders'] if r['id']=='READFAIL')
  assert fallback['payload']['note']=='Confirmed patch' and fallback['payload']['cityName']=='Rabat' and fallback['transportActualCents'] is None
  assert edit('AGENT',{'note':'Own edit'},cookie=agent)==200
  from concurrent.futures import ThreadPoolExecutor
  with ThreadPoolExecutor(2) as pool:
   first=pool.submit(edit,'RACE',{'note':'First'});time.sleep(.1);assert req('/api/orders',{'action':'cancel_atlas','id':'RACE'},owner)[0]==409;req('/api/sync',{},owner);second=pool.submit(edit,'RACE',{'note':'Second'})
   assert sorted([first.result(),second.result()])==[200,409]
  assert fixture.execute('SELECT COUNT(*) FROM order_edit_locks').fetchone()[0]==0
  print('PASS: Atlas PATCH, partial acknowledgement, carrier refusal/state restrictions, local/external conflicts, validation, ownership, CSRF, stock and accounting preservation, concurrent edits')
 finally:
  proc.terminate();proc.wait(timeout=10);log.close()
