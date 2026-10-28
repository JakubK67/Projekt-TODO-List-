import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, SessionClient, type DeviceLogin } from '../src/services/session.ts';

const config = { apiUrl: 'http://192.168.1.9:3000', issuer: 'http://192.168.1.9:8081/realms/todo-app', clientId: 'todo-mobile' };
const user = { sub: 'owner', username: 'first' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const tokens = (access = 'access', expires = 300) => ({ access_token: access, refresh_token: 'refresh', expires_in: expires });
const device: DeviceLogin = { deviceCode: 'private-device-code', userCode: 'ABCD-EFGH',
  verificationUrl: `${config.issuer}/device?user_code=ABCD-EFGH`, expiresAt: Date.now() + 600000, interval: 5000 };

function fixture(responses: (Response | Error | Promise<Response>)[], initial: string | null = null) {
  let saved = initial;
  const calls: { url: string; options?: RequestInit }[] = [];
  const delays: number[] = [];
  const request: typeof fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    const value = responses.shift();
    if (!value) throw new Error('Unexpected HTTP request');
    if (value instanceof Error) throw value;
    return value;
  };
  const client = new SessionClient(config, {
    get: async () => saved, set: async value => { saved = value; }, remove: async () => { saved = null; },
  }, request, async (milliseconds, signal) => { if (signal?.aborted) throw new Error('Aborted'); delays.push(milliseconds); });
  return { client, calls, delays, saved: () => saved };
}

test('device login sends the mobile client and encodes the verification code', async () => {
  const f = fixture([reply({ device_code: 'secret', user_code: 'CODE', verification_uri: `${config.issuer}/device`, expires_in: 600, interval: 1 })]);
  const login = await f.client.beginLogin();
  assert.equal(login.interval, 5000);
  assert.equal(new URL(login.verificationUrl).searchParams.get('user_code'), 'CODE');
  const body = new URLSearchParams(String(f.calls[0].options?.body));
  assert.equal(body.get('client_id'), 'todo-mobile');
  assert.equal(body.has('password'), false);
  assert.equal(f.saved(), null);
});

test('device login rejects verification URLs outside the configured Keycloak', async () => {
  const f = fixture([reply({ device_code: 'secret', user_code: 'CODE', verification_uri: 'https://evil.test/', expires_in: 600 })]);
  await assert.rejects(f.client.beginLogin(), /adres logowania/);
});

test('polling respects authorization_pending and increases the interval on slow_down', async () => {
  const f = fixture([reply({ error: 'authorization_pending' }, 400), reply({ error: 'slow_down' }, 400), reply(tokens()), reply(user)]);
  assert.deepEqual(await f.client.finishLogin(device), user);
  assert.deepEqual(f.delays, [5000, 5000, 10000]);
  assert.equal(f.calls.at(-1)?.options?.credentials, 'omit');
  assert.equal(new Headers(f.calls.at(-1)?.options?.headers).get('Authorization'), 'Bearer access');
  assert.ok(f.saved()?.includes('refresh'));
});

test('cancelling login stops polling and does not persist tokens', async () => {
  const f = fixture([]);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(f.client.finishLogin(device, controller.signal));
  assert.equal(f.calls.length, 0);
  assert.equal(f.saved(), null);
});

test('unconfirmed OTP and denied device authorization cannot create a session', async () => {
  const f = fixture([reply(tokens()), reply({ error: 'MFA' }, 403)]);
  await assert.rejects(f.client.finishLogin(device), (error: unknown) => error instanceof ApiError && error.status === 403);
  assert.equal(f.saved(), null);
  const denied = fixture([reply({ error: 'access_denied' }, 400)]);
  await assert.rejects(denied.client.finishLogin(device), /zatwierdzono/);
});

test('restoring an expired session refreshes the token before loading the user', async () => {
  const f = fixture([reply(tokens('renewed')), reply(user)], JSON.stringify({ ...config, accessToken: 'old', refreshToken: 'refresh', expiresAt: 0 }));
  assert.deepEqual(await f.client.restore(), user);
  assert.equal(new URLSearchParams(String(f.calls[0].options?.body)).get('grant_type'), 'refresh_token');
  assert.equal(new Headers(f.calls[1].options?.headers).get('Authorization'), 'Bearer renewed');
});

test('tokens stored for a different server are removed without an HTTP request', async () => {
  const f = fixture([], JSON.stringify({ ...config, issuer: 'https://another.test', accessToken: 'old', refreshToken: 'refresh', expiresAt: 0 }));
  assert.equal(await f.client.restore(), null);
  assert.equal(f.calls.length, 0);
  assert.equal(f.saved(), null);
});

test('parallel API reads share a single token refresh', async () => {
  const f = fixture([reply(tokens('old', 1)), reply(user), reply(tokens('new')), reply([{ id: 1 }]), reply([{ id: 2 }])]);
  await f.client.finishLogin(device);
  const result = await Promise.all([f.client.api('/api/tasks'), f.client.api('/api/tasks')]);
  assert.deepEqual(result, [[{ id: 1 }], [{ id: 2 }]]);
  assert.equal(f.calls.filter(call => new URLSearchParams(String(call.options?.body)).get('grant_type') === 'refresh_token').length, 1);
});

test('logout cannot be undone by an in-flight refresh', async () => {
  let complete!: (response: Response) => void;
  const pending = new Promise<Response>(resolve => { complete = resolve; });
  const f = fixture([reply(tokens('old', 1)), reply(user), pending, reply({})]);
  await f.client.finishLogin(device);
  const api = f.client.api('/api/tasks');
  await Promise.resolve();
  await f.client.logout();
  complete(reply(tokens('new')));
  await assert.rejects(api);
  assert.equal(f.saved(), null);
});

test('a repeated 401 clears the session and does not retry indefinitely', async () => {
  const f = fixture([reply(tokens()), reply(user), reply({}, 401), reply(tokens('new')), reply({}, 401)]);
  let expired = 0; f.client.onExpired = () => expired++;
  await f.client.finishLogin(device);
  await assert.rejects(f.client.api('/api/tasks'), (error: unknown) => error instanceof ApiError && error.status === 401);
  assert.equal(expired, 1);
  assert.equal(f.calls.filter(call => call.url.endsWith('/api/tasks')).length, 2);
  assert.equal(f.saved(), null);
});

test('a network error while refreshing does not delete a valid stored session', async () => {
  const f = fixture([reply(tokens('old', 1)), reply(user), new Error('Offline')]);
  await f.client.finishLogin(device);
  await assert.rejects(f.client.api('/api/tasks'), /połączyć/);
  assert.ok(f.saved());
});
