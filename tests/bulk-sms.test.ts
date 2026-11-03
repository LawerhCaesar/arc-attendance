import assert from 'node:assert/strict';
import test from 'node:test';
import { SMS_PREVIEW_TTL_MS, bulkSmsRecipients, smsCampaignStatusDetail, smsCampaignStatusLabel, smsDraftIssue, smsMessageInfo, smsPreviewExpired, smsReviewRecipients, standardSmsPunctuation, validateSmsMessage, type BulkSmsCampaign } from '../lib/bulk-sms';
import { fetchSmsBalance, submitBulkSms } from '../lib/bulk-sms-provider';

test('a mostly accepted campaign shows submission success with a specific unconfirmed count', () => {
  const campaign: Pick<BulkSmsCampaign, 'status' | 'created_at' | 'accepted' | 'uncertain' | 'rejected' | 'next_offset' | 'recipient_count'> = {
    status: 'uncertain', created_at: '2026-11-03T09:28:33Z', accepted: 212, uncertain: 1, rejected: 0, next_offset: 213, recipient_count: 213,
  };
  assert.equal(smsCampaignStatusLabel(campaign), 'Submitted — 1 unconfirmed');
  assert.match(smsCampaignStatusDetail(campaign)!, /212 of 213 numbers were accepted/);
  assert.match(smsCampaignStatusDetail(campaign)!, /Only 1 submission is unconfirmed/);
  assert.match(smsCampaignStatusDetail(campaign)!, /do not resend the entire message/);
  assert.equal(smsCampaignStatusLabel({ ...campaign, accepted: 0, uncertain: 213 }), 'Submission unconfirmed');
  assert.equal(smsCampaignStatusLabel({ ...campaign, accepted: 12, next_offset: 13 }), 'Partly submitted — 1 unconfirmed');
  assert.match(smsCampaignStatusDetail({ ...campaign, accepted: 12, next_offset: 13 })!, /200 numbers have not been processed/);
  assert.equal(smsCampaignStatusLabel({ ...campaign, status: 'completed', accepted: 213, uncertain: 0 }), 'Submitted');
  assert.equal(smsCampaignStatusLabel({ ...campaign, status: 'completed', accepted: 212, uncertain: 0, rejected: 1 }), 'Submitted — 1 rejected');
  assert.equal(smsCampaignStatusLabel({ ...campaign, status: 'completed', accepted: 0, uncertain: 0, rejected: 213 }), 'None accepted');
});

test('recipient review identifies only unconfirmed or rejected people and excludes provider identifiers', () => {
  const recipients = [
    { memberId: 'a', name: 'Test Accepted', fellowship: 'Shalach', phone: '+233201234567' },
    { memberId: 'b', name: 'Test Unconfirmed', fellowship: 'Pleroma', phone: '+233241234567' },
    { memberId: 'c', name: 'Test Rejected', fellowship: 'Pleroma', phone: '+233271234567' },
  ];
  assert.deepEqual(smsReviewRecipients(recipients, [
    { phone: recipients[0].phone, status: 'accepted', messageId: 'private-provider-id' },
    { phone: recipients[1].phone, status: 'uncertain', messageId: 'private-unconfirmed-id' },
    { phone: recipients[2].phone, status: 'rejected' },
  ]), [
    { name: 'Test Unconfirmed', fellowship: 'Pleroma', phone: '+233241234567', status: 'uncertain' },
    { name: 'Test Rejected', fellowship: 'Pleroma', phone: '+233271234567', status: 'rejected' },
  ]);
});

test('drafts expire at 15 minutes and give a specific refresh reason before submission', () => {
  const created = Date.parse('2026-11-03T08:56:10Z');
  const recipients = [{ memberId: 'a', phone: '+233201234567', name: 'Test member', fellowship: 'Shalach' }];
  const draft = { created_at: new Date(created).toISOString(), sender: 'CEYC ARC', recipients };
  assert.equal(smsPreviewExpired(draft.created_at, created + SMS_PREVIEW_TTL_MS - 1), false);
  assert.equal(smsPreviewExpired(draft.created_at, created + SMS_PREVIEW_TTL_MS), true);
  assert.equal(smsDraftIssue(draft, recipients, draft.sender, created + 29 * 60000)?.code, 'PREVIEW_EXPIRED');
  assert.equal(smsDraftIssue(draft, recipients, draft.sender, created + 60000), null);
  assert.equal(smsDraftIssue(draft, recipients, 'NEW SENDER', created + 60000)?.code, 'SMS_SETTINGS_CHANGED');
  assert.equal(smsDraftIssue(draft, [], draft.sender, created + 60000)?.code, 'AUDIENCE_CHANGED');
  assert.equal(smsDraftIssue(draft, [{ ...recipients[0], phone: '+233241234567' }], draft.sender, created + 60000)?.code, 'AUDIENCE_CHANGED');
  assert.equal(smsPreviewExpired('invalid', created), true);
  const refreshed = { ...draft, created_at: new Date(created + 29 * 60000).toISOString() };
  assert.equal(smsDraftIssue(refreshed, recipients, refreshed.sender, created + 30 * 60000), null);
});

