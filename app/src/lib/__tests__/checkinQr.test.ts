import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkinPayload, parseCheckin } from '../checkinQr.ts';

const crew = '13723d22-9a3a-4164-96cd-39d26b8312bb';

test('ida e volta do QR', () => {
  const qr = checkinPayload(crew, 'user_2abcDEF');
  assert.deepEqual(parseCheckin(qr), { crewId: crew, userId: 'user_2abcDEF' });
});

test('QR de outra coisa não vale', () => {
  assert.equal(parseCheckin('https://site.com'), null);
  assert.equal(parseCheckin(`marchagps:checkin:v1:${crew}:../x`), null);
  assert.equal(parseCheckin(`marchagps:checkin:v1:nao-e-uuid:user_1`), null);
  assert.throws(() => checkinPayload('x', 'user_1'));
});
