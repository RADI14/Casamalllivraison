export const editableFields=['fullname','phone','phone2','address','cityId','price','product','quantity','note','openpackage','allowtry','storeId'] as const;
export function orderEditChanges(raw:any,saved:Record<string,any>){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!editableFields.includes(k as any)))throw Error('Champs de modification invalides.');
 const changes:Record<string,any>={};
 for(const [key,input] of Object.entries(raw)){
  let value:any=input;
  if(['price','quantity'].includes(key)){if(typeof value!=='number'||!Number.isInteger(value)||value<1||value>(key==='price'?1000000:1000))throw Error('Montant ou quantité invalide.');}
  else if(['openpackage','allowtry'].includes(key)){if(typeof value!=='boolean')throw Error('Options invalides.');}
  else {if(typeof value!=='string'||value.length>1000)throw Error('Champs invalides.');value=value.trim();if(['fullname','address','cityId','product'].includes(key)&&!value)throw Error('Complétez les champs obligatoires.');if(key==='address'&&value.replace(/\s/g,'').length<10)throw Error('Adresse : 10 caractères hors espaces minimum.');if(key==='phone'||key==='phone2'){value=value.replace(/\s/g,'').replace(/^\+212/,'0');if((key==='phone'||value)&&!/^0[67]\d{8}$/.test(value))throw Error('Téléphone invalide (06/07).');}}
  if(value!==(saved[key]??(['openpackage','allowtry'].includes(key)?false:'')))changes[key]=value;
 }
 if(saved.stockItems?.length&&('product'in changes||'quantity'in changes))throw Error('Le produit et la quantité d’un colis sur stock doivent être modifiés dans Atlas.');
 return changes;
}
