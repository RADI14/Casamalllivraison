"""Exercise the real API against an isolated database without carrier calls."""
import os,subprocess,tempfile,time,urllib.request,urllib.error,json,secrets,sqlite3
from pathlib import Path
root=str(Path(__file__).resolve().parent.parent)
with tempfile.TemporaryDirectory() as temp:
 password=secrets.token_urlsafe(24);agentpass=secrets.token_urlsafe(24);base='http://127.0.0.1:3193'
 env={**os.environ,'SQLITE_PATH':temp+'/test.sqlite','OWNER_EMAIL':'owner@test.com','ADMIN_PASSWORD':password,'PORT':'3193','HOSTNAME':'127.0.0.1','NODE_ENV':'production','APP_URL':base,'ATLAS_API_KEY':''}
 log=open('/tmp/agent-trends-http.log','w');proc=subprocess.Popen(['node','.next/standalone/server.js'],cwd=root,env=env,stdout=log,stderr=log)
 def req(path,body=None,cookie=''):
  headers={'Content-Type':'application/json','Origin':base,'Cookie':cookie}
  try:
   r=urllib.request.urlopen(urllib.request.Request(base+path,headers=headers,data=json.dumps(body).encode() if body is not None else None));return r.status,r.headers,json.loads(r.read())
  except urllib.error.HTTPError as e:return e.code,e.headers,json.loads(e.read())
 try:
  for _ in range(100):
   try:
    if req('/api/health')[0]==200:break
   except Exception:pass
   if proc.poll() is not None:raise RuntimeError('server exited')
   time.sleep(.2)
  else:raise RuntimeError('health timed out')
  _,h,_=req('/api/auth/login',{'email':'owner@test.com','password':password});owner=h['Set-Cookie'].split(';')[0]
  assert req('/api/team',{'action':'create','name':'Amal','email':'a@test.com','password':agentpass},owner)[0]==200
  _,h,_=req('/api/auth/login',{'email':'a@test.com','password':agentpass});agent=h['Set-Cookie'].split(';')[0]
  assert req('/api/team-trends?to=2026-10-23')[0]==403
  assert req('/api/team-trends?to=2026-10-23',cookie=agent)[0]==403
  for day in ['2026-02-30','2026-10-23x','2099-01-01']:
   assert req('/api/team-trends?to='+day,cookie=owner)[0]==400
  db=sqlite3.connect(temp+'/test.sqlite')
  payload=json.dumps({'price':100,'quantity':1})
  db.execute('INSERT INTO orders(id,payload,status,tracking,created_by,created_email,commission_rate,created_at,updated_at,atlas_state,unit_cost_cents,transport_actual_cents) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',('demo',payload,'sent','AT-DEMO','Amal','a@test.com',10,'2026-10-22T23:30:00Z','2026-10-22T23:30:00Z',17,2000,1000));db.commit();db.close()
  status,h,data=req('/api/team-trends?to=2026-10-23',cookie=owner)
  assert status==200 and 'no-store' in h['Cache-Control']
  assert data['start']=='2026-10-14' and data['end']=='2026-10-23'
  m=data['members'][0];assert len(m['points'])==10 and m['points'][-1]['orders']==1 and m['points'][-1]['revenue']==10000
  assert m['points'][-2]['orders']==0 and m['totals']['net'] is None
  print('PASS: real admin API, agent denied, invalid dates rejected, Morocco day assignment, ten zero-filled days, private no-store response')
 finally:
  proc.terminate();proc.wait(timeout=10);log.close()
