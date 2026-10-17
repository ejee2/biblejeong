import test from 'node:test';
import assert from 'node:assert/strict';
import { BOOKS } from '../assets/bible-data.js';
import worker, { createLogosProxy } from '../server/logos-proxy.js';

const origin = 'https://ejee2.github.io';
const env = { LOGOS_API_KEY: 'server-only-test-key' };
const chapterPath = '/v1/books/gen/chapters/1';
const row = (verse = '1', text = '테스트 본문') => ({ verse, text });
const chapterResponse = (verses = [row()]) => Response.json(verses);
const request = (path = chapterPath, options = {}) => new Request(`https://relay.example${path}`, {
  ...options,
  headers: { Origin: origin, ...options.headers },
});

test('the default export is a Worker and health is public without requiring a key', async () => {
  assert.equal(typeof worker.fetch, 'function');
  const proxy = createLogosProxy({ fetchImpl: () => assert.fail('health must not contact Logos') });
  const response = await proxy.fetch(new Request('https://relay.example/health'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test('only validated chapter routes reach Logos', async () => {
  const proxy = createLogosProxy({ fetchImpl: () => assert.fail('invalid routes must not contact Logos') });
  for (const path of ['/', '/v1/books/unknown/chapters/1', '/v1/books/gen/chapters/0', '/v1/books/gen/chapters/51', '/v1/books/gen/chapters/01', '/v1/books/gen/chapters/1.5', '/v1/books/gen/chapters/1/extra', `${chapterPath}?url=https://untrusted.example`]) {
    const response = await proxy.fetch(request(path), env);
    assert.equal(response.status, 404, path);
  }
  const response = await proxy.fetch(request(chapterPath, { method: 'POST', body: 'ignored' }), env);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'GET, OPTIONS');
});

test('origin checks and preflight allow only the configured origin and GET', async () => {
  const proxy = createLogosProxy({ fetchImpl: () => assert.fail('preflight and forbidden origins must not contact Logos') });
  for (const headers of [{ Origin: 'https://attacker.example' }, { Origin: 'https://ejee2.github.io.attacker.example' }]) {
    const response = await proxy.fetch(request(chapterPath, { headers }), env);
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
  const missingOrigin = await proxy.fetch(new Request(`https://relay.example${chapterPath}`), env);
  assert.equal(missingOrigin.status, 403);
  const preflight = await proxy.fetch(request(chapterPath, { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'GET' } }), {});
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(preflight.headers.get('Access-Control-Allow-Methods'), 'GET');
  assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'), null);
  const forbiddenMethod = await proxy.fetch(request(chapterPath, { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'POST' } }), env);
  assert.equal(forbiddenMethod.status, 405);
});

test('a local origin can be configured without broadening the default allowlist', async () => {
  const proxy = createLogosProxy({ fetchImpl: async () => chapterResponse() });
  const localEnv = { ...env, ALLOWED_ORIGIN: 'http://localhost:4173' };
  assert.equal((await proxy.fetch(request(), localEnv)).status, 403);
  const response = await proxy.fetch(request(chapterPath, { headers: { Origin: localEnv.ALLOWED_ORIGIN } }), localEnv);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), localEnv.ALLOWED_ORIGIN);
});

test('a missing server key cannot be supplied through a user header or query string', async () => {
  const proxy = createLogosProxy({ fetchImpl: () => assert.fail('missing server key must stop before Logos') });
  const response = await proxy.fetch(request(chapterPath, { headers: { 'X-API-KEY': 'user-controlled-key' } }), {});
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.doesNotMatch(await response.text(), /user-controlled-key|server-only-test-key/);
});

