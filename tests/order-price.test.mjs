import {test} from 'node:test';import assert from 'node:assert/strict';import {orderPrice} from '../app/order-price.ts';
test('entered COD total survives product selection without a configured price',()=>{assert.equal(orderPrice(199,0,1),199);assert.equal(orderPrice(199,undefined,1),199)});
test('entered COD total survives a different catalogue price and quantity change',()=>{assert.equal(orderPrice(129,9900,2),129);assert.equal(orderPrice(129,9900,4),129)});
test('catalogue suggests a total only for an empty amount and valid price',()=>{assert.equal(orderPrice(0,9900,2),198);assert.equal(orderPrice(0,undefined,2),0);assert.equal(orderPrice(0,NaN,2),0)});
