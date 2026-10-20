import assert from 'node:assert/strict';
import test from 'node:test';
import { bulkSmsRecipients, smsMessageInfo, validateSmsMessage } from '../lib/bulk-sms';
import { fetchSmsBalance, submitBulkSms } from '../lib/bulk-sms-provider';

test('bulk audiences use active unmerged members, scope fellowships and deduplicate normalized contacts', () => {
  const members = [
    { id: 'a', name: 'Ama', fellowship: 'Shalach', phone: '0201234567' },
    { id: 'b', name: 'Same phone', fellowship: 'Pleroma', phone: '+233201234567' },
    { id: 'c', name: 'Archived', fellowship: 'Shalach', phone: '0241234567', is_active: false },
    { id: 'd', name: 'Merged', fellowship: 'Shalach', phone: '0241234567', merged_into_id: 'a' },
    { id: 'e', name: 'Missing', fellowship: 'Shalach', phone: 'invalid' },
    { id: 'f', name: 'International', fellowship: 'Pleroma', phone: '+442012345678' },
  ];
  const church = bulkSmsRecipients(members, null);
  assert.deepEqual(church.recipients.map(member => member.phone), ['+233201234567', '+442012345678']);
  assert.equal(church.missingPhone, 1); assert.equal(church.duplicatePhone, 1);
  assert.deepEqual(bulkSmsRecipients(members, 'Pleroma').recipients.map(member => member.memberId), ['b', 'f']);
});

test('SMS estimates account for GSM extensions, multipart boundaries and Unicode surrogate pairs', () => {
  assert.equal(smsMessageInfo('a'.repeat(160)).segments, 1);
  assert.equal(smsMessageInfo('a'.repeat(161)).segments, 2);
  assert.equal(smsMessageInfo('^'.repeat(80)).segments, 1);
  assert.equal(smsMessageInfo('^'.repeat(81)).segments, 2);
  assert.equal(smsMessageInfo('ɛ'.repeat(70)).type, 1);
  assert.equal(smsMessageInfo('ɛ'.repeat(71)).segments, 2);
  assert.equal(smsMessageInfo('🎂'.repeat(35)).segments, 1);
  assert.equal(smsMessageInfo('🎂'.repeat(36)).segments, 2);
  assert.equal(smsMessageInfo('').segments, 0);
  assert.equal(validateSmsMessage(' Hello brethren! '), 'Hello brethren!');
  for (const value of ['', ' ', 'a'.repeat(1601), '\u0000', 4]) assert.throws(() => validateSmsMessage(value));
});

test('provider submission preserves recipient-level rejection and uncertainty without retrying', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.smsonlinegh.com/v5/message/sms/send');
      const body = JSON.parse(options!.body as string);
      assert.equal(body.type, 1); assert.equal(body.sender, 'CEYC ARC');
      assert.deepEqual(body.destinations, ['233201234567','233241234567','233271234567']);
      return Response.json({ handshake: { id: 0, label: 'HSHK_OK' }, data: { destinations: [
        { id: 'accepted-id', to: '0201234567', status: { id: 2105, label: 'DS_SUBMIT_ENROUTE' } },
        { id: 'rejected-id', to: '233241234567', status: { id: 2121, label: 'DS_REJECTED_INSUFF_CREDIT' } },
      ] } });
    };
    assert.deepEqual(await submitBulkSms(['+233201234567','+233241234567','+233271234567'], 'Akwaaba ɛ', { apiKey: 'synthetic', sender: 'CEYC ARC' }), [
      { phone: '+233201234567', status: 'accepted', messageId: 'accepted-id' },
      { phone: '+233241234567', status: 'rejected' }, { phone: '+233271234567', status: 'uncertain' },
    ]);
    assert.equal(calls, 1);
    for (const response of [new Response('', { status: 500 }), Response.json({ handshake: { id: 0, label: 'HSHK_OK' }, data: {} })]) {
      globalThis.fetch = async () => response;
      assert.equal((await submitBulkSms(['+233201234567'], 'Hello', { apiKey: 'synthetic', sender: 'CEYC ARC' }))[0].status, 'uncertain');
    }
    globalThis.fetch = async () => { throw new Error('Timeout'); };
    assert.equal((await submitBulkSms(['+233201234567'], 'Hello', {}))[0].status, 'uncertain');
  } finally { globalThis.fetch = original; }
});

test('balance requests use header authentication and validate the provider response', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://api.smsonlinegh.com/v5/account/balance');
      assert.equal((options!.headers as Record<string,string>).Authorization, 'key synthetic');
      return Response.json({ handshake: { id: 0, label: 'HSHK_OK' }, data: { balance: 2432, model: 'quantity' } });
    };
    assert.deepEqual(await fetchSmsBalance({ apiKey: 'synthetic' }), { balance: 2432, model: 'quantity', currency: null });
    globalThis.fetch = async () => Response.json({ handshake: { id: 1 }, data: { balance: 2432, model: 'quantity' } });
    await assert.rejects(fetchSmsBalance({ apiKey: 'synthetic' }));
  } finally { globalThis.fetch = original; }
});
