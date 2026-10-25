"""Exercise automatic carrier submission with a temporary DB and a mock Atlas API only."""
import os,subprocess,tempfile,time,urllib.request,urllib.error,json,secrets,sqlite3,uuid
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
with tempfile.TemporaryDirectory() as temp:
 password=secrets.token_urlsafe(24);dbfile=temp+'/app.sqlite';calls=temp+'/calls.jsonl';preload=temp+'/atlas.mjs'
 Path(preload).write_text('''import {appendFileSync} from 'node:fs';
const original=globalThis.fetch,seen=new Map(),failed=new Set();
globalThis.fetch=async(url,options={})=>{
 if(!String(url).startsWith('https://api.atlaslivraison.com/'))return original(url,options);
 if(String(url).endsWith('/stocks'))return Response.json({success:true,data:[{stockId:'stock-test',sku:'TEST',name:'Stock product',available:100,frozen:false}]});
 if(String(url).endsWith('/colis')&&options.method==='POST'){
  const p=JSON.parse(options.body),id=options.headers['Idempotency-Key'];
  appendFileSync(process.env.MOCK_ATLAS_CALLS,JSON.stringify({id,p})+'\\n');
  await new Promise(r=>setTimeout(r,50));
  if(p.fullname==='Fail once'&&!failed.has(id)){failed.add(id);return Response.json({success:false,message:'Carrier temporarily unavailable'},{status:503})}
  if(!seen.has(id))seen.set(id,{code:'TEST-'+id,stateId:1,cfees:'35.00'});
  if(p.fullname==='Ambiguous response'&&!failed.has(id)){failed.add(id);throw Error('Connection lost after carrier accepted order')}
  return Response.json({success:true,data:seen.get(id)},{status:201});
 }
 throw Error('Unexpected mocked Atlas endpoint');
};''')
 env={**os.environ,'SQLITE_PATH':dbfile,'OWNER_EMAIL':'owner@test.com','ADMIN_PASSWORD':password,'ATLAS_API_KEY':'mock-api-key','PORT':'3188','HOSTNAME':'127.0.0.1','NODE_ENV':'production','APP_URL':'http://127.0.0.1:3188','MOCK_ATLAS_CALLS':calls}
 log=open('/tmp/atlas-auto-send-http.log','w');p=subprocess.Popen(['node','--import',preload,'.next/standalone/server.js'],cwd=root,env=env,stdout=log,stderr=log);base='http://127.0.0.1:3188'
 def req(path,body=None,cookie=''):
  headers={'Content-Type':'application/json','Origin':base}
  if cookie:headers['Cookie']=cookie
  request=urllib.request.Request(base+path,headers=headers,data=json.dumps(body).encode() if body is not None else None)
  try:r=urllib.request.urlopen(request);return r.status,r.headers,json.loads(r.read())
  except urllib.error.HTTPError as e:return e.code,e.headers,json.loads(e.read())
 try:
  for _ in range(100):
   try:
    if req('/api/health')[0]==200:break
   except Exception:pass
   if p.poll() is not None:raise RuntimeError('server exited')
   time.sleep(.2)
  else:raise RuntimeError('health timed out')
  status,h,_=req('/api/auth/login',{'email':'owner@test.com','password':password});assert status==200;owner=h['Set-Cookie'].split(';')[0]
  payload={'fulfillmentMode':'stock','atlasStockId':'stock-test','fullname':'Client','phone':'0612345678','phone2':'','address':'10 rue des fleurs Kenitra','cityName':'Kenitra','cityId':'city-test','storeId':'','product':'Stock product','quantity':2,'price':199,'note':'','openpackage':False,'change':False,'allowtry':False}
  def create(name='Client',**patch):return {'action':'create','requestId':str(uuid.uuid4()),'payload':{**payload,'fullname':name,'phone':{'Fail once':'0612345679','Ambiguous response':'0612345680'}.get(name,payload['phone']),**patch}}
  assert req('/api/orders',create(fulfillmentMode='normal'),owner)[0]==400
  assert req('/api/orders',create(cityId=''),owner)[0]==400
  assert req('/api/orders',create(atlasStockId='missing'),owner)[0]==409
  body=create();status,_,result=req('/api/orders',body,owner);assert status==201 and result['tracking'] and not result['pending'],result
  assert req('/api/orders',body,owner)[2]['tracking']==result['tracking']
  assert req('/api/orders',{**body,'payload':{**body['payload'],'price':299}},owner)[0]==409
  for name in ['Fail once','Ambiguous response']:
   body=create(name);status,_,result=req('/api/orders',body,owner);assert status==202 and result['pending'] and result['id']==body['requestId'],result
   row=next(o for o in req('/api/orders',cookie=owner)[2]['orders'] if o['id']==result['id']);assert row['status']=='error' and not row['tracking']
   status,_,result=req('/api/orders',body,owner);assert status==200 and result['tracking'] and not result['pending'],result
  rows=req('/api/orders',cookie=owner)[2]['orders'];assert len(rows)==3 and all(o['status']=='sent' for o in rows)
  entries=[json.loads(s) for s in Path(calls).read_text().splitlines()];assert len(entries)==5
  assert len({e['id'] for e in entries})==3
  assert all(e['p']['stockItems']==[{'stockId':'stock-test','quantity':2}] for e in entries)
  assert all(e['p']['importRef']==e['id'] for e in entries)
  print('PASS: stock-only validation, automatic submission, carrier failure retention, safe retry and idempotent create')
 finally:
  p.terminate();p.wait(timeout=10);log.close()
