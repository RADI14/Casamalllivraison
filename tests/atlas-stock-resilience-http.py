"""Temporary DB and mock carrier: bounded stale stock, rate limits, permissions and recovery."""
import os,subprocess,tempfile,time,urllib.request,urllib.error,json,secrets,sqlite3
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
with tempfile.TemporaryDirectory() as temp:
 config=temp+'/mock.json';calls=temp+'/calls';preload=temp+'/mock.mjs';dbfile=temp+'/db.sqlite';password=secrets.token_urlsafe(24)
 def mode(offset=0,status=200):Path(config).write_text(json.dumps({'offset':offset,'status':status}))
 mode()
 Path(preload).write_text('''import {readFileSync,appendFileSync} from 'node:fs';
const cfg=()=>JSON.parse(readFileSync(process.env.MOCK_CONFIG,'utf8'));const now=Date.now.bind(Date);Date.now=()=>now()+cfg().offset;
const original=globalThis.fetch;globalThis.fetch=async(url,options={})=>{
 if(!String(url).startsWith('https://api.atlaslivraison.com/'))return original(url,options);
 if(options.method&&options.method!=='GET')throw Error('Carrier writes forbidden');
 if(String(url).endsWith('/stocks')){appendFileSync(process.env.MOCK_CALLS,'stock\\n');const c=cfg();
 if(c.status!==200)return Response.json({success:false},{status:c.status,headers:{'Retry-After':'120'}});
 return Response.json({success:true,data:[{stockId:'A',sku:'a',name:'Allowed',available:c.offset?0:12},{stockId:'B',sku:'b',name:'Private',available:9}]});}
 return Response.json({success:true,data:[]});};''')
 env={**os.environ,'SQLITE_PATH':dbfile,'OWNER_EMAIL':'owner@test.com','ADMIN_PASSWORD':password,'ATLAS_AUTO_SYNC':'false','ATLAS_API_KEY':'mock-key','MOCK_CONFIG':config,'MOCK_CALLS':calls,'PORT':'3193','HOSTNAME':'127.0.0.1','NODE_ENV':'production','APP_URL':'http://127.0.0.1:3193'}
 base='http://127.0.0.1:3193'
 def req(path,body=None,cookie=''):
  r=urllib.request.Request(base+path,headers={'Content-Type':'application/json','Origin':base,'Cookie':cookie},data=None if body is None else json.dumps(body).encode())
  try:
   with urllib.request.urlopen(r) as res:return res.status,res.headers,json.loads(res.read())
  except urllib.error.HTTPError as e:return e.code,e.headers,json.loads(e.read())
 def count():return len(Path(calls).read_text().splitlines())
 with open('/tmp/atlas-stock-resilience-http.log','w') as log:
  proc=subprocess.Popen(['node','--import',preload,'.next/standalone/server.js'],cwd=root,env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:
     if req('/api/health')[0]==200:break
    except Exception:pass
    time.sleep(.1)
   s,h,_=req('/api/auth/login',{'email':'owner@test.com','password':password});assert s==200;owner=h['Set-Cookie'].split(';')[0]
   assert req('/api/atlas?stocksOnly=1')[0]==401
   s,_,j=req('/api/atlas?stocksOnly=1',cookie=owner);assert s==200 and not j['stockStale'] and len(j['stocks'])==2;assert count()==1
   ap=secrets.token_urlsafe(24);assert req('/api/team',{'action':'create','name':'Agent','email':'a@test.com','password':ap},owner)[0]==200
   _,h,_=req('/api/auth/login',{'email':'a@test.com','password':ap});agent=h['Set-Cookie'].split(';')[0]
   db=sqlite3.connect(dbfile);db.create_function('audit_actor',0,lambda:'test-fixture');db.execute("INSERT INTO member_products(member_email,stock_id) VALUES('a@test.com','A')");db.commit()
   for _ in range(5):assert req('/api/atlas?stocksOnly=1',cookie=owner)[0]==200
   assert count()==1,'requests must share the fresh cache'
   mode(61000,429)
   for path in ['/api/atlas?stocksOnly=1','/api/atlas']:
    s,_,j=req(path,cookie=agent);assert s==200 and j['stockReady'] and j['stockStale'];assert len(j['stocks'])==1 and 'available' not in j['stocks'][0]
   assert count()==2,'cooldown must prevent repeated calls'
   mode(121000,200);assert req('/api/atlas?stocksOnly=1',cookie=owner)[2]['stockStale'];assert count()==2,'Retry-After must be respected'
   mode(182000,200);s,_,j=req('/api/atlas?stocksOnly=1',cookie=agent);assert s==200 and not j['stockStale'] and j['stocks']==[];assert count()==3,'recovery must hide newly empty products'
   mode(243000,401);assert req('/api/atlas?stocksOnly=1',cookie=owner)[0]==502,'auth failures must not serve stale stock'
   mode(483000,429);assert req('/api/atlas?stocksOnly=1',cookie=owner)[0]==502,'expired snapshot must fail closed'
   print('PASS: shared stock cache, bounded stale fallback, Retry-After, authorization/privacy, recovery/zero stock, authentication failure, expiry; mock carrier only')
  finally:proc.terminate();proc.wait(timeout=10)
