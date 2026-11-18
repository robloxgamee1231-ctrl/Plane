// Starts a short-lived isolated production server. No fixture data is written to the live profile database.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { launchBrowser } from './browser-tools.mjs';
const dir = mkdtempSync(join(tmpdir(), 'ndx-production-')),
  reserve = createServer();
await new Promise((r) => reserve.listen(0, '127.0.0.1', r));
const port = reserve.address().port;
await new Promise((r) => reserve.close(r));
const server = spawn(process.execPath, ['server/start.mjs'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    NDX_DATA_DIR: dir,
    NDX_OWNER_PASSWORD: randomBytes(24).toString('hex'),
  },
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.once('data', resolve);
    server.once('error', reject);
    server.once('exit', (c) => reject(Error('Server exited ' + c)));
  });
  const url = 'http://127.0.0.1:' + port;
  const host = await fetch(url + '/', { headers: { host: '5173-check.e2b.app' } });
  assert.equal(host.status, 200);
  assert.equal((await fetch(url + '/server/api.mjs')).status, 404);
  assert.equal((await fetch(url + '/.data/owner-bootstrap.txt')).status, 404);
  browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1024, height: 700 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.setDefaultTimeout(50000);
  await page.goto(url);
  await page.getByText('System online', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Launch scenario', exact: true }).click();
  await page.locator('.sim-toolbar').waitFor();
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  await page.getByText('Simulation paused', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Events', exact: true }).click();
  await page.getByRole('button', { name: 'Engine malfunction', exact: true }).click();
  await page.getByText('Engine fault', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => typeof window.__NDX_ENGINE__), 'undefined');
  assert.deepEqual(errors, []);
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/production-flight.png' });
  await page.getByRole('button', { name: 'End flight', exact: true }).click();
  await page.getByRole('checkbox').uncheck();
  await page.getByRole('button', { name: 'Finish session', exact: true }).click();
  await page.getByRole('heading', { name: 'Flight Deck', exact: true }).waitFor();
  console.log(
    'PASS production build: clean boot, preview host, private-file exclusion, 3D scenario, pause/resume, fault, debrief, no dev hook. Chromium',
    await browser.version(),
  );
  writeFileSync(
    'test-results/production-' + (await browser.version()).split('.')[0] + '.json',
    JSON.stringify({ browser: await browser.version(), passed: true, errors }, null, 2),
  );
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await new Promise((r) => server.once('exit', r));
  rmSync(dir, { recursive: true, force: true });
}
