export const expenseCategories=['ads','chatgpt','ai','collaboration','training','hosting','tools','other'] as const;
export const expenseLabels:Record<string,string>={ads:'Advertising',chatgpt:'ChatGPT subscription',ai:'AI services',collaboration:'Collaboration',training:'Training',hosting:'Hosting & domain',tools:'Tools & software',other:'Other expenses'};
export function expenseCategory(e:{category?:string}){return e.category??'ads'}
export function validExpenseClassification(category:unknown,costType:unknown){return typeof category==='string'&&expenseCategories.includes(category as typeof expenseCategories[number])&&(costType==='fixed'||costType==='variable')}
