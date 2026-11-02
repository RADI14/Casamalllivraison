"""Read-only mock carrier checks; all order writes stay in a temporary SQLite database."""
import os,subprocess,tempfile,time,urllib.request,urllib.error,json,secrets,sqlite3,uuid
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
with tempfile.TemporaryDirectory() as temp:
 password=secrets.token_urlsafe(24);dbfile=temp+'/app.sqlite';preload=temp+'/atlas.mjs'
 Path(preload).write_text('''import {writeFileSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';
const original=globalThis.fetch;
globalThis.fetch=async(url,options={})=>{
 if(!String(url).startsWith('https://api.atlaslivraison.com/'))return original(url,options);
 if(options.method==='POST'){writeFileSync(process.env.SQLITE_PATH+'.sent',options.body);return Response.json({success:true,data:{code:'TEST-PARCEL',cfees:35}})}if(options.method&&options.method!=='GET')throw Error('Unexpected method');
 if(String(url).endsWith('/history'))return Response.json({success:true,data:[{stateId:17,at:'2026-10-25T12:00:00Z'}]});
 const code=String(url).split('/').pop();
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
  fixture.execute("INSERT INTO products(id,name,sku,cost_cents,sale_cents,transport_cents,stock,active,created_at) VALUES('pA','Allowed','A',1100,10000,0,100,1,'2026-11-02')")
  fixture.execute("INSERT INTO products(id,name,sku,cost_cents,sale_cents,transport_cents,stock,active,created_at) VALUES('pB','Other','B',2700,10000,0,100,1,'2026-11-02')");fixture.commit()
  payload={'fullname':'Test client','phone':'0612345678','phone2':'','address':'Test full address','cityId':'rabat','cityName':'Rabat','storeId':'shop','product':'Allowed + Other','quantity':3,'price':300,'note':'','atlasStockId':'allowed','items':[{'stockId':'allowed','quantity':2},{'stockId':'other','quantity':1}]}
  assert req('/api/team-products',{'email':'a@test.com','stockIds':['allowed']},owner)[0]==200
  requestId=str(uuid.uuid4());body={'action':'create','payload':payload,'requestId':requestId}
  assert req('/api/orders',body,agent)[0]==403
  assert req('/api/team-products',{'email':'a@test.com','stockIds':['allowed','other']},owner)[0]==200
  response=req('/api/orders',body,agent);assert response[0]==201,response
  row=fixture.execute('SELECT payload,purchase_total_cents,product_id FROM orders WHERE id=?',(requestId,)).fetchone()
  saved=json.loads(row[0]);assert saved['stockItems']==payload['items'] and saved['quantity']==3 and row[1]==4900 and row[2] is None,row
  sent=json.loads(Path(dbfile+'.sent').read_text());assert sent['stockItems']==payload['items'] and sent['price']==300,sent
  assert 'purchaseTotalCents' not in req('/api/orders',cookie=agent)[2]['orders'][0]
  assert req('/api/orders',body,agent)[0]==200
  payload['items'][1]['quantity']=2;payload['quantity']=4
  assert req('/api/orders',body,agent)[0]==409
  print('PASS: multi-product Atlas payload, per-line permissions and costs, private costs, idempotent send and changed-line rejection')
 finally:
  proc.terminate();proc.wait(timeout=10);log.close()
