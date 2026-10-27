import {test} from 'node:test';import assert from 'node:assert/strict';
import {atlasDeliveredAt,dailyDeliveries} from '../app/delivery-date-rules.ts';
import {enrichDeliveryDate} from '../server/atlas-delivery-date.ts';
import {atlasOrderSnapshot} from '../app/atlas-order-sync.ts';
const team=[{email:'a@test.com'},{email:'b@test.com'}];
const order=(id,createdAt,at,extra={})=>({id,createdEmail:'a@test.com',createdAt,status:'sent',tracking:id,atlasState:17,payload:JSON.stringify({atlasDeliveredAt:at}),...extra});
test('actual delivery day ignores creation date, counts once, separates agents and leaves unknown dates unassigned',()=>{
 const rows=[order('old','2026-09-01T12:00:00Z','2026-10-26T12:00:00Z'),order('recent','2026-10-26T12:00:00Z','2026-10-27T12:00:00Z'),order('missing','2026-10-26T12:00:00Z',null),order('timezone','2026-09-01T12:00:00Z','2026-10-26T23:30:00-02:00'),order('other','2026-09-01T12:00:00Z','2026-10-26T12:00:00Z',{createdEmail:'b@test.com'}),order('reversed','2026-10-26T12:00:00Z','2026-10-26T12:00:00Z',{atlasState:19})];
 const result=dailyDeliveries(team,rows,['2026-10-25','2026-10-26','2026-10-27']);
 assert.deepEqual(result.get('a@test.com').points.map(p=>p.delivered),[0,1,2]);assert.equal(result.get('a@test.com').undated,1);assert.equal(result.get('b@test.com').points[1].delivered,1);
});
test('history uses latest confirmed delivered event and rejects ambiguous timestamps',()=>{
 assert.equal(atlasDeliveredAt([{stateId:17,at:'2026-10-26T12:00:00Z'},{stateId:1,at:'2026-10-27T12:00:00Z'},{stateId:17,at:'2026-10-27T10:00:00Z'}]),'2026-10-27T10:00:00.000Z');
 assert.equal(atlasDeliveredAt([{stateId:17,at:'2026-10-26 12:00:00'}]),null);assert.throws(()=>atlasDeliveredAt({}));
 assert.equal(atlasOrderSnapshot({atlasDeliveredAt:'2026-10-26T12:00:00Z'},{stateId:19}).payload.atlasDeliveredAt,undefined);
});
test('sync enriches history read-only, caches dates and never substitutes sync time on failure',async()=>{
 let calls=0;const payload={};const fetcher=async(url,opts)=>{calls++;assert.match(url,/\/history$/);assert.equal(opts.method,undefined);return Response.json({success:true,data:[{stateId:17,at:'2026-10-26T12:00:00Z'}]})};
 await enrichDeliveryDate('mock','code',payload,17,fetcher);assert.equal(payload.atlasDeliveredAt,'2026-10-26T12:00:00.000Z');await enrichDeliveryDate('mock','code',payload,17,fetcher);assert.equal(calls,1);
 await enrichDeliveryDate('mock','code',payload,19,fetcher);assert.equal(payload.atlasDeliveredAt,undefined);
 const missing={};await enrichDeliveryDate('mock','code',missing,17,async()=>Response.json({}, {status:503}));assert.equal(missing.atlasDeliveredAt,undefined);
});
