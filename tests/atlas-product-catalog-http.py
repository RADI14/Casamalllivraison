"""Read-only mock carrier checks; all order writes stay in a temporary SQLite database."""
import os,subprocess,tempfile,time,urllib.request,urllib.error,json,secrets,sqlite3,uuid
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
with tempfile.TemporaryDirectory() as temp:
 password=secrets.token_urlsafe(24);dbfile=temp+'/app.sqlite';preload=temp+'/atlas.mjs'
 Path(preload).write_text('''import {existsSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';
const original=globalThis.fetch;
globalThis.fetch=async(url,options={})=>{
 if(!String(url).startsWith('https://api.atlaslivraison.com/'))return original(url,options);
 if(options.method&&options.method!=='GET')throw Error('Carrier writes forbidden in sync test');
 if(String(url).endsWith('/history'))return Response.json({success:true,data:[{stateId:17,at:'2026-10-25T12:00:00Z'}]});
 const code=String(url).split('/').pop();
 if(code==='stocks'&&existsSync(process.env.SQLITE_PATH+'.offline'))return Response.json({success:false},{status:503});
 if(code==='stocks')return Response.json({success:true,data:[{stockId:'allowed',sku:'A',name:'Allowed',available:123},{stockId:'other',sku:'B',name:'Other',available:45},{stockId:'empty',name:'Empty',available:0},{stockId:'frozen',name:'Frozen',available:8,frozen:true}]});
 if(code==='cities'||code==='stores')return Response.json({success:true,data:[]});
 if(code==='FAIL')return Response.json({success:false},{status:503});
 if(code==='WRONG')return Response.json({success:true,data:{code:'other',stateId:17}});
 if(code==='PARTIAL')return Response.json({success:true,data:{code,stateId:1,stateName:'Nouveau'}});
 if(code==='RACE'){const db=new DatabaseSync(process.env.SQLITE_PATH);db.function('audit_actor',()=> 'test-fixture');db.prepare("UPDATE orders SET status='cancelled',updated_at='2026-10-18T18:00:00Z' WHERE tracking='RACE'").run();db.close()}
 return Response.json({success:true,data:{code,stateId:code==='CANCEL'?19:17,stateName:code==='CANCEL'?'Annulée':'Livré',fullname:'Edited in Atlas',phone:'0712345678',phone2:null,address:'New Atlas address',cityId:'rabat',cityName:'Rabat',price:'299.50',product:code==='PRODUCT'?'Changed product':'Press',quantity:3,note:'Atlas note',cfees:'40.00',openpackage:false,createdEmail:'forged@test.com',commissionRate:999}});
};''')
 env={**os.environ,'SQLITE_PATH':dbfile,'OWNER_EMAIL':'owner@test.com','ADMIN_PASSWORD':password,'ATLAS_AUTO_SYNC':'false','ATLAS_API_KEY':'mock-api-key','PORT':'3189','HOSTNAME':'127.0.0.1','NODE_ENV':'production','APP_URL':'http://127.0.0.1:3189'}
 log=open('/tmp/atlas-order-sync-http.log','w');proc=subprocess.Popen(['node','--import',preload,'.next/standalone/server.js'],cwd=root,env=env,stdout=log,stderr=log);base='http://127.0.0.1:3189'
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
  fixture=sqlite3.connect(dbfile);fixture.create_function('audit_actor',0,lambda:'test-fixture')
  assert req('/api/team-products?email=a@test.com',cookie=agent)[0]==403
  assert req('/api/team-products',{'email':'a@test.com','stockIds':['allowed']},agent)[0]==403
  assert req('/api/atlas?stocksOnly=1',cookie=agent)[2]['stocks']==[]
  assert req('/api/team-products',{'email':'a@test.com','stockIds':['allowed','empty','frozen']},owner)[0]==200
  assert req('/api/team-products',{'email':'a@test.com','stockIds':['wrong']},owner)[0]==400
  team=req('/api/team',cookie=owner)[2]['members']
  assert set(next(m for m in team if m['email']=='a@test.com')['authorizedStockIds'])=={'allowed','empty','frozen'}
  assert req('/api/team',cookie=agent)[0]==403
  for path in ['/api/atlas','/api/atlas?stocksOnly=1']:
   data=req(path,cookie=agent)[2];assert [p['stockId'] for p in data['stocks']]==['allowed'],data
   assert 'available' not in data['stocks'][0] and data['stocks'][0]['inStock'] is True
   assert len(req(path,cookie=owner)[2]['stocks'])==4
  payload={'fullname':'Test client','phone':'0612345678','phone2':'','address':'Test full address','cityId':'rabat','cityName':'Rabat','storeId':'shop','product':'Other','quantity':1,'price':199,'note':'','atlasStockId':'other'}
  assert req('/api/orders',{'action':'create','payload':payload,'requestId':str(uuid.uuid4())},agent)[0]==403
  payload['atlasStockId']='empty'
  assert req('/api/orders',{'action':'create','payload':payload,'requestId':str(uuid.uuid4())},agent)[0]==409
  assert req('/api/products',cookie=agent)[0]==200
  fixture.execute('UPDATE atlas_product_catalog SET updated_at=0');fixture.commit()
  Path(dbfile+'.offline').touch()
  cached=req('/api/team-products?email=a@test.com',cookie=owner)
  assert cached[0]==200 and cached[2]['stale'] is True and len(cached[2]['products'])==4,cached
  assert all('available' not in p for p in cached[2]['products'])
  assert req('/api/team-products',{'email':'a@test.com','stockIds':['allowed']},owner)[0]==200
  # Stale catalogue must never turn into available stock for creating an order.
  assert req('/api/atlas?stocksOnly=1',cookie=agent)[0]==502
  Path(dbfile+'.offline').unlink()
  assert req('/api/team-products',{'email':'a@test.com','stockIds':[]},owner)[0]==200
  assert req('/api/atlas?stocksOnly=1',cookie=agent)[2]['stocks']==[]
  print('PASS: cached catalogue survives Atlas outage, assignments save during outage, quantities stay live and private, invalid IDs rejected, revocation enforced')
 finally:
  proc.terminate();proc.wait(timeout=10);log.close()
