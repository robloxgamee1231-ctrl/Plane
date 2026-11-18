import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { createApi } from '../server/api.mjs';
let dir, api, server, url, cookie, ownerCookie;
const state = {
  config: { aircraft: 'vela', map: 'coast' },
  settings: { quality: 'Low' },
  scenarios: [{ name: 'Saved coastal setup' }],
  log: [],
};
const post = (path, b, c = '', extra = {}) =>
  fetch(url + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: c, ...extra },
    body: JSON.stringify(b),
  });
const get = (path, c = '') => fetch(url + path, { headers: { cookie: c } });
const creds = { name: 'test-pilot', password: 'correct-demo-pass-42' };
before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'ndx-api-'));
  api = createApi(dir);
  server = createServer(api);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  url = 'http://127.0.0.1:' + server.address().port + '/api/';
});
after(async () => {
  await new Promise((r) => server.close(r));
  api.close();
  rmSync(dir, { force: true, recursive: true });
});
test('guest profile and health without personal data', async () => {
  assert.equal((await (await get('health')).json()).status, 'online');
  assert.deepEqual(await (await get('me')).json(), { user: null, state: null });
});
test('register, keep password private, and use HttpOnly sessions', async () => {
  const r = await post('register', creds);
  assert.equal(r.status, 200);
  const sc = r.headers.get('set-cookie');
  assert.match(sc, /HttpOnly/);
  assert.match(sc, /SameSite=Lax/);
  cookie = sc.split(';')[0];
  assert.deepEqual((await r.json()).user, { name: 'test-pilot', role: 'pilot' });
  assert.equal((await post('register', creds)).status, 409);
});
test('session-bound cloud save and account isolation', async () => {
  assert.equal((await post('save', state)).status, 401);
  assert.equal((await post('save', state, cookie)).status, 200);
  const read = await (await get('me', cookie)).json();
  assert.deepEqual(read.state, state);
  assert.equal((await get('admin', cookie)).status, 403);
  assert.equal(
    (await post('save', { ...state, config: { aircraft: 'unknown', map: 'coast' } }, cookie)).status,
    400,
  );
});
test('owner bootstrap is unique, protected and cannot be registered', async () => {
  const pass =
    process.env.NDX_OWNER_PASSWORD || readFileSync(join(dir, 'owner-bootstrap.txt'), 'utf8').trim();
  assert.ok(pass.length >= 16);
  if (!process.env.NDX_OWNER_PASSWORD)
    assert.equal(statSync(join(dir, 'owner-bootstrap.txt')).mode & 0o077, 0);
  assert.equal((await post('register', { name: 'ndx', password: 'not-a-real-password' })).status, 409);
  const r = await post('login', { name: 'NDX', password: pass });
  assert.equal(r.status, 200);
  ownerCookie = r.headers.get('set-cookie').split(';')[0];
  const admin = await (await get('admin', ownerCookie)).json();
  assert.equal(admin.pilots.length, 2);
  assert.ok(admin.pilots.every((p) => !('pass' in p) && !('salt' in p)));
});
test('reject incorrect password and cross-site mutations', async () => {
  assert.equal((await post('login', { ...creds, password: 'wrong-password' })).status, 401);
  assert.equal((await post('save', state, cookie, { 'sec-fetch-site': 'cross-site' })).status, 403);
});
test('logout invalidates session and a new login restores persistent state', async () => {
  assert.equal((await post('logout', {}, cookie)).status, 200);
  assert.equal((await (await get('me', cookie)).json()).user, null);
  const login = await post('login', creds);
  assert.equal(login.status, 200);
  assert.deepEqual((await login.json()).state, state);
});
test('only an owner can revoke a non-owner pilot session', async () => {
  const sign = await post('login', creds),
    cc = sign.headers.get('set-cookie').split(';')[0];
  assert.equal((await post('admin/revoke', { pilot: creds.name }, cc)).status, 403);
  assert.equal((await post('admin/revoke', { pilot: 'NDX' }, ownerCookie)).status, 400);
  const r = await post('admin/revoke', { pilot: creds.name }, ownerCookie);
  assert.equal(r.status, 200);
  assert.ok((await r.json()).revoked > 0);
  assert.equal((await (await get('me', cc)).json()).user, null);
});
