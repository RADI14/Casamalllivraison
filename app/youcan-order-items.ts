/** Use the actual ordered quantity; an offer label is never a unit multiplier. */
export function youcanOrderItems(lines:any[],stocks:{stockId:string;sku:string;name:string}[]){
 if(!Array.isArray(lines)||!lines.length)throw Error('Complétez les produits avant l’envoi.');
 const quantities=new Map<string,number>();let total=0;
 for(const line of lines){
  if(!Number.isInteger(line.quantity)||line.quantity<1)throw Error('Quantité YouCan invalide. Vérifiez la commande.');
  total+=line.quantity;if(total>9)throw Error('Vérifiez la quantité : maximum 9 pièces.');
  const matches=stocks.filter(s=>line.sku?s.sku===line.sku:!line.variant&&s.name===line.name);
  if(matches.length!==1)throw Error('Choisissez le produit Atlas dans les informations de la commande.');
  const id=matches[0].stockId;quantities.set(id,(quantities.get(id)??0)+line.quantity);
 }
 return [...quantities].map(([stockId,quantity])=>({stockId,quantity}));
}
