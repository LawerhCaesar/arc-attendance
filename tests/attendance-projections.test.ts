import assert from 'node:assert/strict';
import test from 'node:test';
import { compareSundayProjection,parseProjectionGuests,projectionLocked,projectionSunday,upcomingSunday,type SundayProjection } from '../lib/attendance-projections';
import type { AttendanceRecord,Member } from '../lib/database';
const member=(values:Partial<Member>={}):Member => ({id:'a',name:'Ama Boateng',phone:'0201234567',fellowship:'Shalach',is_active:true,birthday:'',location:'',designation:'Member',...values});
const row=(values:Partial<AttendanceRecord>={}):AttendanceRecord => ({id:'r1',member_id:'a',name:'Ama Boateng',phone:'0201234567',fellowship:'Shalach',date:'2026-10-20',attendanceDate:'2026-10-18',attendanceStatus:'present',birthday:'',location:'',firstTimer:'No',...values});
const plan:SundayProjection={service_date:'2026-10-18',fellowship:'Shalach',projected_member_ids:['a','b','archived'],revision:1,submitted_at:'2026-10-17T10:00:00Z',updated_at:'2026-10-17T10:00:00Z',updated_by:'leader'};
test('projection editability locks exactly at Sunday 9 a.m. Ghana time',() => {
  assert.equal(projectionLocked('2026-10-18',new Date('2026-10-18T08:59:59.999Z')),false);
  assert.equal(projectionLocked('2026-10-18',new Date('2026-10-18T09:00:00Z')),true);
  assert.equal(projectionLocked('2026-10-18',new Date('2026-10-19T08:00:00Z')),true);
  const result=compareSundayProjection([member()],[row()],plan,'Shalach','2026-10-18','2026-10-18',new Date('2026-10-18T10:00:00Z'));
  assert.equal(result.locked,true);assert.equal(result.actual,1);
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
  assert.ok(!result.people.some(person => person.id==='foreign'));
});
const guest={id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',name:'Esi Visitor',phone:'+233551234567'};
test('first-time visitors count toward projections and match a unique normalized phone without double counting arrivals',()=>{
  const result=compareSundayProjection([member()],[row(),row({id:'visitor',member_id:null,name:'Esi Mensah',phone:'0551234567'})],{...plan,projected_member_ids:['a'],projected_guests:[guest]},'Shalach','2026-10-18','2026-10-20');
  assert.equal(result.projected,2);assert.equal(result.actual,2);assert.equal(result.projectedCame,2);assert.equal(result.unprojectedCame,0);
  assert.equal(result.people.filter(person=>person.guestId===guest.id).length,1);
});
test('a visitor subsequently added to the roster is counted only once and can retain their saved projection',()=>{
  const result=compareSundayProjection([member({phone:'0551234567'})],[row({phone:'0551234567'})],{...plan,projected_guests:[guest]},'Shalach','2026-10-18','2026-10-20');
  assert.equal(result.projected,1);assert.equal(result.actual,1);assert.equal(result.projectedCame,1);
});
test('a projected visitor who has since been archived is excluded from the calculations',()=>{
  const result=compareSundayProjection([member({phone:'0551234567',is_active:false})],[],{...plan,projected_guests:[guest]},'Shalach','2026-10-18','2026-10-20');
  assert.equal(result.projected,0);assert.equal(result.people.length,0);
});
test('name-only visitors match unique full names but conflicting phones and ambiguous names require review',()=>{
  const result=compareSundayProjection([], [row({member_id:null,name:'Visitor Esi',phone:''})],{...plan,projected_guests:[{...guest,phone:''}]},'Shalach','2026-10-18','2026-10-20');
  assert.equal(result.projectedCame,1);
  const conflict=compareSundayProjection([], [row({member_id:null,name:guest.name,phone:'0241234567'})],{...plan,projected_guests:[guest]},'Shalach','2026-10-18','2026-10-20');
  assert.equal(conflict.projectedCame,0);assert.equal(conflict.unprojectedCame,1);
  const ambiguous=compareSundayProjection([], [row({member_id:null,name:guest.name,phone:'0241234567'}),row({id:'other',member_id:null,name:guest.name,phone:'0271234567'})],{...plan,projected_guests:[{...guest,phone:''}]},'Shalach','2026-10-18','2026-10-20');
  assert.equal(ambiguous.projectedCame,0);assert.equal(ambiguous.actual,2);
});
test('visitor input validates names, identifiers and optional phones and rejects normalized duplicate contacts',()=>{
  assert.equal(parseProjectionGuests([{...guest,phone:'0551234567'}])[0].phone,'+233551234567');
  assert.throws(()=>parseProjectionGuests([{...guest,name:' '} ]));
  assert.throws(()=>parseProjectionGuests([{...guest,phone:'bad'}]));
  assert.throws(()=>parseProjectionGuests([guest,{...guest,id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',phone:'0551234567'}]));
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
