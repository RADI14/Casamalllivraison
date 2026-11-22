import {test} from 'node:test';
import assert from 'node:assert/strict';
import {productPerformance} from '../app/product-performance.ts';

const product={id:'p',sku:'SKU',name:'Press',stock:4};
const day='2026-11-21';
const payload=JSON.stringify({atlasSku:'SKU',product:'Press',quantity:2,price:200});
const order={id:'o',productId:null,payload,createdAt:'2026-11-22T12:00:00Z',status:'sent',
 tracking:'AT1',atlasState:17,commissionRate:10,commissionMultiplier:2,
 unitCostCents:3000,transportActualCents:3000};
const website={local_order_id:'o',received_at:day+'T12:00:00Z',review_status:'confirmed',
 payload:JSON.stringify({lines:[{sku:'SKU',name:'Press',quantity:2}]})};
const ad={productId:'p',date:day,amountCents:3000};

test('product funnel joins Website and Atlas once and computes contribution, upsell and break-even',()=>{
 const {rows,unassignedAds}=productPerformance([product],
  [order,{...order,id:'return',atlasState:18,createdAt:website.received_at}],
  [website,{...website,local_order_id:null,review_status:'new'}],
  [ad,{...ad,productId:null,amountCents:4000}],day,day);
 assert.equal(unassignedAds,4000);
 assert.deepEqual(rows,[{id:'p',name:'Press',sku:'SKU',leads:3,confirmed:2,delivered:1,
  units:2,upsells:1,upsellCommission:1000,spend:3000,profit:6000,confirmationRate:2/3,
  deliveryRate:1/2,upsellRate:1,cpl:1000,cpd:3000,profitPerPiece:3000,
  roi:2,breakEvenAds:9000,breakEvenCpl:3000}]);
});

test('unrecorded spend, explicit zero and missing costs remain distinguishable',()=>{
 const row=(o,expenses)=>productPerformance([product],[o],[],expenses).rows[0];
 assert.equal(row(order,[]).profit,null);
 assert.equal(row(order,[{...ad,amountCents:0}]).profit,9000);
 assert.equal(row(order,[{...ad,amountCents:0}]).roi,null);
 assert.equal(row({...order,unitCostCents:null},[ad]).breakEvenAds,null);
 assert.equal(row({...order,unitCostCents:null},[ad]).profit,null);
});
