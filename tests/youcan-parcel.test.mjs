import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchWebsiteParcel} from '../server/youcan-parcel.ts';
const stocks=[{stockId:'s',sku:'S',name:'P',available:10,frozen:false}],cities=[{id:'c',name:'Kénitra'}];
const draft={fullname:'Test',phone:'0612345678',address:'Full address',cityName:'kenitra',price:149,lines:[{sku:'S',name:'P',quantity:2}]};
test('exact stock and unique city retain the full COD total and combine repeated stock lines',()=>{const p=matchWebsiteParcel({...draft,lines:[...draft.lines,{sku:'S',name:'P',quantity:1}]},stocks,cities,[]);assert.equal(p.price,149);assert.equal(p.cityId,'c');assert.deepEqual(p.items,[{stockId:'s',quantity:3}]);assert.equal(p.openpackage,false)});
test('variants, ambiguous cities, unknown products, excessive quantities and multiple stores require review',()=>{
 for(const [d,s,c,stores] of [[{...draft,lines:[{...draft.lines[0],variant:'Pack 2'}]},stocks,cities,[]],[draft,stocks,[...cities,...cities],[]],[{...draft,lines:[{sku:'missing',quantity:1}]},stocks,cities,[]],[{...draft,lines:[{sku:'S',quantity:10}]},stocks,cities,[]],[draft,stocks,cities,[{id:'a'},{id:'b'}]]])assert.throws(()=>matchWebsiteParcel(d,s,c,stores));
});
