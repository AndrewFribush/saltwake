import {DatabaseSync} from 'node:sqlite';
import {closeSync,openSync,readFileSync,unlinkSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import type {Command,OperationStatus} from '../../../packages/shared/src/types';
export type Signed={hash:string;bytes:string;nonce?:string};
export type StoredOperation={authority?:'player';id:string;command:Command;hash:string;status:'Pending'|'Unknown'|'Applied'|'Rejected';signed?:Signed;signedAt?:number;retired?:Signed[];receipt?:OperationStatus;reason?:string};
export class Store {
 readonly sql:DatabaseSync;private closed=false;private lock:string;
 constructor(path:string){
  mkdirSync(dirname(path),{recursive:true,mode:0o700});this.lock=path+'.writer';
  const acquire=()=>{const fd=openSync(this.lock,'wx',0o600);try{writeFileSync(fd,String(process.pid));}finally{closeSync(fd);}};
  try{acquire();}catch(error){
   let stale=false;try{const pid=Number(readFileSync(this.lock,'utf8'));if(!Number.isSafeInteger(pid)||pid<1)throw Error('Invalid writer lock');try{process.kill(pid,0);}catch(e){stale=(e as NodeJS.ErrnoException).code==='ESRCH';}}catch{}
   if(!stale)throw Error('Database already has a writer');unlinkSync(this.lock);acquire();
  }
  try{this.sql=new DatabaseSync(path);this.sql.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL,id TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(kind,id));');}catch(e){unlinkSync(this.lock);throw e;}
 }
 transaction<T>(fn:()=>T):T{this.sql.exec('BEGIN IMMEDIATE');try{const value=fn();this.sql.exec('COMMIT');return value;}catch(e){this.sql.exec('ROLLBACK');throw e;}}
 operation(id:string):StoredOperation|undefined{const row=this.sql.prepare('SELECT value FROM operations WHERE id=?').get(id);return row?JSON.parse(row.value as string):undefined;}
 operations():StoredOperation[]{return this.sql.prepare('SELECT value FROM operations ORDER BY rowid').all().map(r=>JSON.parse(r.value as string));}
 putOperation(row:StoredOperation){const encoded=JSON.stringify(row);if(Buffer.byteLength(encoded)>393216)throw Error('Operation record too large');this.sql.prepare('INSERT INTO operations(id,value) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(row.id,encoded);}
 get<T>(kind:string,id:string):T|undefined{const row=this.sql.prepare('SELECT value FROM records WHERE kind=? AND id=?').get(kind,id);return row?JSON.parse(row.value as string):undefined;}
 all<T>(kind:string):T[]{return this.sql.prepare('SELECT value FROM records WHERE kind=? ORDER BY rowid').all(kind).map(r=>JSON.parse(r.value as string));}
 put(kind:string,id:string,value:unknown){const encoded=JSON.stringify(value);if(Buffer.byteLength(encoded)>262144)throw Error('Record too large');this.sql.prepare('INSERT INTO records(kind,id,value) VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET value=excluded.value').run(kind,id,encoded);}
 remove(kind:string,id:string){this.sql.prepare('DELETE FROM records WHERE kind=? AND id=?').run(kind,id);}
 close(){if(!this.closed){this.sql.close();unlinkSync(this.lock);this.closed=true;}}
}
