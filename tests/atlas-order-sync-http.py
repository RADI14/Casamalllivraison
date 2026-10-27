"""Read-only mock carrier checks; all order writes stay in a temporary SQLite database."""
import os,subprocess,tempfile,time,urllib.request,urllib.error,json,secrets,sqlite3,uuid
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
with tempfile.TemporaryDirectory() as temp:
 password=secrets.token_urlsafe(24);dbfile=temp+'/app.sqlite';preload=temp+'/atlas.mjs'
 Path(preload).write_text('''import {DatabaseSync} from 'node:sqlite';
const original=globalThis.fetch;
globalThis.fetch=async(url,options={})=>{
 if(!String(url).startsWith('https://api.atlaslivraison.com/'))return original(url,options);
 if(options.method&&options.method!=='GET')throw Error('Carrier writes forbidden in sync test');
 if(String(url).endsWith('/history'))return Response.json({success:true,data:[{stateId:17,at:'2026-10-25T12:00:00Z'}]});
 const code=String(url).split('/').pop();
 if(code==='FAIL')return Response.json({success:false},{status:503});
 if(code==='WRONG')return Response.json({success:true,data:{code:'other',stateId:17}});
 if(code==='PARTIAL')return Response.json({success:true,data:{code,stateId:1,stateName:'Nouveau'}});
 if(code==='RACE'){const db=new DatabaseSync(process.env.SQLITE_PATH);db.prepare("UPDATE orders SET status='cancelled',updated_at='2026-10-18T18:00:00Z' WHERE tracking='RACE'").run();db.close()}
 return Response.json({success:true,data:{code,stateId:code==='CANCEL'?19:17,stateName:code==='CANCEL'?'Annulée':'Livré',fullname:'Edited in Atlas',phone:'0712345678',phone2:null,address:'New Atlas address',cityId:'rabat',cityName:'Rabat',price:'299.50',product:code==='PRODUCT'?'Changed product':'Press',quantity:3,note:'Atlas note',cfees:'40.00',openpackage:false,createdEmail:'forged@test.com',commissionRate:999}});
};''')
 env={**os.environ,'SQLITE_PATH':dbfile,'OWNER_EMAIL':'owner@test.com','ADMIN_PASSWORD':password,'ATLAS_API_KEY':'mock-api-key','PORT':'3189','HOSTNAME':'127.0.0.1','NODE_ENV':'production','APP_URL':'http://127.0.0.1:3189'}
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
  fixture=sqlite3.connect(dbfile)
  payload={'fullname':'Old name','phone':'0612345678','phone2':'0698765432','address':'Original address','cityId':'kenitra','cityName':'Kenitra','product':'Press','quantity':1,'price':199,'note':'','openpackage':True,'atlasSku':'P','stockItems':[{'stockId':'p','quantity':1}]}
  codes=['CANCEL','PRODUCT','FAIL','WRONG','PARTIAL','RACE']+['GOOD-'+str(i) for i in range(19)]
  for i,code in enumerate(codes):fixture.execute('INSERT INTO orders(id,payload,status,tracking,created_by,created_email,commission_rate,created_at,updated_at,stock_released,product_id,unit_cost_cents) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',('order-'+str(i).zfill(3),json.dumps(payload),'cancelled' if i==7 else 'sent',code,'Agent','a@test.com' if i==24 else 'owner@test.com',10,'2026-10-18T12:00:00Z','2026-10-18T12:00:00Z',1,'product-1',5000))
  fixture.commit()
  assert req('/api/sync',{},origin=base)[0]==403
  assert req('/api/sync',{},owner,origin='https://evil.test')[0]==403
  assert req('/api/sync',{'cursor':{}},owner)[0]==400
  first=req('/api/sync',{},owner)[2];assert first['nextCursor']=='order-019',first
  second=req('/api/sync',{'cursor':first['nextCursor']},owner)[2];assert second['nextCursor'] is None,second
  assert first['updated']+second['updated']==22 and first['failed']+second['failed']==3,(first,second)
  rows={r['tracking']:r for r in req('/api/orders',cookie=owner)[2]['orders']}
  row=rows['GOOD-1'];assert row['payload']['fullname']=='Edited in Atlas' and row['payload']['cityName']=='Rabat' and row['payload']['price']==299.5 and row['payload']['quantity']==3
  assert row['createdEmail']=='owner@test.com' and row['commissionRate']==10 and row['unitCostCents']==5000 and row['transportActualCents']==4000
  assert row['payload']['atlasDeliveredAt']=='2026-10-25T12:00:00.000Z'
  assert rows['CANCEL']['status']=='cancelled'
  assert rows['GOOD-1']['status']=='sent' # restored in Atlas after a prior local cancellation
  assert rows['PRODUCT']['payload']['product']=='Changed product' and rows['PRODUCT']['productId'] is None and rows['PRODUCT']['unitCostCents'] is None and 'atlasSku' not in rows['PRODUCT']['payload']
  for code in ['FAIL','WRONG','PARTIAL','RACE']:assert rows[code]['payload']['fullname']=='Old name'
  assert rows['RACE']['status']=='cancelled' and rows['RACE']['syncedAt'] is None
  fixture.execute('UPDATE orders SET synced_at=NULL');fixture.commit()
  scoped=req('/api/sync',{},agent)[2];assert scoped['updated']==1 and scoped['nextCursor'] is None
  assert fixture.execute('SELECT COUNT(*) FROM orders WHERE synced_at IS NOT NULL').fetchone()[0]==1
  print('PASS: full Atlas edits, cancellation/restoration, pagination beyond 20, cost mapping, partial/failing responses, concurrent changes, agent scope and CSRF')
 finally:
  proc.terminate();proc.wait(timeout=10);log.close()
