"""Mock Atlas and temporary SQLite only: product settings, snapshots, tamper protection and settlement."""
import os,subprocess,tempfile,time,urllib.request,urllib.error,json,secrets,sqlite3,uuid
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
with tempfile.TemporaryDirectory() as temp:
 password=secrets.token_urlsafe(24);dbfile=temp+'/app.sqlite';preload=temp+'/atlas.mjs'
 Path(preload).write_text('''import {DatabaseSync} from 'node:sqlite';let n=0;const original=globalThis.fetch;globalThis.fetch=async(url,options={})=>{
 if(!String(url).startsWith('https://api.atlaslivraison.com/'))return original(url,options);
 if(options.method==='POST')return Response.json({success:true,data:{code:'TEST-'+(++n),cfees:30}});
 if(options.method&&options.method!=='GET')throw Error('Unexpected carrier method');
 if(String(url).endsWith('/stocks'))return Response.json({success:true,data:[{stockId:'a',sku:'A',name:'A',available:100},{stockId:'b',sku:'B',name:'B',available:100}]});
 if(String(url).endsWith('/history'))return Response.json({success:true,data:[{stateId:17,at:'2026-11-03T12:00:00Z'}]});
 if(String(url).includes('/colis/')){const db=new DatabaseSync(process.env.SQLITE_PATH);const code=String(url).split('/').pop();const row=db.prepare('SELECT payload FROM orders WHERE tracking=?').get(code);db.close();const p=JSON.parse(row.payload);return Response.json({success:true,data:{...p,quantity:code==='TEST-2'?4:p.quantity,code,stateId:17,stateName:'Livré',cfees:30,commissionMultiplier:9,commissionRate:999}});}
 return Response.json({success:true,data:[]});};''')
 base='http://127.0.0.1:3195';env={**os.environ,'SQLITE_PATH':dbfile,'OWNER_EMAIL':'owner@test.com','ADMIN_PASSWORD':password,'ATLAS_AUTO_SYNC':'false','ATLAS_API_KEY':'mock-key','PORT':'3195','HOSTNAME':'127.0.0.1','NODE_ENV':'production','APP_URL':base}
 def req(path,body=None,cookie='',origin=base):
  request=urllib.request.Request(base+path,headers={'Content-Type':'application/json','Origin':origin,'Cookie':cookie},data=None if body is None else json.dumps(body).encode())
  try:
   with urllib.request.urlopen(request) as r:return r.status,r.headers,json.loads(r.read())
  except urllib.error.HTTPError as e:return e.code,e.headers,json.loads(e.read())
 with open('/tmp/upsell-commissions-http.log','w') as log:
  proc=subprocess.Popen(['node','--import',preload,'.next/standalone/server.js'],cwd=root,env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:
     if req('/api/health')[0]==200:break
    except Exception:pass
    time.sleep(.1)
   _,h,_=req('/api/auth/login',{'email':'owner@test.com','password':password});owner=h['Set-Cookie'].split(';')[0]
   ap=secrets.token_urlsafe(24);assert req('/api/team',{'action':'create','name':'Agent','email':'agent@test.com','password':ap},owner)[0]==200
   _,h,_=req('/api/auth/login',{'email':'agent@test.com','password':ap});agent=h['Set-Cookie'].split(';')[0]
   assert req('/api/team-products',{'email':'agent@test.com','stockIds':['a','b']},owner)[0]==200
   assert req('/api/product-commissions',cookie=agent)[0]==403
   assert req('/api/product-commissions',{'sku':'A','upsell':True},agent)[0]==403
   assert req('/api/product-commissions',{'sku':'A','upsell':'true'},owner)[0]==400
   assert req('/api/product-commissions',{'sku':'A','upsell':True},owner,origin='https://other.example')[0]==403
   db=sqlite3.connect(dbfile);db.create_function('audit_actor',0,lambda:'test-fixture')
   def create(items,number):
    total=sum(i['quantity'] for i in items);id=str(uuid.uuid4());payload={'fullname':'Test','phone':'06123456'+str(number).zfill(2),'phone2':'','address':'Test full address','cityId':'rabat','cityName':'Rabat','storeId':'','product':'A','quantity':total,'price':300,'note':'','items':items,'commissionMultiplier':9,'commissionUpsellStockIds':['a','b']}
    s,_,j=req('/api/orders',{'action':'create','requestId':id,'payload':payload,'commissionMultiplier':9},agent);assert s==201,(s,j)
    return id
   old=create([{'stockId':'a','quantity':3}],1)
   assert req('/api/product-commissions',{'sku':'A','upsell':True},owner)[0]==200
   assert req('/api/product-commissions',cookie=owner)[2]['settings']==[{'sku':'A','upsell':True}]
   # A stock-only product needs no invented purchase price to enable commission.
   assert db.execute('SELECT COUNT(*) FROM products').fetchone()[0]==0
   on=create([{'stockId':'a','quantity':3}],2)
   mixed=create([{'stockId':'a','quantity':2},{'stockId':'b','quantity':2}],3)
   assert req('/api/product-commissions',{'sku':'A','upsell':False},owner)[0]==200
   off=create([{'stockId':'a','quantity':3}],4)
   assert [db.execute('SELECT commission_multiplier FROM orders WHERE id=?',(id,)).fetchone()[0] for id in [old,on,mixed,off]]==[1,3,2,1]
   # Commission is earned only once Atlas confirms delivery.
   assert all(r['commission']==0 for r in req('/api/orders',cookie=agent)[2]['orders'])
   db.execute('UPDATE orders SET atlas_state=17');db.commit()
   results={r['id']:r for r in req('/api/orders',cookie=agent)[2]['orders']}
   assert [results[id]['commission'] for id in [old,on,mixed,off]]==[10,30,20,10]
   assert req('/api/commissions',cookie=agent)[2]['totals']['dueCents']==7000
   body={'id':str(uuid.uuid4()),'email':'agent@test.com','amountCents':3000,'note':'Mock external payment','orderIds':[on]}
   assert req('/api/commissions',body,owner)[0]==201
   assert req('/api/commissions',body,owner)[0]==201
   results={r['id']:r for r in req('/api/orders',cookie=agent)[2]['orders']}
   assert results[on]['commissionPaymentStatus']=='paid' and results[on]['commissionDueCents']==0
   assert req('/api/commissions',cookie=agent)[2]['totals']['dueCents']==4000
   assert db.execute('SELECT COUNT(*) FROM commission_payments').fetchone()[0]==1
   assert req('/api/sync',{},agent)[0]==200
   results={r['id']:r for r in req('/api/orders',cookie=agent)[2]['orders']}
   assert results[on]['commission']==40 and results[on]['commissionDueCents']==1000
   assert db.execute('SELECT commission_multiplier FROM orders WHERE id=?',(on,)).fetchone()[0]==4
   assert req('/api/commissions',cookie=agent)[2]['totals']['dueCents']==5000
   print('PASS: Atlas confirmed quantity updates commission while preserving payment history; admin-only per-SKU switch; no fake costs; future-order snapshot; client tamper ignored; mixed quantities; delivered-only earning; idempotent exact upsell payment')
  finally:proc.terminate();proc.wait(timeout=10)
