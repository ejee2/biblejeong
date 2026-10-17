import { cp, lstat, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicFiles = ['index.html', 'mypage', 'assets', 'robots.txt'];

export async function build(root = projectRoot) {
  const output = join(resolve(root), 'dist');
  // The output path is always this project's dist directory, never a caller-supplied target.
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const entry of publicFiles) {
    await cp(join(root, entry), join(output, entry), { recursive: true });
  }
  try {
    await lstat(join(root, '404.html'));
    await cp(join(root, '404.html'), join(output, '404.html'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await writeFile(join(output, '.nojekyll'), '');
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = await build();
  console.log(`정적 페이지 빌드 완료: ${output}`);
}
