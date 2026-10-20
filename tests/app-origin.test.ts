import assert from 'node:assert/strict';
import test from 'node:test';
import { appOrigin } from '../lib/app-origin';

test('malformed deployment URLs keep integration setup and OAuth on the request origin', () => {
  const origin = 'https://arcattendance.vercel.app';
  for (const configured of ['http://localhost:3000, arcattendance.vercel.app', 'arcattendance.vercel.app', '', 'javascript:alert(1)', 'https://user:password@example.com']) {
    assert.equal(appOrigin(origin, configured), origin);
  }
});

test('a valid configured origin is consistent across callback links and redirects', () => {
  assert.equal(appOrigin('https://preview.vercel.app', ' https://arcattendance.vercel.app/admin '), 'https://arcattendance.vercel.app');
  assert.equal(appOrigin('http://localhost:3005', 'http://localhost:3000'), 'http://localhost:3000');
});
