import assert from 'node:assert/strict';
import test from 'node:test';
import { rosterAttendanceSummary } from '../lib/roster-attendance';
import type { HistoryAttendanceInput, HistoryMemberInput } from '../lib/fellowship-insights';

const dates=['2026-08-23','2026-08-30','2026-09-06','2026-09-13','2026-09-20','2026-09-27','2026-10-04','2026-10-11','2026-10-18'];
const member=(id:string,extra:Partial<HistoryMemberInput>={}):HistoryMemberInput=>({id,name:id,phone:'',fellowship:'Shalach',is_active:true,...extra});
const row=(id:string,date:string,extra:Partial<HistoryAttendanceInput>={}):HistoryAttendanceInput=>({id:`${id}-${date}`,member_id:id,name:id,phone:'',fellowship:'Shalach',date:'2026-10-20',attendanceDate:date,attendanceStatus:'present',...extra});
const calendar=dates.map(date=>row('calendar',date,{fellowship:'Pleroma'}));

test('roster colors use one common window of the last eight recorded services with exact 0, 1, 3, 4 and 8 boundaries',()=>{
  const members=['zero','one','three','four','eight'].map(id=>member(id));
  const rows=[row('one',dates[8]),...dates.slice(-3).map(date=>row('three',date)),...dates.slice(-4).map(date=>row('four',date)),...dates.map(date=>row('eight',date)),row('zero',dates[0])];
  const report=rosterAttendanceSummary(members,rows,calendar,'2026-10-20');
  assert.deepEqual(report.serviceDates,dates.slice(-8).reverse());
  assert.deepEqual(report.members,{zero:{attended:0,color:'red'},one:{attended:1,color:'yellow'},three:{attended:3,color:'yellow'},four:{attended:4,color:'green'},eight:{attended:8,color:'green'}});
});
test('overlaps, repeated saves and legacy contacts count one present attendance per service, with linked IDs authoritative',()=>{
  const members=[member('a',{name:'Ama Boateng',phone:'0201234567'}),member('other',{phone:'0271234567'})];
  const rows=[row('a',dates[8],{attendanceStatus:'absent'}),row('a',dates[8]),row('a',dates[8],{id:'duplicate'}),
    row('legacy',dates[7],{member_id:null,phone:'+233201234567',name:'Ama Boateng',attendanceStatus:''}),
    row('other',dates[6],{phone:'0201234567',name:'Ama Boateng'})];
  const report=rosterAttendanceSummary(members,rows,calendar,'2026-10-20');
  assert.equal(report.members.a.attended,2);assert.equal(report.members.other.attended,1);
});
test('future services, invalid dates, unknown statuses and submission dates never alter the service window',()=>{
  const extra=[row('a','2026-10-25'),row('a','2026-02-30'),row('a','2026-10-19',{attendanceStatus:'unknown'}),row('a','2026-10-20',{attendanceDate:'',date:'2026-02-30'})];
  const report=rosterAttendanceSummary([member('a')],[row('a',dates[8]),...extra],[...calendar,...extra],'2026-10-20');
  assert.deepEqual(report.serviceDates,dates.slice(-8).reverse());assert.equal(report.members.a.attended,1);
});
test('archived members are gray, merged aliases are excluded and foreign fellowship rows cannot inflate attendance',()=>{
  const report=rosterAttendanceSummary([member('a'),member('old',{is_active:false}),member('merged',{is_active:false,merged_into_id:'a'})],
    [row('old',dates[8]),row('a',dates[8],{fellowship:'Pleroma'})],calendar,'2026-10-20');
  assert.deepEqual(report.members.old,{attended:null,color:'archived'});assert.ok(!report.members.merged);assert.equal(report.members.a.color,'red');
});
test('missing service data is neutral, while fewer than eight available services show the actual denominator',()=>{
  assert.deepEqual(rosterAttendanceSummary([member('a')],[],[],'2026-10-20').members.a,{attended:null,color:'unavailable'});
  const rows=dates.slice(-3).map(date=>row('a',date));
  const report=rosterAttendanceSummary([member('a')],rows,rows,'2026-10-20');
  assert.equal(report.serviceDates.length,3);assert.deepEqual(report.members.a,{attended:3,color:'yellow'});
});
