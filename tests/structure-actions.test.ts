import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStructureAssignment, parseStructureDeletion } from '../lib/structure-actions';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const leader = {role:'fellowship_leader',fellowship:'Shalach'};
const assignment = {fellowship:'Shalach',memberIds:[id(1),id(2),id(1)],cellId:id(3),bsctGroupId:id(4)};

test('bulk assignment validates identifiers, deduplicates the selection, and allows cell-only assignments', () => {
  assert.deepEqual(parseStructureAssignment(assignment,leader),{p_fellowship:'Shalach',p_member_ids:[id(1),id(2)],p_cell_id:id(3),p_bsct_group_id:id(4)});
  assert.equal(parseStructureAssignment({...assignment,bsctGroupId:null},leader).p_bsct_group_id,null);
  for (const body of [null,[],{...assignment,memberIds:[]},{...assignment,memberIds:[id(1),null]},
    {...assignment,memberIds:Array(1001).fill(id(1))},{...assignment,cellId:'wrong'},{...assignment,bsctGroupId:'wrong'}]) {
    assert.throws(() => parseStructureAssignment(body,leader),{status:400});
  }
});

test('bulk assignment and deletion never accept a foreign fellowship or an invalid leader account scope', () => {
  assert.throws(() => parseStructureAssignment({...assignment,fellowship:'Pleroma'},leader),{status:403});
  assert.throws(() => parseStructureDeletion({fellowship:'Pleroma',kind:'cell',id:id(3)},leader),{status:403});
  assert.throws(() => parseStructureAssignment(assignment,{role:'fellowship_leader'}),{status:403});
  assert.equal(parseStructureAssignment({...assignment,fellowship:'Pleroma'},{role:'admin'}).p_fellowship,'Pleroma');
});

test('deletions require one valid scoped cell or BSCT identifier and cannot delete members', () => {
  assert.deepEqual(parseStructureDeletion({fellowship:'Shalach',kind:'bsct',id:id(4)},leader),{p_fellowship:'Shalach',p_kind:'bsct',p_id:id(4)});
  for (const body of [null,[],{fellowship:'Shalach',kind:'member',id:id(1)},{fellowship:'Shalach',kind:'cell',id:'invalid'}]) {
    assert.throws(() => parseStructureDeletion(body,leader),{status:400});
  }
});
