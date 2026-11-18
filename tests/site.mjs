// Exercise the compiled public site under a project subpath, with no API or SPA fallback.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { launchBrowser } from './browser-tools.mjs';

const root = resolve('out/site');
await stat(resolve(root, 'index.html'));
const prefix = '/Plane/';
const requests = new Set();
const media = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
};
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://site.test').pathname;
  requests.add(pathname);
  const file = resolve(root, pathname.slice(prefix.length) || 'index.html');
  if (
    !pathname.startsWith(prefix) ||
    !file.startsWith(root + sep) ||
    !(await stat(file).catch(() => null))?.isFile()
  ) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': media[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
let browser;
try {
  browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  page.setDefaultTimeout(60000);
  const url = `http://127.0.0.1:${server.address().port}${prefix}`;
  const button = (name) => page.getByRole('button', { name, exact: true });
  await page.goto(url);
  await page.getByRole('heading', { name: 'Flight Deck', exact: true }).waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((im) => im.decode()));
  });
  await page.locator('.user-button').click();
  await page.getByText('Saved on this device', { exact: true }).waitFor();
  assert.equal(
    await page.locator('input[type=password]').count(),
    0,
    'A static site must not solicit credentials',
  );
  await button('Close dialog').click();
  await button('Quick launch').click();
  await page.locator('.sim-toolbar').waitFor();
  await button('Pause simulation').click();
  await page.getByText('Simulation paused', { exact: true }).waitFor();
  await button('Resume').click();
  await button('Events').click();
  await button('Structure stress test').click();
  await page.getByText('Structure stress test activated', { exact: true }).waitFor();
  await button('End flight').click();
  await page.getByRole('checkbox').check();
  await button('Finish session').click();
  await page.getByRole('heading', { name: 'Recent flight', exact: true }).waitFor();
  await page.goto(url + '#replays');
  await page.reload();
  await button('Watch replay').click();
  await page.getByRole('slider', { name: 'Replay timeline' }).waitFor();
  await button('Exit replay').click();
  assert.equal(await page.evaluate(() => typeof window.__NDX_ENGINE__), 'undefined');
  assert.ok(
    [...requests].every((p) => p.startsWith(prefix) && !p.includes('/api/')),
    'No root-relative leaks or missing account server requests',
  );
  for (const file of [
    'art/alpine-flight.jpg',
    'models/stratus.glb',
    'models/world-props.glb',
    'textures/grass.webp',
  ])
    assert.ok(requests.has(prefix + file), file);
  assert.deepEqual(errors, []);
  console.log(
    `PASS public site at ${prefix}: dashboard assets, device profile, WebGL flight, structure stress test, saved flight, replay after reload; no API calls or failed assets. Chromium ${await browser.version()}`,
  );
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
