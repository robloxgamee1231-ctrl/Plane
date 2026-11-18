import { chromium } from 'playwright-core';
import binary from '@sparticuz/chromium';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { brotliDecompressSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
export const base = process.env.NDX_TEST_URL || 'http://127.0.0.1:5173';
export async function launchBrowser() {
  if (process.env.CHROME_PATH)
    return chromium.launch({
      executablePath: process.env.CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
    });
  const dir = join(tmpdir(), 'ndx-browser-runtime');
  mkdirSync(dir, { recursive: true });
  const require = createRequire(import.meta.url);
  if (!existsSync(join(dir, 'lib/libnspr4.so'))) {
    const tar = join(dirname(require.resolve('@sparticuz/chromium')), '../../bin/al2023.tar.br');
    execFileSync('tar', ['xf', '-', '-C', dir], { input: brotliDecompressSync(readFileSync(tar)) });
  }
  return chromium.launch({
    executablePath: await binary.executablePath(),
    args: binary.args.filter((x) => x !== '--disable-web-security'),
    headless: true,
    env: {
      ...process.env,
      LD_LIBRARY_PATH: join(dir, 'lib') + ':' + (process.env.LD_LIBRARY_PATH || ''),
    },
  });
}
