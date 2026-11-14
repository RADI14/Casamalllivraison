/** Local Moroccan format for display and carrier requests; validation stays explicit. */
export function localPhone(value:unknown){return typeof value==='string'?value.trim().replace(/[\s.()-]/g,'').replace(/^(?:\+212|00212|212)0?/,'0'):'';}
export function localOrderPhones<T extends Record<string,any>>(payload:T){return {...payload,...('phone' in payload?{phone:localPhone(payload.phone)}:{}),...('phone2' in payload?{phone2:localPhone(payload.phone2)}:{})};}
