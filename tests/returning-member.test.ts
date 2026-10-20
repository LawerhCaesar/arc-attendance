import assert from 'node:assert/strict';
import test from 'node:test';
import { returningArchivedMember } from '../lib/returning-member';
import type { Member } from '../lib/database';

const member: Member = { id: 'a', name: 'Ama Boateng', phone: '0201234567', fellowship: 'Shalach', designation: 'Member', birthday: '', location: '', is_active: false };
test('returning archived members match their full name and normalized phone without making a new identity', () => {
  assert.equal(returningArchivedMember({ name: ' Boateng  AMA ', phone: '+233 20 123 4567', fellowship: 'Shalach' }, [member])?.id, 'a');
});
test('shared phone alone, different known phones and other fellowships cannot restore the wrong person', () => {
  for (const input of [{ ...member, name: 'Other Person' }, { ...member, phone: '0551234567' }, { ...member, fellowship: 'Pleroma' }]) {
    assert.equal(returningArchivedMember(input, [member]), null);
  }
});
test('phone-less check-ins can identify a unique full name in its fellowship', () => {
  assert.equal(returningArchivedMember({ ...member, phone: '' }, [member])?.id, 'a');
  assert.equal(returningArchivedMember({ ...member, phone: '', fellowship: '' }, [member]), null);
});
test('active and merged records are never considered archived identities', () => {
  assert.equal(returningArchivedMember(member, [{ ...member, is_active: true }, { ...member, merged_into_id: 'primary' }]), null);
});
test('ambiguous archived records require review instead of choosing a person', () => {
  assert.throws(() => returningArchivedMember(member, [member, { ...member, id: 'b' }]), { status: 409 });
});
