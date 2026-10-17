import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const prefix = '/biblejeong';
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export function createPreviewServer(root = projectRoot) {
  const publicRoot = resolve(root);
  return createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    try {
      let pathname = decodeURIComponent(request.url.split('?')[0]);
      if (!pathname.startsWith('/') || /[\\\0]/.test(pathname) || pathname.split('/').some(part => part.startsWith('.'))) {
        response.writeHead(400).end('잘못된 경로입니다.');
        return;
      }
      if (pathname === prefix || pathname === '/mypage' || pathname === `${prefix}/mypage`) {
        response.writeHead(308, { Location: `${pathname}/` }).end();
        return;
      }
      if (pathname.startsWith(`${prefix}/`)) pathname = pathname.slice(prefix.length);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const allowed = ['/index.html', '/mypage/index.html', '/404.html', '/robots.txt'].includes(pathname) || pathname.startsWith('/assets/');
      if (!allowed) {
        response.writeHead(404).end('페이지를 찾을 수 없습니다.');
        return;
      }
      const filename = await realpath(resolve(publicRoot, `.${pathname}`));
      const canonicalRoot = await realpath(publicRoot);
      if (!filename.startsWith(`${canonicalRoot}${sep}`) || !(await stat(filename)).isFile()) {
        response.writeHead(404).end('페이지를 찾을 수 없습니다.');
        return;
      }
      const contents = await readFile(filename);
      response.writeHead(200, { 'Content-Type': mimeTypes[extname(filename).toLowerCase()] ?? 'application/octet-stream' });
      response.end(request.method === 'HEAD' ? undefined : contents);
    } catch (error) {
      const status = error instanceof URIError ? 400 : ['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code) ? 404 : 500;
      response.writeHead(status).end(status === 400 ? '잘못된 경로입니다.' : '페이지를 찾을 수 없습니다.');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT는 1~65535 사이의 정수여야 합니다.');
  createPreviewServer().listen(port, '127.0.0.1', () => {
    console.log(`성경 곁에서 미리보기: http://127.0.0.1:${port}${prefix}/`);
  });
}
