import assert from 'node:assert/strict';
import test from 'node:test';
import { compareSundayProjection,projectionLocked,projectionSunday,upcomingSunday,type SundayProjection } from '../lib/attendance-projections';
import type { AttendanceRecord,Member } from '../lib/database';
const member=(values:Partial<Member>={}):Member => ({id:'a',name:'Ama Boateng',phone:'0201234567',fellowship:'Shalach',is_active:true,birthday:'',location:'',designation:'Member',...values});
const row=(values:Partial<AttendanceRecord>={}):AttendanceRecord => ({id:'r1',member_id:'a',name:'Ama Boateng',phone:'0201234567',fellowship:'Shalach',date:'2026-10-20',attendanceDate:'2026-10-18',attendanceStatus:'present',birthday:'',location:'',firstTimer:'No',...values});
const plan:SundayProjection={service_date:'2026-10-18',fellowship:'Shalach',projected_member_ids:['a','b','archived'],revision:1,submitted_at:'2026-10-17T10:00:00Z',updated_at:'2026-10-17T10:00:00Z',updated_by:'leader'};
test('projection editability locks exactly at Sunday noon Ghana time, including after attendance starts',() => {
  assert.equal(projectionLocked('2026-10-18',new Date('2026-10-18T11:59:59.999Z')),false);
  assert.equal(projectionLocked('2026-10-18',new Date('2026-10-18T12:00:00Z')),true);
  assert.equal(projectionLocked('2026-10-18',new Date('2026-10-19T08:00:00Z')),true);
  const result=compareSundayProjection([member()],[row()],plan,'Shalach','2026-10-18','2026-10-18',new Date('2026-10-18T10:00:00Z'));
  assert.equal(result.locked,false);assert.equal(result.actual,1);
});
test('Sunday dates use Ghana calendar boundaries and reject other days',() => {
  assert.equal(upcomingSunday('2026-10-20'),'2026-10-25');
  assert.equal(upcomingSunday('2026-10-25'),'2026-10-25');
  assert.equal(upcomingSunday('2026-12-31'),'2027-01-03');
  assert.equal(projectionSunday('2026-10-25'),'2026-10-25');
  assert.throws(() => projectionSunday('2026-10-24'));assert.throws(() => projectionSunday('2026-02-30'));
});
test('comparison separates projected arrivals, projected without a present record and unexpected visitors without duplicate counts',() => {
  const members=[member(),member({id:'b',name:'Kojo Owusu',phone:'0271234567'}),member({id:'archived',name:'Archived',phone:'',is_active:false})];
  const result=compareSundayProjection(members,[row(),row({id:'overlap',attendanceStatus:'absent'}),row({id:'visitor',member_id:null,name:'Esi Visitor',phone:'0551234567'}),row({id:'old',member_id:'archived',name:'Archived',phone:''}),row({id:'foreign',fellowship:'Pleroma'})],plan,'Shalach','2026-10-18','2026-10-20');
  assert.equal(result.projected,2);assert.equal(result.actual,2);assert.equal(result.projectedCame,1);assert.equal(result.projectedNotPresent,1);assert.equal(result.unprojectedCame,1);
  assert.equal(result.people.find(person => person.id==='b')?.actual,'not_recorded');
  assert.ok(!result.people.some(person => person.id==='archived'));
  assert.ok(!JSON.stringify(result).includes('0551234567'));
});
test('a missing plan is distinct from a deliberately saved zero projection',() => {
  const missing=compareSundayProjection([member()],[row()],null,'Shalach','2026-10-18','2026-10-20');
  const zero=compareSundayProjection([member()],[row()],{...plan,projected_member_ids:[]},'Shalach','2026-10-18','2026-10-20');
  assert.equal(missing.submitted,false);assert.equal(missing.projected,null);assert.equal(missing.unprojectedCame,null);
  assert.equal(zero.submitted,true);assert.equal(zero.projected,0);assert.equal(zero.unprojectedCame,1);
});
test('future attendance is not claimed as an actual arrival before the service day',() => {
  const result=compareSundayProjection([member()],[row({attendanceDate:'2026-10-25'})],{...plan,service_date:'2026-10-25'},'Shalach','2026-10-25','2026-10-20');
  assert.equal(result.actual,0);
});