test('draft recipient checks ignore ordering and display-only name changes', () => {
  const recipients = [
    { memberId: 'a', phone: '+233201234567', name: 'Test A', fellowship: 'Shalach' },
    { memberId: 'b', phone: '+233241234567', name: 'Test B', fellowship: 'Shalach' },
  ];
  const now = Date.parse('2026-11-03T09:00:00Z');
  const draft = { created_at: new Date(now).toISOString(), sender: 'CEYC ARC', recipients };
  assert.equal(smsDraftIssue(draft, [...recipients].reverse().map(r => ({ ...r, name: 'Updated name' })), draft.sender, now), null);
});

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

test('standard punctuation avoids an unexpected jump from one standard SMS to three Unicode parts', () => {
  const ordinary = `Hello brethren, ${'a'.repeat(124)}`;
  assert.equal(ordinary.length, 140);
  assert.equal(smsMessageInfo(`${ordinary}'`).segments, 1);
  assert.equal(smsMessageInfo(`${ordinary}’`).segments, 3);
  const prepared = standardSmsPunctuation(`${ordinary}’`);
  assert.equal(prepared, `${ordinary}'`);
  assert.equal(smsMessageInfo(prepared).type, 0);
  assert.equal(smsMessageInfo(prepared).segments, 1);
  assert.equal(standardSmsPunctuation('“Welcome”—it’s Sunday…\u00a0Akwaaba ɛ 🎂'), '"Welcome"-it\'s Sunday... Akwaaba ɛ 🎂');
  assert.equal(standardSmsPunctuation('Gloire à Dieu! € ^ {} \\ [~] |'), 'Gloire à Dieu! € ^ {} \\ [~] |');
});

test('SMS counter exposes encoding reasons and respects full-character boundaries in multipart messages', () => {
  const single = smsMessageInfo('a'.repeat(160));
  assert.equal(single.remaining, 0);
  assert.equal(single.singleLimit, 160);
  assert.equal(smsMessageInfo('a'.repeat(161)).remaining, 145);
  assert.equal(smsMessageInfo('a'.repeat(306)).segments, 2);
  assert.equal(smsMessageInfo('a'.repeat(307)).segments, 3);
  // An extension escape or UTF-16 surrogate pair cannot straddle parts.
  assert.equal(smsMessageInfo('^'.repeat(153)).segments, 3);
  assert.equal(smsMessageInfo('🎂'.repeat(67)).segments, 3);
  assert.deepEqual(smsMessageInfo('ɛ ɛ🎂').unicodeCharacters, ['ɛ', '🎂']);
  assert.equal(smsMessageInfo('ɛ'.repeat(134)).segments, 2);
  assert.equal(smsMessageInfo('ɛ'.repeat(135)).segments, 3);
});

test('provider receives the exact prepared preview text and matching standard encoding', async () => {
  const original = globalThis.fetch;
  const message = validateSmsMessage(standardSmsPunctuation(`It’s Sunday! ${'a'.repeat(147)}`));
  assert.equal(message.length, 160);
  assert.equal(smsMessageInfo(message).segments, 1);
  try {
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(options!.body as string);
      assert.equal(body.text, message);
      assert.equal(body.type, 0);
      return Response.json({ handshake: { id: 0, label: 'HSHK_OK' }, data: { destinations: [
        { id: 'synthetic-id', to: '233201234567', status: { id: 2105, label: 'DS_SUBMIT_ENROUTE' } },
      ] } });
    };
    assert.equal((await submitBulkSms(['+233201234567'], message, { apiKey: 'synthetic', sender: 'CEYC ARC' }))[0].status, 'accepted');
  } finally { globalThis.fetch = original; }
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
