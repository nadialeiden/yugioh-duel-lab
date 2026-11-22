import {once} from 'node:events';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createLoginHandler} from '../server/login.js';
import {createGuestQuota} from '../server/guest-quota.js';
import {createSessionCodec, deviceCookie, sessionCookie, vercelIpHeader} from '../server/session.js';

test('guest passes enforce browser and IP quotas, require both cookies, and expire', async (t) => {
  let time = Date.UTC(2026, 0, 1, 12);
  const now = () => time;
  const codec = createSessionCodec('test-key', now);
  const server = createServer(createLoginHandler(codec, {hosted: true, now, quota: createGuestQuota()}));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const url = 'http://127.0.0.1:' + server.address().port;
  const ip = '192.0.2.10';
  const otherIp = '192.0.2.11';
  const pass = (address, cookie = '') => fetch(url, {
    method: 'POST', body: JSON.stringify({guest: true}),
    headers: {'Content-Type': 'application/json', [vercelIpHeader]: address, cookie},
  });
  const check = (address, cookie) => fetch(url, {headers: {[vercelIpHeader]: address, cookie}});

  const first = await pass(ip);
  assert.equal(first.status, 200);
  const {expires} = await first.json();
  assert.equal(expires - now(), 1800000);
  const cookies = first.headers.getSetCookie().map(value => value.split(';')[0]);
  const browser = cookies.join('; ');
  assert.equal((await check(ip, browser)).status, 200);
  assert.equal((await check(otherIp, browser)).status, 401);
  assert.equal((await check(ip, cookies.find(value => value.startsWith(sessionCookie + '=')))).status, 401);
  assert.equal((await check(ip, browser.replace(/duel_session=./, 'duel_session=!'))).status, 401);
  assert.equal((await pass(ip, browser)).status, 200);
  const device = cookies.find(value => value.startsWith(deviceCookie + '='));
  assert.equal((await pass(otherIp, device)).status, 429);
  assert.deepEqual((await Promise.all([pass(ip), pass(ip), pass(ip)])).map(response => response.status).sort(), [200, 200, 429]);
  assert.equal((await pass(otherIp)).status, 200);
  time = expires;
  assert.equal((await check(ip, browser)).status, 401);
  assert.equal((await pass(ip, device)).status, 429);
  time += 86400000;
  assert.equal((await pass(ip, device)).status, 200);
});
