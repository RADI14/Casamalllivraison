import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAtlasTransport,retryAfterMs} from '../app/atlas-http.ts';
const base='https://api.atlaslivraison.com/api/external';
const opt={headers:{'x-api-key':'test'}};
test('concurrent reads share one call and stable reference data is reused',async()=>{
 let calls=0;const request=createAtlasTransport({spacing:0,send:async()=>{calls++;return Response.json({success:true,data:[]})}});
 const responses=await Promise.all(Array.from({length:8},()=>request(base+'/cities',opt)));
 await Promise.all(responses.map(r=>r.json()));await request(base+'/cities',opt);assert.equal(calls,1);
 await request(base+'/stocks',opt);await request(base+'/stocks',opt);assert.equal(calls,3);
 await request(base+'/cities',{headers:{'x-api-key':'other'}});assert.equal(calls,4);
});
test('queued requests share cooldown across paths, honour long Retry-After and recover',async()=>{
 let clock=0,calls=0;const request=createAtlasTransport({now:()=>clock,wait:async ms=>{clock+=ms},send:async()=>{calls++;return calls===1?new Response('',{status:429,headers:{'Retry-After':'3600'}}):Response.json({success:true})}});
 const rs=await Promise.all([request(base+'/stocks',opt),request(base+'/colis/1',opt),request(base+'/cities',opt)]);
 assert.ok(rs.every(r=>r.status===429));assert.equal(calls,1);
 clock=3599000;assert.equal((await request(base+'/stores',opt)).status,429);assert.equal(calls,1);
 clock=3600001;assert.equal((await request(base+'/stocks',opt)).status,200);assert.equal(calls,2);
});
test('requests are spaced, writes never deduplicated or retried, and expired requests are not sent',async()=>{
 let clock=0;const times=[];const request=createAtlasTransport({now:()=>clock,wait:async ms=>{clock+=ms},send:async()=>{times.push(clock);return Response.json({success:true})}});
 await Promise.all([request(base+'/stocks',opt),request(base+'/stores',opt)]);assert.deepEqual(times,[0,1500]);
 await Promise.all([request(base+'/colis',{...opt,method:'POST'}),request(base+'/colis',{...opt,method:'POST'})]);assert.equal(times.length,4);
 await assert.rejects(request(base+'/colis',{...opt,method:'POST',signal:AbortSignal.abort()}));assert.equal(times.length,4);
 let count=0;const failing=createAtlasTransport({spacing:0,send:async()=>{count++;throw Error('timeout')}});await assert.rejects(failing(base+'/colis',{...opt,method:'POST'}));assert.equal(count,1);
});
test('Retry-After supports seconds and HTTP dates',()=>{assert.equal(retryAfterMs('3600',0),3600000);assert.equal(retryAfterMs('Thu, 01 Jan 1970 01:00:00 GMT',0),3600000);assert.equal(retryAfterMs('bad',0),0)});
