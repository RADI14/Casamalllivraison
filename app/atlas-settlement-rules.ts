/** Imported statements describe Atlas accounting, not confirmed bank receipts. */
export function atlasSettlementSummary(input:any,now=Date.now()){
 const bad=()=>{throw Error('Relevé Atlas invalide ou incomplet.');};
 const amount=(v:any)=>{if(!Number.isSafeInteger(v)||v<0||v>100000000000)bad();return v as number};
 const asOf=input?.extractedAt;if(typeof asOf!=='string'||!Number.isFinite(Date.parse(asOf))||Date.parse(asOf)>now+300000)bad();
 if(!Array.isArray(input.invoices)||!input.invoices.length||input.invoices.length>10000||!Array.isArray(input.withdrawals)||input.withdrawals.length>20000||!Array.isArray(input.walletTransactions)||input.walletTransactions.length>40000)bad();
 let codCents=0,feesCents=0,netCents=0,parcelCount=0;const codes=new Map<string,number>();
 for(const r of input.invoices){if(typeof r.code!=='string'||!/^FAC-[A-Z0-9-]+$/.test(r.code)||codes.has(r.code))bad();codCents+=amount(r.codCents);feesCents+=amount(r.feesCents);netCents+=amount(r.netCents);parcelCount+=amount(r.parcelCount);if(r.codCents-r.feesCents!==r.netCents)bad();codes.set(r.code,r.netCents);}
 let paidCents=0,pendingCents=0;
 for(const r of input.withdrawals){const n=amount(r.amountCents);if(r.status==='Payé')paidCents+=n;else if(r.status==='En attente')pendingCents+=n;else bad();}
 let deposits=0,withdrawn=0;const deposited=new Set<string>();
 for(const r of input.walletTransactions){if(!Number.isSafeInteger(r.amountCents))bad();if(r.type==='Dépôt'){const code=/FAC-[A-Z0-9-]+/.exec(String(r.description))?.[0];if(!code||!codes.has(code)||deposited.has(code)||r.amountCents!==codes.get(code))bad();deposited.add(code!);deposits+=amount(r.amountCents);}else if(r.type==='Retrait')withdrawn+=amount(-r.amountCents);else bad();}
 const balanceCents=netCents-paidCents-pendingCents;
 if(deposits!==netCents||deposited.size!==codes.size||withdrawn!==paidCents+pendingCents||balanceCents<0||![codCents,feesCents,netCents,paidCents,pendingCents,balanceCents,parcelCount].every(Number.isSafeInteger))bad();
 return {asOf,invoiceCount:codes.size,parcelCount,codCents,feesCents,netCents,paidCents,pendingCents,balanceCents,amountDueCents:balanceCents+pendingCents};
}
