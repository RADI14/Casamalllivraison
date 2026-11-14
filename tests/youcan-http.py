"""Temporary database and mocked YouCan/Atlas only; never sends real parcels."""
import os,subprocess,tempfile,time,urllib.request,urllib.error,json,secrets,hmac,hashlib,urllib.parse,sqlite3,uuid
from pathlib import Path
root=Path(__file__).resolve().parent.parent
with tempfile.TemporaryDirectory() as tmp:
 password=secrets.token_urlsafe(24);key='test-youcan-secret';store='test-store';base='http://127.0.0.1:3196';dbfile=tmp+'/db.sqlite'
 preload=Path(tmp)/'mock.mjs';preload.write_text('''const original=globalThis.fetch;globalThis.fetch=async(url,opt={})=>{if(String(url).startsWith('https://api.atlaslivraison.com/')){if(String(url).endsWith('/stocks'))return Response.json({success:true,data:[{stockId:'s',sku:'S',name:'P',available:10}]});if(String(url).endsWith('/colis')&&opt.method==='POST'){if(JSON.parse(opt.body).address!=='Rue de test 12, Appartement 4')return Response.json({success:false,message:'Wrong delivery address'},{status:400});return Response.json({success:true,data:{code:'TEST-CODE',cfees:30}});}return Response.json({success:true,data:[]})}if(!String(url).startsWith('https://api.youcan.shop/'))return original(url,opt);if(String(url).endsWith('/oauth/token')){const params=new URLSearchParams(opt.body);if(!params.get('redirect_uri')||opt.headers.Accept!=='application/json')return Response.json({error:'invalid_request'},{status:400});return Response.json({data:{access_token:'fake-token',expires_in:86400}});}if(String(url).endsWith('/resthooks/subscribe')){const b=JSON.parse(opt.body);if(!['order.created','order.updated','app.uninstalled'].includes(b.event)||b.target_url!=='https://fastlivraison.com/api/youcan/webhook')return Response.json({error:'invalid_request'},{status:400});return Response.json({id:'hook-'+b.event});}if(String(url).includes('/products/product-one?'))return Response.json({id:'product-one',variants:[{id:'variant-one',sku:'S'}]});if(String(url).endsWith('/me'))return Response.json({id:'test-store'});return Response.json({id:'remote',store_id:'test-store',ref:'YC1',total:99,currency:'MAD',customer:{first_name:'Test',phone:'0612345678',region:'Rue de test 12, Appartement 4',city:'City'},shipping:{address:[]},variants:[{quantity:1,variant:{id:'variant-one',sku:'OLD-SKU',product:{id:'product-one',name:'P'}}}]});};''')
 env={**os.environ,'SQLITE_PATH':dbfile,'OWNER_EMAIL':'owner@test.com','ADMIN_PASSWORD':password,'ATLAS_AUTO_SYNC':'false','ATLAS_API_KEY':'test-atlas','PORT':'3196','HOSTNAME':'127.0.0.1','NODE_ENV':'production','APP_URL':base,'YOUCAN_CLIENT_SECRET':key,'YOUCAN_CLIENT_ID':'test-client','YOUCAN_STORE_ID':store}
 log=open('/tmp/youcan-http.log','w');p=subprocess.Popen(['node','--import',str(preload),'.next/standalone/server.js'],cwd=root,env=env,stdout=log,stderr=log)
 def req(path,body=None,cookie='',headers=None):
  h={'Origin':base,'Content-Type':'application/json','Cookie':cookie,**(headers or {})};raw=body.encode() if isinstance(body,str) else json.dumps(body).encode() if body is not None else None
  try:r=urllib.request.urlopen(urllib.request.Request(base+path,data=raw,headers=h),timeout=20)
  except urllib.error.HTTPError as e:r=e
  data=r.read().decode();return r.status,r.headers,json.loads(data) if r.headers.get('Content-Type','').startswith('application/json') else data
 try:
  for _ in range(100):
   try:
    if req('/api/health')[0]==200:break
   except Exception:pass
   if p.poll() is not None:raise RuntimeError('server exited')
   time.sleep(.2)
  _,h,_=req('/api/auth/login',{'email':'owner@test.com','password':password});owner=h['Set-Cookie'].split(';')[0]
  assert req('/api/youcan')[0]==401
  params=urllib.parse.urlencode({'timestamp':int(time.time()),'code':'test-code','store':'test-store'})
  sig=hmac.new(key.encode(),params.encode(),hashlib.sha256).hexdigest();url='/api/youcan/callback?'+params+'&hmac='+sig
  assert req(url)[0]==200;assert req(url)[0]==409
  launch=urllib.parse.urlencode({'timestamp':int(time.time()),'store':'test-store'});launchsig=hmac.new(key.encode(),launch.encode(),hashlib.sha256).hexdigest()
  assert req('/api/youcan/callback?'+launch+'&hmac='+launchsig)[0]==200
  assert req('/api/youcan/callback?'+launch)[0]==403
  payload=json.dumps({'event_name':'order.created','event_happened_at':'2026-11-12T12:00:00Z','data':{'id':'remote','store_id':store}})
  assert req('/api/youcan/webhook',payload)[0]==401
  sig=hmac.new(key.encode(),payload.encode(),hashlib.sha256).hexdigest()
  for _ in range(2):assert req('/api/youcan/webhook',payload,headers={'x-youcan-signature':sig})[0]==200
  data=req('/api/youcan',cookie=owner)[2];assert data['connected'] and len(data['orders'])==1
  row=data['orders'][0];assert row['hydrated']==1 and row['payload']['fullname']=='Test'
  assert row['payload']['address']=='Rue de test 12, Appartement 4' and row['payload']['cityName']=='City'
  assert row['payload']['lines'][0]['sku']=='S'
  with sqlite3.connect(dbfile) as db:
   snapshot=json.loads(db.execute('SELECT payload FROM youcan_orders WHERE id=?',(row['id'],)).fetchone()[0]);snapshot['lines'][0]['sku']='LEGACY-SKU'
   db.execute('UPDATE youcan_orders SET payload=? WHERE id=?',(json.dumps(snapshot),row['id']))
  assert req('/api/youcan',{'action':'details','id':row['id']},owner)[2]['order']['payload']['lines'][0]['sku']=='S'
  with sqlite3.connect(dbfile) as db:
   legacy=json.loads(db.execute('SELECT payload FROM youcan_orders WHERE id=?',(row['id'],)).fetchone()[0]);legacy['address']=''
   db.execute('UPDATE youcan_orders SET payload=? WHERE id=?',(json.dumps(legacy),row['id']))
  assert req('/api/youcan',{'action':'refresh','id':row['id']},owner)[0]==200
  row=req('/api/youcan',cookie=owner)[2]['orders'][0]
  assert row['payload']['address']=='Rue de test 12, Appartement 4'
  agentpass=secrets.token_urlsafe(24);assert req('/api/team',{'action':'create','email':'a@test.com','name':'A','password':agentpass},owner)[0]==200
  _,h,_=req('/api/auth/login',{'email':'a@test.com','password':agentpass});agent=h['Set-Cookie'].split(';')[0]
  assert req('/api/youcan',cookie=agent)[2]['orders']==[]
  assert req('/api/youcan',{'action':'details','id':row['id']},agent)[0]==404
  assert req('/api/youcan',{'action':'subscribe'},agent)[0]==403
  assert req('/api/youcan',{'action':'assign','id':row['id'],'email':'a@test.com'},owner)[0]==200
  assert len(req('/api/youcan',cookie=agent)[2]['orders'])==1
  with sqlite3.connect(dbfile) as db:
   assert db.execute('SELECT COUNT(*) FROM orders').fetchone()[0]==0
   assert 'fake-token' not in db.execute('SELECT token_cipher FROM youcan_connections').fetchone()[0]
  assert req('/api/team-products',{'email':'a@test.com','stockIds':['s']},owner)[0]==200
  body={'action':'create','websiteOrderId':row['id'],'requestId':str(uuid.uuid4()),'payload':{'fullname':'Test','phone':'0612345678','phone2':'','address':row['payload']['address'],'cityId':'c','cityName':'City','storeId':'','product':'P','quantity':1,'price':99,'note':'','atlasStockId':'s'}}
  assert req('/api/orders',body,agent)[0]==409
  for status in ['new','no_reply_1','no_reply_2','no_reply_3','no_reply_4','cancelled']:
   assert req('/api/youcan',{'action':'status','id':row['id'],'status':status},agent)[0]==200
   assert req('/api/youcan',{'action':'send','id':row['id']},agent)[0]==409
  assert req('/api/youcan',{'action':'status','id':row['id'],'status':'invalid'},agent)[0]==400
  assert req('/api/youcan',{'action':'prepare','id':row['id'],'sourceUpdatedAt':'stale','payload':body['payload']},agent)[0]==409
  assert req('/api/youcan',{'action':'prepare','id':row['id'],'sourceUpdatedAt':row['source_updated_at'],'payload':body['payload']},agent)[0]==200
  assert req('/api/youcan',{'action':'refresh','id':row['id']},owner)[0]==409
  assert req('/api/youcan',{'action':'status','id':row['id'],'status':'confirmed'},agent)[0]==200
  with sqlite3.connect(dbfile) as db:assert db.execute('SELECT COUNT(*) FROM orders').fetchone()[0]==0
  assert req('/api/youcan',{'action':'send','id':row['id']},agent)[0]==201
  assert req('/api/youcan',{'action':'send','id':row['id']},agent)[0]==200
  assert req('/api/youcan',{'action':'status','id':row['id'],'status':'cancelled'},agent)[0]==409
  with sqlite3.connect(dbfile) as db:
   assert db.execute('SELECT COUNT(*) FROM orders').fetchone()[0]==1
   assert db.execute('SELECT local_order_id FROM youcan_orders').fetchone()[0]==row['id']
  assert req('/api/orders',cookie=agent)[2]['orders'][0]['source']=='website'
  manual={**body,'requestId':str(uuid.uuid4()),'payload':{**body['payload'],'phone':'0698765432','note':'YouCan #pretend'}};del manual['websiteOrderId']
  assert req('/api/orders',manual,owner)[0]==201
  sources={o['payload']['phone']:o['source'] for o in req('/api/orders',cookie=owner)[2]['orders']}
  assert sources=={'0612345678':'website','0698765432':'whatsapp'}
  assert len(req('/api/orders',cookie=agent)[2]['orders'])==1
  uninstall=json.dumps({'event_name':'app.uninstalled','data':{'store_id':store}})
  signature=hmac.new(key.encode(),uninstall.encode(),hashlib.sha256).hexdigest()
  assert req('/api/youcan/webhook',uninstall,headers={'x-youcan-signature':signature})[0]==200
  assert req('/api/youcan',cookie=owner)[2]['connected'] is False
  assert req('/api/youcan/webhook',payload,headers={'x-youcan-signature':sig})[0]==410
  print('PASS: signed callback and replay, encrypted token, verified webhooks, deduplication, hydration, assignment visibility, no automatic Atlas transmission, persisted statuses, confirmation without dispatch, selected dispatch once, source separation, uninstall revocation')
 finally:p.terminate();p.wait(timeout=10);log.close()
