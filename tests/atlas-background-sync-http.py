"""Prove standalone startup imports Atlas changes without a logged-in browser."""
import os,subprocess,tempfile,time,urllib.request,json,sqlite3
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
with tempfile.TemporaryDirectory() as temp:
 dbfile=temp+'/app.sqlite';preload=temp+'/atlas.mjs'
 Path(preload).write_text('''const original=globalThis.fetch;globalThis.fetch=async(url,options={})=>{
 if(!String(url).startsWith('https://api.atlaslivraison.com/'))return original(url,options);
 if(options.method&&options.method!=='GET')throw Error('Unexpected Atlas write');
 const code=String(url).split('/').pop();return Response.json({success:true,data:{code,stateId:1,stateName:'Nouveau',fullname:'Updated automatically',product:'Press',quantity:1,price:199,cfees:35}});
 };''')
 env={**os.environ,'SQLITE_PATH':dbfile,'ATLAS_AUTO_SYNC':'true','ATLAS_API_KEY':'mock','PORT':'3190','HOSTNAME':'127.0.0.1','NODE_ENV':'production'}
 with open('/tmp/atlas-background-sync-http.log','w') as log:
  proc=subprocess.Popen(['node','--import',preload,'.next/standalone/server.js'],cwd=root,env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:
     if urllib.request.urlopen('http://127.0.0.1:3190/api/health').status==200:break
    except Exception:pass
    time.sleep(.1)
   else:raise RuntimeError('Server failed to start')
   db=sqlite3.connect(dbfile);db.create_function('audit_actor',0,lambda:'test-fixture')
   for i in range(25):
    db.execute('INSERT INTO orders(id,payload,status,tracking,created_by,created_email,commission_rate,created_at,updated_at,stock_released) VALUES(?,?,?,?,?,?,?,?,?,?)',(f'order-{i:03}',json.dumps({'fullname':'Old','product':'Press','quantity':1,'price':199}),'sent',f'CODE-{i}','Test','test@example.com',10,'2026-10-01T10:00:00Z','2026-10-01T10:00:00Z',1))
   db.commit()
   # No /api/sync call and no authentication. The worker must traverse both pages.
   for _ in range(150):
    count=db.execute('SELECT COUNT(*) FROM orders WHERE synced_at IS NOT NULL').fetchone()[0]
    if count==25:break
    time.sleep(.1)
   assert count==25,count
   assert all(json.loads(row[0])['fullname']=='Updated automatically' for row in db.execute('SELECT payload FROM orders'))
   assert db.execute('SELECT COUNT(*) FROM orders WHERE transport_actual_cents=3500').fetchone()[0]==25
   print('PASS: automatic startup sync without browser, 25 orders across pages, Atlas edits and transport costs imported')
  finally:proc.terminate();proc.wait(timeout=10)
