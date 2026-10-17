import {commission,normalizeEmail} from './rules.ts';
export function commissionBalances(team:any[],orders:any[],payments:any[]){const rows=team.map(m=>({...m,leads:0,delivered:0,earnedCents:0,paidCents:0,dueCents:0,advanceCents:0,balanceCents:0})),map=new Map(rows.map(m=>[normalizeEmail(m.email),m]));for(const o of orders){const m=map.get(normalizeEmail(o.createdEmail??''));if(!m)continue;m.leads++;const earned=commission(o)*100;m.earnedCents+=earned;if(earned)m.delivered++}for(const p of payments){const m=map.get(normalizeEmail(p.memberEmail));if(m)m.paidCents+=p.amountCents}for(const m of rows){m.balanceCents=m.earnedCents-m.paidCents;m.dueCents=Math.max(0,m.balanceCents);m.advanceCents=Math.max(0,-m.balanceCents)}const totals=rows.reduce((a,m)=>({leads:a.leads+m.leads,delivered:a.delivered+m.delivered,earnedCents:a.earnedCents+m.earnedCents,paidCents:a.paidCents+m.paidCents,dueCents:a.dueCents+m.dueCents,advanceCents:a.advanceCents+m.advanceCents}),{leads:0,delivered:0,earnedCents:0,paidCents:0,dueCents:0,advanceCents:0});return {members:rows,totals}}
export const recordCommissionPaymentSQL=`INSERT INTO commission_payments(id,member_email,amount_cents,paid_at,paid_by,note)
 SELECT ?,email,?,?,?,? FROM members
 WHERE email=? AND ?=(
 (SELECT COUNT(*)*1000 FROM orders WHERE lower(trim(created_email))=members.email AND tracking IS NOT NULL AND tracking<>'' AND atlas_state=17 AND commission_rate=10 AND status<>'cancelled')
 -(SELECT COALESCE(SUM(amount_cents),0) FROM commission_payments WHERE member_email=members.email))
 ON CONFLICT(id) DO NOTHING`;
