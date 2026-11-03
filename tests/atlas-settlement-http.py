"""Admin-only statement persistence, not an Atlas or bank transaction."""
import os,subprocess,tempfile,time,urllib.request,urllib.error,json,secrets,sqlite3
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
with tempfile.TemporaryDirectory() as temp:
 password=secrets.token_urlsafe(24);base='http://127.0.0.1:3194';dbfile=temp+'/db.sqlite'
 env={**os.environ,'SQLITE_PATH':dbfile,'OWNER_EMAIL':'owner@test.com','ADMIN_PASSWORD':password,'ATLAS_AUTO_SYNC':'false','PORT':'3194','HOSTNAME':'127.0.0.1','NODE_ENV':'production','APP_URL':base}
 def req(path,body=None,cookie='',origin=base):
  request=urllib.request.Request(base+path,headers={'Content-Type':'application/json','Origin':origin,'Cookie':cookie},data=None if body is None else json.dumps(body).encode())
  try:
   with urllib.request.urlopen(request) as r:return r.status,r.headers,json.loads(r.read())
  except urllib.error.HTTPError as e:return e.code,e.headers,json.loads(e.read())
 with open('/tmp/atlas-settlement-http.log','w') as log:
  proc=subprocess.Popen(['node','.next/standalone/server.js'],cwd=root,env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:
     if req('/api/health')[0]==200:break
    except Exception:pass
    time.sleep(.1)
   assert req('/api/atlas-settlement')[0]==403
   _,h,_=req('/api/auth/login',{'email':'owner@test.com','password':password});owner=h['Set-Cookie'].split(';')[0]
   assert req('/api/atlas-settlement',cookie=owner)[2]['settlement'] is None
   body={'extractedAt':'2026-11-03T10:00:00Z','invoices':[{'code':'FAC-A','codCents':397000,'feesCents':83700,'netCents':313300,'parcelCount':29}],'withdrawals':[{'amountCents':313300,'status':'En attente'}],'walletTransactions':[{'type':'Dépôt','amountCents':313300,'description':'Dépôt — facture FAC-A'},{'type':'Retrait','amountCents':-313300}]}
   assert req('/api/atlas-settlement',body,owner,origin='https://other.example')[0]==403
   assert req('/api/atlas-settlement',{},owner)[0]==400
   for _ in range(2):assert req('/api/atlas-settlement',body,owner)[0]==201
   db=sqlite3.connect(dbfile);assert db.execute('SELECT COUNT(*) FROM atlas_settlement_snapshots').fetchone()[0]==1
   summary=req('/api/atlas-settlement',cookie=owner)[2]['settlement'];assert summary['amountDueCents']==313300 and summary['balanceCents']==0
   body['extractedAt']='2026-11-02T10:00:00Z';assert req('/api/atlas-settlement',body,owner)[0]==409
   ap=secrets.token_urlsafe(24);assert req('/api/team',{'action':'create','name':'Agent','email':'agent@test.com','password':ap},owner)[0]==200
   _,h,_=req('/api/auth/login',{'email':'agent@test.com','password':ap});agent=h['Set-Cookie'].split(';')[0]
   assert req('/api/atlas-settlement',cookie=agent)[0]==403 and req('/api/atlas-settlement',body,agent)[0]==403
   assert db.execute('SELECT COUNT(*) FROM carrier_receipts').fetchone()[0]==0
   print('PASS: admin scope, origin, validation, persistent totals, idempotent import, older statement rejection, no bank receipt creation')
  finally:proc.terminate();proc.wait(timeout=10)
