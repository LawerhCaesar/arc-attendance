import assert from 'node:assert/strict';
import test from 'node:test';
import { loginLookup, validateAccountEmail } from '../lib/account-email';

test('account email normalization and validation preserve a unique sign-in address', () => {
  assert.equal(validateAccountEmail('  Ama.Owusu+arc@EXAMPLE.COM '), 'ama.owusu+arc@example.com');
  for (const value of [null, undefined, '', '   ']) assert.equal(validateAccountEmail(value), null);
  for (const value of [null, '', 'invalid', 'a@@example.com', 'a\nb@example.com', 123, `${'a'.repeat(65)}@example.com`]) {
    assert.throws(() => validateAccountEmail(value, true));
  }
});

test('email sign-in selects one exact email field and usernames keep their lookup', () => {
  assert.deepEqual(loginLookup(' AMa@Example.com '), { field: 'email', value: 'ama@example.com' });
  assert.deepEqual(loginLookup(' Ama.Owusu '), { field: 'username', value: 'ama.owusu' });
});
