import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { cellAttendanceBreakdown, matchesCellAttendance } from '../lib/cell-attendance';
import { fellowshipAttendanceReport, type HistoryMemberInput } from '../lib/fellowship-insights';
import { loadFellowshipStructure } from '../lib/fellowship-structure-source';

const structure = {
  cells: [{ id: 'cell2', fellowship: 'Shalach', number: 2, leader_member_id: null }, { id: 'cell1', fellowship: 'Shalach', number: 1, leader_member_id: 'a' }],
  bsctGroups: [{ id: 'bsct1', cell_id: 'cell1', number: 1, leader_member_id: 'a' }, { id: 'bsct2', cell_id: 'cell2', number: 1, leader_member_id: null }],
};
const member = (id: string, cell_id: string | null, bsct_group_id: string | null, extra: Partial<HistoryMemberInput> = {}): HistoryMemberInput =>
  ({ id, name: id, phone: '', fellowship: 'Shalach', is_active: true, cell_id, bsct_group_id, ...extra });
const roster = [member('a','cell1','bsct1'), member('b','cell1',null), member('c','cell2','bsct2'), member('d',null,null), member('zero','cell2',null),
  member('archived','cell1','bsct1',{is_active:false}), member('foreign','cell1','bsct1',{fellowship:'Pleroma'})];
const row = (member_id: string, date: string, attendanceStatus = 'present') => ({ member_id, date, name: member_id, phone: '', fellowship: 'Shalach', attendanceStatus });
const report = () => fellowshipAttendanceReport(roster, [row('a','2026-10-18'),row('a','2026-10-18','absent'),row('a','2026-10-18'),row('a','2026-10-25','absent'),
  row('b','2026-10-18'),row('c','2026-10-25'),row('d','2026-10-25'),row('archived','2026-10-25'),row('foreign','2026-10-25')], 'Shalach','2026-10-27');

test('cell and BSCT breakdowns count reconciled member/service attendance once, excluding archived and foreign brethren', () => {
  const data = report();
  const result = cellAttendanceBreakdown(data.members, structure);
  assert.deepEqual(result.cells.map(cell => cell.id), ['cell1','cell2']);
  const cell1 = result.cells[0];
  assert.equal(cell1.brethren,2); assert.equal(cell1.present,2); assert.equal(cell1.absent,1); assert.equal(cell1.services,2);
  assert.equal(cell1.groups[0].brethren,1); assert.equal(cell1.groups[0].present,1); assert.equal(cell1.groups[0].absent,1);
  assert.deepEqual(cell1.unassigned,{brethren:1,present:1,absent:0,services:1});
  assert.equal(result.cells[1].brethren,2); assert.equal(result.cells[1].present,1); assert.equal(result.cells[1].absent,0);
  assert.deepEqual(result.unassigned,{brethren:1,present:1,absent:0,services:1});
  assert.equal(result.cells.reduce((sum, cell) => sum + cell.brethren, result.unassigned.brethren), data.members.length);
});

test('cell/BSCT filters isolate groups, distinguish no-cell from no-BSCT, and reject mismatched group membership', () => {
  const members = report().members;
  const filter = (cell: string, bsct: string) => members.filter(member => matchesCellAttendance(member, structure, cell, bsct)).map(member => member.id);
  assert.deepEqual(filter('cell1','all'),['a','b']);
  assert.deepEqual(filter('cell1','bsct1'),['a']);
  assert.deepEqual(filter('unassigned','all'),['d']);
  assert.deepEqual(filter('all','unassigned'),['b','d','zero']);
  assert.deepEqual(filter('cell1','bsct2'),[]);
  assert.equal(matchesCellAttendance({...members[0],bsct_group_id:'bsct2'},structure,'cell1','bsct2'),false);
});

test('date-filtered totals preserve zero-history brethren and never infer absences', () => {
  const members = report().members.map(member => ({ ...member, history: member.history.filter(entry => entry.date === '2026-10-25') }));
  const result = cellAttendanceBreakdown(members, structure);
  assert.equal(result.cells[0].brethren,2); assert.equal(result.cells[0].present,0); assert.equal(result.cells[0].absent,1);
  assert.equal(result.cells[1].brethren,2); assert.equal(result.cells[1].present,1); assert.equal(result.cells[1].absent,0);
  const empty = cellAttendanceBreakdown(members.map(member => ({...member, history:[]})), structure);
  assert.ok(empty.cells.every(cell => cell.present === 0 && cell.absent === 0 && cell.services === 0));
});

test('structure reads only load BSCT groups belonging to cells in the permitted fellowship', async () => {
  const cells = [...structure.cells,{id:'foreign',fellowship:'Pleroma',number:1,leader_member_id:null}];
  const groups = [...structure.bsctGroups,{id:'foreign-bsct',cell_id:'foreign',number:1,leader_member_id:null}];
  const client = createClient('https://structure-fixture.supabase.co','synthetic-key',{auth:{persistSession:false},global:{fetch:async input => {
    const url = new URL(String(input));
    const result = url.pathname.endsWith('/fellowship_cells') ? cells.filter(cell => `eq.${cell.fellowship}` === url.searchParams.get('fellowship')) :
      groups.filter(group => url.searchParams.get('cell_id')?.slice(4,-1).split(',').includes(group.cell_id));
    return new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json'}});
  }}});
  const result = await loadFellowshipStructure(client,'Shalach');
  assert.deepEqual(result.cells.map(cell => cell.id).sort(),['cell1','cell2']);
  assert.deepEqual(result.bsctGroups.map(group => group.id).sort(),['bsct1','bsct2']);
});
