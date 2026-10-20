import assert from 'node:assert/strict';
import test from 'node:test';
import { encryptSettings,decryptSettings } from '../lib/integration-settings';
import { photoMime } from '../lib/drive-photos';
import { accountPhotoSubject } from '../lib/profile-photos';
import { validateAccountPhone } from '../lib/account-phone';

process.env.ADMIN_SESSION_SECRET='synthetic-key-for-integration-tests';
test('integration encryption authenticates the provider and hides stored credentials',()=>{
 const encrypted=encryptSettings('sms_online_gh',{apiKey:'private-fixture-key'});
 assert.ok(!encrypted.includes('private-fixture-key'));
 assert.deepEqual(decryptSettings('sms_online_gh',encrypted),{apiKey:'private-fixture-key'});
 assert.throws(()=>decryptSettings('google_drive',encrypted));
 const parts=encrypted.split('.');parts[3]=(parts[3][0]==='A'?'B':'A')+parts[3].slice(1);
 assert.throws(()=>decryptSettings('sms_online_gh',parts.join('.')));
});
test('photo identity survives conversion and renaming of configured accounts',()=>{
 assert.equal(accountPhotoSubject({username:'base-admin',role:'admin',permissions:[]}),accountPhotoSubject({username:'renamed',accountId:'managed',configuredUsername:'base-admin',role:'admin',permissions:[]}));
 assert.equal(accountPhotoSubject({username:'leader',accountId:'own',role:'fellowship_leader',permissions:[]}), 'account:own');
});
test('photo validation rejects SVG, HTML and unsupported binary formats',()=>{
 assert.equal(photoMime(Buffer.from('<svg onload="alert(1)"/>')),null);
 assert.equal(photoMime(Buffer.from('<html>not an image</html>')),null);
 assert.equal(photoMime(Buffer.from([137,80,78,71,13,10,26,10])), 'image/png');
 assert.equal(photoMime(Buffer.from([255,216,255,224])), 'image/jpeg');
 assert.equal(photoMime(Buffer.from('RIFFxxxxWEBP')), 'image/webp');
});
test('SMS profile numbers normalize Ghana formats and preserve other country codes',()=>{
 assert.equal(validateAccountPhone('0201234567'),'+233201234567');
 assert.equal(validateAccountPhone('+44 20 1234 5678'),'+442012345678');
 assert.equal(validateAccountPhone(''),null);
 assert.throws(()=>validateAccountPhone('not a phone'));
});
