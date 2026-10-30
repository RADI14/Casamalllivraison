export const expenseCategories=['ads','chatgpt','ai','collaboration','training','hosting','tools','phone','whatsapp','salaries','rent','bank','travel','content','packaging','other'] as const;
export const expenseLabels:Record<string,string>={ads:'Advertising',chatgpt:'ChatGPT subscription',ai:'AI services',collaboration:'Collaboration',training:'Training',hosting:'Hosting & domain',tools:'Tools & software',phone:'Phone & Internet',whatsapp:'WhatsApp tools',salaries:'Fixed salaries',rent:'Premises & administration',bank:'Bank fees',travel:'Business travel',content:'Content creation',packaging:'Packaging',other:'Other expenses'};
export function expenseCategory(e:{category?:string}){return e.category??'ads'}
export function validExpenseClassification(category:unknown,costType:unknown){return typeof category==='string'&&expenseCategories.includes(category as typeof expenseCategories[number])&&(costType==='fixed'||costType==='variable')}

export function validAdAllocation(category:string,productId:unknown,memberEmail:unknown){return category!=='ads'||(typeof productId==='string'&&productId.trim().length>0&&typeof memberEmail==='string'&&memberEmail.trim().length>0)}

// Monthly overheads belong to a complete accounting month, never a single day.
export function expenseInPeriod(e:{date:string;accountingMonth?:string|null},from='',to=''){if(!e.accountingMonth)return (!from||e.date>=from)&&(!to||e.date<=to);const start=e.accountingMonth+'-01',d=new Date(start+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+1,0);const end=d.toISOString().slice(0,10);return (!from||from<=start)&&(!to||to>=end)}
