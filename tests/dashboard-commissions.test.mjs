import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dashboardCommissionDues} from '../app/dashboard-commissions.ts';
const order=(id,date='2026-10-25')=>({id,createdEmail:'a@test.com',createdAt:date+'T12:00:00Z',status:'sent',tracking:id,atlasState:17,commissionRate:10});
const pay=(id,amountCents=1000)=>({id,memberEmail:'a@test.com',amountCents,paidAt:'2026-10-25T13:00:00Z'});
const allocation=(orderId,paymentId='p')=>({id:orderId,orderId,paymentId,amountCents:1000,createdAt:'2026-10-25T13:00:00Z',releasedAt:null});
test('individual and bulk paid commissions disappear from dashboard amounts',()=>{
 const rows=[order('one'),order('two')];
 assert.equal(dashboardCommissionDues(rows,[],[]).get('a@test.com'),2000);
 assert.equal(dashboardCommissionDues(rows,[pay('p')],[allocation('two')]).get('a@test.com'),1000);
 assert.equal(dashboardCommissionDues(rows,[pay('p',2000)],[allocation('one'),allocation('two')]).get('a@test.com'),0);
});
test('allocate over full history before filtering; preserve explicit payments outside period',()=>{
 const rows=[order('old','2026-10-24'),order('new')];
 assert.equal(dashboardCommissionDues(rows,[pay('p')],[],'2026-10-25','2026-10-25').get('a@test.com'),1000);
 assert.equal(dashboardCommissionDues(rows,[pay('p')],[allocation('new')],'2026-10-24','2026-10-24').get('a@test.com'),1000);
 assert.equal(dashboardCommissionDues(rows,[pay('p')],[allocation('new')],'2026-10-25','2026-10-25').get('a@test.com'),0);
});
test('partial payments, other agents and reversed deliveries remain correct',()=>{
 const rows=[order('one'),{...order('two'),createdEmail:'b@test.com'}, {...order('cancelled'),status:'cancelled'}];
 const dues=dashboardCommissionDues(rows,[pay('partial',400)],[]);
 assert.equal(dues.get('a@test.com'),600);assert.equal(dues.get('b@test.com'),1000);
 assert.equal(dashboardCommissionDues([{...order('one'),atlasState:18}],[pay('p')],[]).get('a@test.com'),0);
});
