import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startAtlasSyncLoop} from '../server/atlas-sync-loop.ts';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('background loop pages without overlapping requests, pauses after full scan and stops',async()=>{
 const scheduled=[];let release;const calls=[];
 const stop=startAtlasSyncLoop(async cursor=>{calls.push(cursor);return await new Promise(r=>{release=r})},(fn,ms)=>{scheduled.push({fn,ms});return {}});
 assert.equal(scheduled[0].ms,5000);scheduled.shift().fn();assert.deepEqual(calls,[undefined]);assert.equal(scheduled.length,0);
 release({nextCursor:'order-020'});await flush();assert.equal(scheduled[0].ms,1000);scheduled.shift().fn();assert.deepEqual(calls,[undefined,'order-020']);release({nextCursor:null});await flush();assert.equal(scheduled[0].ms,60000);
 stop();scheduled.shift().fn();assert.equal(calls.length,2);
});
test('rate limits preserve cursor; failures retry without losing position',async()=>{
 const queue=[];let n=0;const cursors=[];
 startAtlasSyncLoop(async cursor=>{cursors.push(cursor);n++;if(n===1)return {nextCursor:'b'};if(n===2)return {nextCursor:null,retryAfterMs:90000};if(n===3)throw Error('offline');return {nextCursor:null}},(fn,ms)=>{queue.push({fn,ms});return {}});
 for(const delay of [5000,1000,90000,60000]){assert.equal(queue[0].ms,delay);queue.shift().fn();await flush()}
 assert.deepEqual(cursors,[undefined,'b','b','b']);assert.equal(queue[0].ms,60000);
});
