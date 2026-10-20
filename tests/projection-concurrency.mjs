// Disposable database only. Explicit PG connection variables are required.
import assert from 'node:assert/strict';
import { spawn,execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
if (!process.env.PGHOST || !process.env.PGPORT || !process.env.PGDATABASE) throw new Error('Set the disposable database connection explicitly.');
const psql=process.env.PSQL || 'psql';
const args=['-X','-At','-v','ON_ERROR_STOP=1'];
const run=query => execFileSync(psql,[...args,'-c',query],{encoding:'utf8'}).trim();
const tag=`projection-race-${randomUUID()}`;
const id=randomUUID();
const sunday=run("select (current_date+(7-extract(dow from current_date)::int)+700)::text");
const command=`select revision from public.save_fellowship_sunday_projection('${sunday}','Mega',array['${id}']::uuid[],0,'${tag}','[{"id":"${randomUUID()}","name":"Expected Guest","phone":""}]'::jsonb);`;
const done=child => new Promise((resolve,reject) => {let stderr='';child.stderr.on('data',chunk => {stderr+=chunk;});child.on('error',reject);child.on('close',code => resolve({code,stderr}));});
let first;let second;
try {
  run(`insert into members(id,name,phone,fellowship,is_active) values('${id}','${tag}','','Mega',true)`);
  first=spawn(psql,args);
  const firstDone=done(first);
  let readyResolve; const ready=new Promise(resolve => {readyResolve=resolve;});let output='';
  first.stdout.on('data',chunk => {output+=chunk;if(output.includes('PROJECTION_READY'))readyResolve();});
  first.stdin.write(`begin;\n${command}\nselect 'PROJECTION_READY';\n`);
  await Promise.race([ready,firstDone.then(result => {throw new Error(`First save exited early: ${result.stderr}`);})]);
  second=spawn(psql,[...args,'-c',command],{env:{...process.env,PGAPPNAME:tag}});
  const secondDone=done(second);
  let waiting=false;
  for(let attempt=0;attempt<50;attempt++) {
    waiting=run(`select exists(select 1 from pg_stat_activity where application_name='${tag}' and wait_event='advisory')`)==='t';
    if(waiting)break;
    await new Promise(resolve => setTimeout(resolve,50));
  }
  assert.ok(waiting,'Competing saves must serialize even before a projection header exists');
  first.stdin.end('commit;\n');assert.equal((await firstDone).code,0);
  const rejected=await secondDone;assert.notEqual(rejected.code,0);assert.match(rejected.stderr,/Another leader updated/);
  assert.equal(run(`select revision from fellowship_sunday_projections where service_date='${sunday}' and fellowship='Mega'`),'1');
  assert.equal(run(`select jsonb_array_length(projected_guests) from fellowship_sunday_projections where service_date='${sunday}' and fellowship='Mega'`),'1');
  console.log('PASS: concurrent first saves serialize, and the stale writer cannot overwrite the forecast.');
} finally {
  first?.kill('SIGTERM');second?.kill('SIGTERM');
  run(`delete from fellowship_sunday_projections where service_date='${sunday}' and fellowship='Mega' and updated_by='${tag}'; delete from members where id='${id}';`);
}
