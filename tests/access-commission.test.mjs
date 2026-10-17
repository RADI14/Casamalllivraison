import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canAccessOrder,commission,normalizeEmail} from '../app/rules.ts';
const agent={role:'agent',email:'agent@example.com'};
const admin={role:'admin',email:'owner@example.com'};
test('agents can access only their own orders, including no legacy unassigned orders',()=>{
 assert.equal(canAccessOrder(agent,{createdEmail:agent.email}),true);
 assert.equal(canAccessOrder(agent,{createdEmail:'another@example.com'}),false);
 assert.equal(canAccessOrder(agent,{createdEmail:null}),false);
 assert.equal(canAccessOrder(agent,{createdEmail:'AGENT@example.com'}),true);
});
test('admin retains access to all orders and legacy records',()=>{
 for(const createdEmail of [null,'another@example.com',admin.email])assert.equal(canAccessOrder(admin,{createdEmail}),true);
});
test('email matching is normalized',()=>assert.equal(normalizeEmail(' AGENT@Example.com '),'agent@example.com'));
test('commission requires Atlas delivered state, tracking and agent rate',()=>{
 const delivered={atlasState:17,tracking:'AT-1',commissionRate:10};
 assert.equal(commission(delivered),10);
 for(const atlasState of [null,1,2,16,18,99])assert.equal(commission({...delivered,atlasState}),0);
 assert.equal(commission({...delivered,tracking:null}),0);
 assert.equal(commission({...delivered,commissionRate:0}),0);
});
test('a parcel with multiple items earns ten once; refresh is idempotent; corrected status removes commission',()=>{
 const order={atlasState:17,tracking:'AT-1',commissionRate:10,quantity:4};
 for(let i=0;i<10;i++)assert.equal(commission(order),10);
 order.atlasState=18;assert.equal(commission(order),0);
});
