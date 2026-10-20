// Disposable database only. Setup needs the database owner to simulate legacy
// duplicates created before phone enforcement. The guard is re-enabled before
// committing setup; no other connection can write during this locked setup.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

if (!process.env.PGHOST || !process.env.PGPORT || !process.env.PGDATABASE) throw new Error('Set explicit disposable database connection variables.');
const psql = process.env.PSQL || 'psql';
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const args = sql => ['-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql];
const run = sql => execFileSync(psql, args(sql), { encoding: 'utf8' }).trim();
const ids = [randomUUID(), randomUUID(), randomUUID()];
const phone = `06${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
const idList = ids.map(quote).join(',');
try {
  run(`begin; alter table public.members disable trigger members_active_phone_unique;
    insert into public.members(id,name,phone,fellowship) values ${ids.map(id => `(${quote(id)},'Legacy merge test',${quote(phone)},'Shalach')`).join(',')};
    alter table public.members enable trigger members_active_phone_unique; commit;`);
  run(`select public.merge_legacy_member_group(${quote(ids[0])},array[${quote(ids[1])}]::uuid[],'phone-merge-test')`);
  assert.equal(run(`select count(*) from public.members where id in (${idList}) and is_active`), '2');
  const ordinaryEdit = spawnSync(psql, args(`update public.members set name='Must not save' where id=${quote(ids[0])}`), { encoding: 'utf8' });
  assert.notEqual(ordinaryEdit.status, 0);
  assert.match(ordinaryEdit.stderr, /phone number is already used/);
  assert.equal(run(`select name from public.members where id=${quote(ids[0])}`), 'Legacy merge test');
  const newDuplicate = spawnSync(psql, args(`insert into public.members(name,phone,fellowship) values('Must not save',${quote(phone)},'Shalach')`), { encoding: 'utf8' });
  assert.notEqual(newDuplicate.status, 0);
  run(`select public.merge_legacy_member_group(${quote(ids[0])},array[${quote(ids[2])}]::uuid[],'phone-merge-test')`);
  assert.equal(run(`select count(*) from public.members where id in (${idList}) and is_active`), '1');
  run(`update public.members set name='Resolved' where id=${quote(ids[0])}`);
  console.log('PASS: partial legacy merges reduce conflicts; ordinary saves remain blocked until the number is unique');
} finally {
  run(`delete from public.member_duplicate_decisions where member_a_id in (${idList}) or member_b_id in (${idList});
    delete from public.member_merge_events where primary_member_id in (${idList});
    delete from public.members where id in (${idList});`);
}
