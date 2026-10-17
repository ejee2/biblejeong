import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { build } from '../scripts/build.mjs';
import { createPreviewServer } from '../scripts/serve.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'biblejeong-deploy-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'mypage'));
  await mkdir(join(root, 'assets'));
  await writeFile(join(root, 'index.html'), '<title>읽기</title>');
  await writeFile(join(root, 'mypage/index.html'), '<title>마이페이지</title>');
  await writeFile(join(root, 'assets/app.js'), 'export const page = "reading";');
  await writeFile(join(root, 'robots.txt'), 'User-agent: *\nAllow: /\n');
  await writeFile(join(root, 'README.md'), 'not public');
  return root;
}

test('build publishes the two pages and assets, removes stale output, and preserves source', async t => {
  const root = await fixture(t);
  await mkdir(join(root, 'dist'));
  await writeFile(join(root, 'dist/stale.txt'), 'old');
  const output = await build(root);
  assert.equal(output, join(root, 'dist'));
  assert.deepEqual((await readdir(output)).sort(), ['.nojekyll', 'assets', 'index.html', 'mypage', 'robots.txt']);
  assert.equal(await readFile(join(output, 'mypage/index.html'), 'utf8'), '<title>마이페이지</title>');
  assert.equal(await readFile(join(root, 'README.md'), 'utf8'), 'not public');
  assert.equal(await readFile(join(root, 'assets/app.js'), 'utf8'), 'export const page = "reading";');
});

function get(server, path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: server.address().port, path, method }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function serve(t, root) {
  const server = createPreviewServer(root);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  return server;
}

test('preview serves direct and GitHub project routes with module MIME types and canonical directory URLs', async t => {
  const server = await serve(t, await fixture(t));
  for (const path of ['/', '/biblejeong/', '/mypage/', '/biblejeong/mypage/']) {
    const response = await get(server, path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers['content-type'], /^text\/html/);
  }
  const redirect = await get(server, '/biblejeong/mypage');
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.location, '/biblejeong/mypage/');
  const javascript = await get(server, '/biblejeong/assets/app.js?v=1');
  assert.match(javascript.headers['content-type'], /^text\/javascript/);
  assert.match(javascript.body, /export const/);
  assert.equal((await get(server, '/biblejeong/', 'HEAD')).body, '');
});

test('preview rejects traversal, malformed URLs, hidden files, source-only files, and external symlinks', async t => {
  const root = await fixture(t);
  const server = await serve(t, root);
  await symlink(join(root, 'README.md'), join(root, 'assets/inside.txt'));
  const outside = await mkdtemp(join(tmpdir(), 'biblejeong-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(join(outside, 'private.txt'), 'never expose');
  await symlink(join(outside, 'private.txt'), join(root, 'assets/outside.txt'));
  for (const path of ['/../README.md', '/assets/%2e%2e/README.md', '/assets/%5cREADME.md', '/assets/%00x', '/.git/config', '/assets/%zz']) {
    assert.equal((await get(server, path)).status, 400, path);
  }
  for (const path of ['/README.md', '/unknown/', '/assets/missing.js', '/assets/outside.txt']) {
    assert.equal((await get(server, path)).status, 404, path);
  }
  const method = await get(server, '/', 'POST');
  assert.equal(method.status, 405);
  assert.equal(method.headers.allow, 'GET, HEAD');
});
