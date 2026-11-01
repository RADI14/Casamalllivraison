"""Background stock changes must be imported without a logged-in browser."""
import os,subprocess,tempfile,time,urllib.request,json,sqlite3
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
with tempfile.TemporaryDirectory() as temp:
 dbfile=temp+'/app.sqlite';datafile=temp+'/stock.json';preload=temp+'/mock.mjs'
 Path(datafile).write_text(json.dumps([{'stockId':'A','sku':'a','name':'Product A','available':12}]))
 Path(preload).write_text('''import {readFileSync} from 'node:fs';const original=globalThis.fetch;globalThis.fetch=async(url,options={})=>{
 if(!String(url).startsWith('https://api.atlaslivraison.com/'))return original(url,options);
 if(options.method&&options.method!=='GET')throw Error('Carrier writes forbidden');
 if(String(url).endsWith('/stocks'))return Response.json({success:true,data:JSON.parse(readFileSync(process.env.MOCK_STOCK_FILE,'utf8'))});
 return Response.json({success:true,data:[]});};''')
 env={**os.environ,'SQLITE_PATH':dbfile,'ATLAS_AUTO_SYNC':'true','ATLAS_API_KEY':'mock-stock-key','MOCK_STOCK_FILE':datafile,'PORT':'3191','HOSTNAME':'127.0.0.1','NODE_ENV':'production'}
 with open('/tmp/atlas-stock-background-http.log','w') as log:
  proc=subprocess.Popen(['node','--import',preload,'.next/standalone/server.js'],cwd=root,env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:
     if urllib.request.urlopen('http://127.0.0.1:3191/api/health').status==200:break
    except Exception:pass
    time.sleep(.1)
   else:raise RuntimeError('Server failed to start')
   db=sqlite3.connect(dbfile)
   def snapshot():
    row=db.execute('SELECT stocks FROM atlas_stock_snapshot').fetchone()
    return json.loads(row[0]) if row else []
   for _ in range(100):
    if snapshot():break
    time.sleep(.1)
   assert snapshot()[0]['available']==12
   Path(datafile).write_text(json.dumps([{'stockId':'A','sku':'a','name':'Product A','available':0},{'stockId':'B','sku':'b','name':'Product B','available':7}]))
   # Wait for the real 30-second scheduler, with no stock endpoint requests.
   for _ in range(360):
    stocks=snapshot()
    if len(stocks)==2 and stocks[0]['available']==0:break
    time.sleep(.1)
   assert stocks[0]['available']==0 and stocks[1]['available']==7,stocks
   catalogue=json.loads(db.execute('SELECT products FROM atlas_product_catalog').fetchone()[0])
   assert len(catalogue)==2 and all('available' not in p for p in catalogue)
   print('PASS: background startup and next automatic tick import changed and new stock; assignment catalogue updated; no browser or carrier writes')
  finally:proc.terminate();proc.wait(timeout=10)
