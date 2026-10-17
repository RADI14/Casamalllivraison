export type MemberEdit={oldEmail:string;email:string;name:string;active:number;originalName:string;originalActive:number;createdAt:string};
// D1 batch is transactional: a duplicate target email rolls back all child updates.
// The same original snapshot guards every statement against concurrent edits.
export function memberEditStatements(b:MemberEdit){
 const guard='EXISTS(SELECT 1 FROM members WHERE email=? AND name=? AND active=? AND created_at=?)';
 const snapshot=[b.oldEmail,b.originalName,b.originalActive,b.createdAt];
 return [
  {sql:`UPDATE orders SET created_email=?,created_by=? WHERE lower(trim(created_email))=? AND ${guard}`,args:[b.email,b.name,b.oldEmail,...snapshot]},
  {sql:`UPDATE ad_expenses SET member_email=? WHERE lower(trim(member_email))=? AND ${guard}`,args:[b.email,b.oldEmail,...snapshot]},
  {sql:`UPDATE commission_payments SET member_email=? WHERE lower(trim(member_email))=? AND ${guard}`,args:[b.email,b.oldEmail,...snapshot]},
  {sql:'UPDATE members SET email=?,name=?,active=? WHERE email=? AND name=? AND active=? AND created_at=?',args:[b.email,b.name,b.active,...snapshot]}
 ];
}
