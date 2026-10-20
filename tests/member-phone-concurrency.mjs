// Disposable database only. Set PGHOST, PGPORT and PGDATABASE before running.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

if (!process.env.PGHOST || !process.env.PGPORT || !process.env.PGDATABASE) throw new Error('Set explicit disposable database connection variables.');
const psql = process.env.PSQL || 'psql';
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const baseArgs = ['-X', '-At', '-v', 'ON_ERROR_STOP=1'];
const run = sql => execFileSync(psql, [...baseArgs, '-c', sql], { encoding: 'utf8' }).trim();
const name = `phone-race-${randomUUID()}`;
const phone = `06${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
const command = number => `insert into public.members(name,phone,fellowship) values(${quote(name)},${quote(number)},'Shalach');`;
const completed = child => new Promise((resolve, reject) => {
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.on('error', reject);
  child.on('close', code => resolve({ code, stderr }));
});
const first = spawn(psql, baseArgs);
const firstDone = completed(first);
let firstOutput = '';
let marker;
const ready = new Promise(resolve => { marker = resolve; });
first.stdout.on('data', chunk => {
  firstOutput += chunk;
  if (firstOutput.includes('CLAIM_READY')) marker();
});
let second;
try {
  first.stdin.write(`begin;\n${command(phone)}\nselect 'CLAIM_READY';\n`);
  await Promise.race([ready, firstDone.then(result => { throw new Error(`First transaction exited early: ${result.stderr}`); })]);
  second = spawn(psql, [...baseArgs, '-c', command(`+233${phone.slice(1)}`)], { env: { ...process.env, PGAPPNAME: name } });
  const secondDone = completed(second);
  let blocked = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    blocked = run(`select exists(select 1 from pg_stat_activity where application_name=${quote(name)} and wait_event_type='Lock')`) === 't';
    if (blocked) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.ok(blocked, 'Competing equivalent-phone save waits on the first transaction');
  first.stdin.end('commit;\n');
  assert.equal((await firstDone).code, 0);
  const result = await secondDone;
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /phone number is already used/);
  assert.equal(run(`select count(*) from public.members where name=${quote(name)}`), '1');
  console.log('PASS: simultaneous equivalent-phone saves serialize; exactly one record commits');
} finally {
  if (first.exitCode === null) first.kill();
  if (second?.exitCode === null) second.kill();
  run(`delete from public.members where name=${quote(name)}`);
}