test('fixed upstream requests send only the server key and preserve verse ranges and exact text', async () => {
  const calls = [];
  const proxy = createLogosProxy({ fetchImpl: async (url, options) => {
    calls.push({ url: String(url), options });
    return chapterResponse([row('3', '세 번째'), row('1-2', '  합쳐진\n본문  ')]);
  } });
  const response = await proxy.fetch(request(chapterPath, { headers: { 'X-API-KEY': 'attacker-key', Authorization: 'attacker-token', 'X-Upstream-Url': 'https://attacker.example' } }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { book: 'gen', chapter: 1, verses: [
    { verse: 1, endVerse: 2, text: '  합쳐진\n본문  ' },
    { verse: 3, endVerse: 3, text: '세 번째' },
  ], source: 'logos' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://logos-api.com/api/books/%EC%B0%BD%EC%84%B8%EA%B8%B0/chapters/1');
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.redirect, 'error');
  const headers = new Headers(calls[0].options.headers);
  assert.equal(headers.get('X-API-KEY'), env.LOGOS_API_KEY);
  assert.equal(headers.get('Authorization'), null);
  assert.equal(headers.get('Origin'), null);
  assert.equal(headers.get('X-Upstream-Url'), null);
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.equal(response.headers.get('Access-Control-Expose-Headers'), 'Retry-After');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('all 66 book IDs and boundaries map to canonical Logos book names', async () => {
  const upstreamNames = { '1jn': '요한1서', '2jn': '요한2서', '3jn': '요한3서' };
  for (const book of BOOKS) {
    const proxy = createLogosProxy({ fetchImpl: async (url) => {
      assert.equal(new URL(url).pathname, `/api/books/${encodeURIComponent(upstreamNames[book.id] ?? book.name)}/chapters/${book.chapters}`);
      return chapterResponse();
    } });
    const response = await proxy.fetch(request(`/v1/books/${book.id}/chapters/${book.chapters}`), env);
    assert.equal(response.status, 200, book.id);
    assert.equal((await proxy.fetch(request(`/v1/books/${book.id}/chapters/${book.chapters + 1}`), env)).status, 404, book.id);
  }
});

test('upstream failures never expose its body, headers, exception, or secret', async () => {
  for (const status of [301, 401, 403, 404, 500]) {
    const proxy = createLogosProxy({ fetchImpl: async () => new Response('upstream-private-body server-only-test-key', { status, headers: { 'X-API-KEY': env.LOGOS_API_KEY, Location: 'https://attacker.example' } }) });
    const response = await proxy.fetch(request(), env);
    assert.equal(response.status, 502, String(status));
    assert.equal(response.headers.get('X-API-KEY'), null);
    assert.equal(response.headers.get('Location'), null);
    assert.doesNotMatch(await response.text(), /upstream-private-body|server-only-test-key|attacker/);
  }
  const proxy = createLogosProxy({ fetchImpl: async () => { throw new Error('server-only-test-key private network details'); } });
  const response = await proxy.fetch(request(), env);
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /server-only-test-key|private network details/);
});

test('malformed JSON, verse ranges, duplicates, overlaps, and empty chapters fail safely', async () => {
  const bodies = ['not JSON', '{}', '[]', JSON.stringify([row('0')]), JSON.stringify([row('177')]), JSON.stringify([row('2-1')]), JSON.stringify([row('1-177')]), JSON.stringify([row('01')]), JSON.stringify([row(1)]), JSON.stringify([row('1', '')]), JSON.stringify([row('1'), row('1')]), JSON.stringify([row('1-3'), row('2-4')]), JSON.stringify([row('1-2'), row('2')]), JSON.stringify([null])];
  for (const body of bodies) {
    const proxy = createLogosProxy({ fetchImpl: async () => new Response(body, { headers: { 'Content-Type': 'application/json' } }) });
    const response = await proxy.fetch(request(), env);
    assert.equal(response.status, 502, body);
    assert.doesNotMatch(await response.text(), /테스트 본문/);
  }
});

test('upstream rate limits preserve a bounded retry delay without copying error content', async () => {
  for (const [headers, expected] of [
    [{ 'Retry-After': '120' }, '60'],
    [{ 'X-RateLimit-Retry-After': '7' }, '7'],
    [{ 'Retry-After': 'invalid' }, '60'],
    [{ 'Retry-After': 'Thu, 01 Jan 1970 00:00:20 GMT' }, '10'],
  ]) {
    const proxy = createLogosProxy({ now: () => 10_000, fetchImpl: async () => new Response('private upstream rate error', { status: 429, headers }) });
    const response = await proxy.fetch(request(), env);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), expected);
    assert.doesNotMatch(await response.text(), /private upstream rate error/);
  }
});

test('simultaneous chapter readers share one upstream request and receive independent responses', async () => {
  let release;
  let calls = 0;
  const proxy = createLogosProxy({ fetchImpl: () => {
    calls += 1;
    return new Promise((resolve) => { release = () => resolve(chapterResponse()); });
  } });
  const first = proxy.fetch(request(), env);
  const second = proxy.fetch(request(), env);
  assert.equal(calls, 1);
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.notEqual(a, b);
  assert.deepEqual(await a.json(), await b.json());
});

test('successful chapters expire after five minutes and failed requests can be retried', async () => {
  let current = 0;
  let calls = 0;
  const proxy = createLogosProxy({ now: () => current, fetchImpl: async () => {
    calls += 1;
    return calls === 1 ? new Response('failure', { status: 500 }) : chapterResponse([row('1', `본문 ${calls}`)]);
  } });
  assert.equal((await proxy.fetch(request(), env)).status, 502);
  assert.equal((await proxy.fetch(request(), env)).status, 200);
  current = 299_999;
  assert.equal((await (await proxy.fetch(request(), env)).json()).verses[0].text, '본문 2');
  assert.equal(calls, 2);
  current = 300_000;
  assert.equal((await (await proxy.fetch(request(), env)).json()).verses[0].text, '본문 3');
  assert.equal(calls, 3);
});

test('cache capacity stays at 64 chapters and the oldest entry is evicted', async () => {
  let calls = 0;
  let current = 0;
  const proxy = createLogosProxy({ now: () => current, fetchImpl: async () => { calls += 1; return chapterResponse(); } });
  for (let chapter = 1; chapter <= 65; chapter += 1) {
    if (chapter === 60) current = 60_000;
    assert.equal((await proxy.fetch(request(`/v1/books/psa/chapters/${chapter}`), env)).status, 200);
  }
  await proxy.fetch(request('/v1/books/psa/chapters/65'), env);
  assert.equal(calls, 65);
  await proxy.fetch(request('/v1/books/psa/chapters/1'), env);
  assert.equal(calls, 66);
});

test('the isolate permits 60 upstream cache misses per minute while cache hits remain available', async () => {
  let current = 0;
  let calls = 0;
  const proxy = createLogosProxy({ now: () => current, fetchImpl: async () => { calls += 1; return chapterResponse(); } });
  for (let chapter = 1; chapter <= 60; chapter += 1) {
    assert.equal((await proxy.fetch(request(`/v1/books/psa/chapters/${chapter}`), env)).status, 200);
  }
  assert.equal((await proxy.fetch(request('/v1/books/psa/chapters/1'), env)).status, 200);
  const blocked = await proxy.fetch(request('/v1/books/psa/chapters/61'), env);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('Retry-After'), '60');
  assert.equal(calls, 60);
  current = 60_000;
  assert.equal((await proxy.fetch(request('/v1/books/psa/chapters/61'), env)).status, 200);
  assert.equal(calls, 61);
});

test('server secret changes cannot reuse content cached under the previous configuration', async () => {
  let calls = 0;
  const proxy = createLogosProxy({ fetchImpl: async () => { calls += 1; return chapterResponse([row('1', `본문 ${calls}`)]); } });
  await proxy.fetch(request(), env);
  assert.equal((await proxy.fetch(request(), {})).status, 503);
  const response = await proxy.fetch(request(), { ...env, LOGOS_API_KEY: 'replacement-server-key' });
  assert.equal((await response.json()).verses[0].text, '본문 2');
  assert.equal(calls, 2);
});

test('a stalled upstream is aborted after 15 seconds and returns a safe timeout', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  const proxy = createLogosProxy({ fetchImpl: async (_url, options) => {
    signal = options.signal;
    return new Promise(() => {});
  } });
  const pending = proxy.fetch(request(), env);
  t.mock.timers.tick(14_999);
  assert.ok(signal instanceof AbortSignal);
  assert.equal(signal.aborted, false);
  t.mock.timers.tick(1);
  const response = await pending;
  assert.equal(signal.aborted, true);
  assert.equal(response.status, 504);
  assert.doesNotMatch(await response.text(), /server-only-test-key/);
});
