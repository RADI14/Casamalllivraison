export type RemovalSnapshot={email:string;name:string;active:number;createdAt:string;deletedAt?:string|null};
// Keep membership for historical finance joins; only remove access and current team visibility.
export function memberRemovalStatements(m:RemovalSnapshot,restore:boolean,now:string){
 const guard='email=? AND name=? AND active=? AND created_at=? AND '+(restore?'deleted_at=?':'deleted_at IS NULL');
 const args=[m.email,m.name,m.active,m.createdAt,...(restore?[m.deletedAt!]:[])];
 return [
  {sql:`DELETE FROM app_sessions WHERE email=? AND EXISTS(SELECT 1 FROM members WHERE ${guard})`,args:[m.email,...args]},
  {sql:`DELETE FROM app_password_recovery WHERE email=? AND EXISTS(SELECT 1 FROM members WHERE ${guard})`,args:[m.email,...args]},
  {sql:`UPDATE members SET active=0,deleted_at=? WHERE ${guard}`,args:[restore?null:now,...args]}
 ];
}
