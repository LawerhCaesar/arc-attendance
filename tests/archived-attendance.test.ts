import assert from 'node:assert/strict';
import test from 'node:test';
import { excludeArchivedAttendance, type ReportingMember } from '../lib/archived-attendance';
const member:ReportingMember = {id:'a',name:'Ama Boateng',phone:'0201234567',fellowship:'Shalach',is_active:false};
const row = {member_id:null as string | null,name:'Ama Boateng',phone:'+233 20 123 4567',fellowship:'Shalach'};
test('linked and legacy archived attendance is hidden while storage and restored attendance remain intact',() => {
  const rows=[row,{...row,member_id:'a'}];
  assert.deepEqual(excludeArchivedAttendance(rows,[member]),[]);
  assert.equal(rows.length,2);
  assert.deepEqual(excludeArchivedAttendance(rows,[{...member,is_active:true}]),rows);
});
test('active people sharing a legacy contact are not hidden by another archived member',() => {
  const active={...member,id:'b',name:'Kojo Owusu',is_active:true};
  const rows=[row,{...row,name:'Kojo Owusu'},{...row,member_id:'b'}];
  assert.deepEqual(excludeArchivedAttendance(rows,[member,active]),rows.slice(1));
});
test('merged aliases follow the primary status and unknown visitors stay visible',() => {
  const alias={...member,id:'alias',merged_into_id:'a'};
  const rows=[{...row,member_id:'alias'},{...row,name:'Visitor',phone:'',member_id:null}];
  assert.equal(excludeArchivedAttendance(rows,[member,alias]).length,1);
  assert.equal(excludeArchivedAttendance(rows,[{...member,is_active:true},alias]).length,2);
});
