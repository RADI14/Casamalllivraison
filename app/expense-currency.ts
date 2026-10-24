import {cents} from './finance-rules.ts';

// Persist six decimal places for rates and round converted totals once to DH cents.
export function convertExpense(amount:unknown,currency:unknown='MAD',rate:unknown=undefined){
 const originalAmountCents=cents(amount);
 if(originalAmountCents===null||(currency!=='MAD'&&currency!=='USD'))return null;
 if(currency==='MAD')return {currency,originalAmountCents,exchangeRateMicros:1000000,amountCents:originalAmountCents};
 if((typeof rate!=='string'&&typeof rate!=='number')||!/^\d+(\.\d{1,6})?$/.test(String(rate)))return null;
 const exchangeRateMicros=Math.round(Number(rate)*1000000);
 if(exchangeRateMicros<=0||exchangeRateMicros>100000000)return null;
 const amountCents=Math.round(originalAmountCents*exchangeRateMicros/1000000);
 if(!Number.isSafeInteger(amountCents)||amountCents>1000000000)return null;
 return {currency,originalAmountCents,exchangeRateMicros,amountCents};
}
