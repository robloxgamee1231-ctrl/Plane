// Real Chromium + WebGL2 + WASM integration. Start the development server first.
// Fixed stepping is used only to avoid relying on host graphics speed during physics assertions.
import { launchBrowser, base } from './browser-tools.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const browser = await launchBrowser(),
  page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const errors = [],
  checks = [];
const pass = (name, details = {}) => {
  checks.push({ name, ...details });
  console.log('PASS', name, JSON.stringify(details));
};
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text());
});
page.setDefaultTimeout(45000);
mkdirSync('test-results', { recursive: true });
const button = (name) => page.getByRole('button', { name, exact: true });
const nav = (name) => page.getByRole('navigation').getByRole('button', { name, exact: false }).click();
const waitEngine = () =>
  page.waitForFunction(
    () => !!window.__NDX_ENGINE__ && !!document.querySelector('.sim-toolbar'),
    undefined,
    { timeout: 60000 },
  );
const step = (n) =>
  page.evaluate((n) => {
    const e = window.__NDX_ENGINE__;
    for (let i = 0; i < n; i++) e.step();
    e.publish();
    return e.t;
  }, n);
async function finish(save = true) {
  await button('End flight').click();
  await page.getByRole('dialog', { name: 'Flight debrief' }).waitFor();
  if (!save) await page.getByRole('checkbox').uncheck();
  await button('Finish session').click();
  await page.getByRole('heading', { name: 'Flight Deck', exact: true }).waitFor();
}
try {
  await page.goto(base);
  await page.getByText('System online', { exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'test-results/desktop.png' });
  assert.equal(await page.locator('.config-card').count(), 3);
  pass('Website, locally hosted artwork, fonts and backend load');
  await button('Next featured scenario').click();
  assert.equal(await page.locator('.feature h2').innerText(), 'Coastal Circuit');
  await button('Previous featured scenario').click();
  pass('Featured scenario carousel');
  await page.locator('.config-card').nth(0).click();
  await page.locator('.fleet-row').filter({ hasText: 'Vela J-8' }).click();
  await page.waitForSelector('.model-preview canvas');
  await button('Select aircraft').click();
  assert.match(await page.locator('.config-card').first().innerText(), /Vela J-8/);
  pass('Aircraft selection and live 3D hangar preview');
  await page.locator('.config-card').nth(1).click();
  await page.locator('.map-card').filter({ hasText: 'Coastline' }).click();
  await button('Use environment').click();
  await page.locator('.config-card').nth(2).click();
  await page.locator('.weather-choices button').filter({ hasText: 'Crosswind' }).click();
  await button('Apply conditions').click();
  pass('Map and weather configuration');
  await button('Open sandbox').click();
  await page.getByLabel('Simulation mode').selectOption('Sandbox');
  await page.getByLabel('Start altitude', { exact: false }).fill('175');
  await button('Save scenario').click();
  await page.getByLabel('Scenario name').fill('Coastal QA circuit');
  await button('Save preset').click();
  await page.getByRole('button', { name: /Saved scenarios/ }).click();
  await button('Load preset').click();
  assert.equal(await page.getByLabel('Simulation mode').inputValue(), 'Sandbox');
  pass('Scenario editor, save preset, load preset');
  await nav('Settings');
  await button('Low').click();
  await page.getByRole('switch', { name: 'Adaptive resolution' }).click();
  await button('Metric').click();
  await nav('Flight Deck');
  await button('Reset setup').click();
  await page.reload();
  await page.getByText('System online', { exact: true }).waitFor();
  assert.ok(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('ndx.pilot.guest')).settings.quality === 'Low',
    ),
  );
  pass('Graphics, units and local persistence survive reload');
  await page.setViewportSize({ width: 920, height: 660 });
  await button('Quick launch').click();
  await waitEngine();
  await button('Fullscreen').click();
  assert.ok(await page.evaluate(() => !!document.fullscreenElement));
  await page.evaluate(() => document.exitFullscreen());
  pass('Fullscreen enters and exits');
  let initial = await page.evaluate(() => {
    const e = window.__NDX_ENGINE__;
    return { z: e.body.translation().z, y: e.body.translation().y };
  });
  await step(35);
  let moved = await page.evaluate(() => window.__NDX_ENGINE__.body.translation());
  assert.ok(moved.z < initial.z - 20);
  assert.ok(Number.isFinite(moved.y) && moved.y > 0);
  pass('Live aircraft movement, gravity, balanced cruise', { travel: Math.round(initial.z - moved.z) });
  await page.keyboard.down('a');
  await step(24);
  await page.keyboard.up('a');
  let bank = await page.evaluate(() => Math.abs(window.__NDX_ENGINE__.model.quaternion.z));
  assert.ok(bank > 0.02);
  await page.keyboard.down('Shift');
  await step(20);
  await page.keyboard.up('Shift');
  assert.ok(await page.evaluate(() => window.__NDX_ENGINE__.throttle > 0.72));
  await page.keyboard.press('g');
  assert.ok(await page.evaluate(() => window.__NDX_ENGINE__.gear));
  pass('Keyboard roll, throttle and retractable landing gear');
  await page.keyboard.press('c');
  assert.equal(await page.evaluate(() => window.__NDX_ENGINE__.camIndex), 1);
  await page.screenshot({ path: 'test-results/cockpit.png' });
  await page.keyboard.press('c');
  await page.keyboard.press('t');
  assert.equal(await page.evaluate(() => window.__NDX_ENGINE__.rate), 0.25);
  await page.keyboard.press('p');
  let paused = await page.evaluate(() => window.__NDX_ENGINE__.t);
  await page.waitForTimeout(140);
  assert.equal(await page.evaluate(() => window.__NDX_ENGINE__.t), paused);
  await page.keyboard.press('p');
  await page.keyboard.press('t');
  pass('Cockpit, orbit, pause, resume and slow motion');
  await button('Events').click();
  await button('Engine malfunction').click();
  assert.equal(await page.evaluate(() => window.__NDX_ENGINE__.enginePower), 0.36);
  await button('Events').click();
  await button('Release cabin door').click();
  assert.ok(await page.evaluate(() => window.__NDX_ENGINE__.lost.has('doors')));
  await button('Events').click();
  await button('Structure stress test').click();
  await step(32);
  let damage = await page.evaluate(() => {
    const e = window.__NDX_ENGINE__;
    return {
      sections: e.broken.size,
      fragments: e.debris.length,
      bodies: e.debris.filter((x) => x.body).length,
      positions: e.debris.map((x) => x.obj.position.y),
    };
  });
  assert.ok(damage.sections >= 1 && damage.fragments >= 4 && damage.bodies > 0);
  await step(30);
  const after = await page.evaluate(() => window.__NDX_ENGINE__.debris.map((x) => x.obj.position.y));
  assert.ok(after.some((y, i) => Math.abs(y - damage.positions[i]) > 0.1));
  await page.screenshot({ path: 'test-results/structural-test.png' });
  pass('Faults, physical detachment, falling building modules and persistent debris', {
    sections: damage.sections,
    fragments: damage.fragments,
  });
  // Start an isolated impact fixture beside a still-intact fictional section; all damage below must come from the Rapier contact queue.
  const contact = await page.evaluate(() => {
    const e = window.__NDX_ENGINE__,
      s = e.env.sections.find((v) => v.kind === 'hangar' && v.level === 0 && !e.broken.has(v.id));
    const prev = e.broken.size,
      hp = e.hp;
    e.body.setTranslation({ x: s.x, y: s.y, z: s.z + s.d / 2 + e.plane.length * 0.55 + 7 }, true);
    e.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    e.body.setLinvel({ x: 0, y: 0, z: -65 }, true);
    e.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    for (let i = 0; i < 80; i++) e.step();
    e.publish();
    return {
      before: prev,
      after: e.broken.size,
      hpBefore: hp,
      hpAfter: e.hp,
      detached: e.lost.size,
      bodies: e.debris.filter((d) => d.body).length,
      cap: e.maxBodies,
    };
  });
  console.log('Contact fixture:', contact);
  assert.ok(
    contact.after > contact.before && contact.hpAfter < contact.hpBefore && contact.detached > 1,
  );
  assert.ok(contact.bodies <= contact.cap);
  pass('Actual aircraft–structure collision triggers localized breakup', contact);
  await button('Events').click();
  await button('Structure stress test').click();
  await step(65);
  await button('Events').click();
  await button('Structure stress test').click();
  await step(60);
  const cap = await page.evaluate(() => {
    const e = window.__NDX_ENGINE__;
    return { total: e.debris.length, active: e.debris.filter((d) => d.body).length, cap: e.maxBodies };
  });
  assert.ok(cap.active <= cap.cap && cap.total > cap.active);
  pass('Debris body cap and lower-cost distant rubble', cap);
  const sound = await page.evaluate(() => {
    const e = window.__NDX_ENGINE__;
    return {
      state: e.audio.a.state,
      gain: e.audio.gain.gain.value,
      engine: e.audio.engine.frequency.value,
    };
  });
  assert.ok(sound.state === 'running' && sound.engine > 0);
  pass('Web Audio engine and spatial mix graph', sound);
  const geometrySignature = () =>
    page.evaluate(() =>
      window.__NDX_ENGINE__.env.sections.map((s) => [s.id, s.kind, s.x, s.y, s.z].join(',')).join(';'),
    );
  const originalGeometry = await geometrySignature();
  await finish(true);
  await nav('Settings');
  await button('Medium').click();
  await nav('Flight Replays');
  await button('Watch replay').first().click();
  await waitEngine();
  assert.equal(await geometrySignature(), originalGeometry);
  pass('Seeded replay layout is stable across graphics presets');
  const timeline = page.getByRole('slider', { name: 'Replay timeline' });
  await timeline.fill(await timeline.getAttribute('min'));
  const early = await page.evaluate(() => window.__NDX_ENGINE__.broken.size);
  await timeline.fill(await timeline.getAttribute('max'));
  const late = await page.evaluate(() => window.__NDX_ENGINE__.broken.size);
  assert.ok(late > early);
  await button('Play replay').click();
  await page.waitForTimeout(150);
  assert.ok(
    await page.evaluate(() => window.__NDX_ENGINE__.replayTime < window.__NDX_ENGINE__.frames.at(-1).t),
  );
  await button('Exit replay').click();
  pass('Replay save, reconstruction, scrubbing, play and rewind', { early, late });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator('.user-button').click();
  await button('Create account').first().click();
  const handle = 'qa-' + Date.now().toString(36),
    passphrase = 'Local-browser-test-48';
  await page.getByLabel('Pilot name', { exact: true }).fill(handle);
  await page.getByLabel('Password', { exact: true }).fill(passphrase);
  await page.getByRole('button', { name: 'Create account', exact: true }).last().click();
  await page.getByRole('button', { name: 'Sign out' }).waitFor();
  await button('Sign out').click();
  await page.locator('.user-button').click();
  await page.getByLabel('Pilot name', { exact: true }).fill(handle);
  await page.getByLabel('Password', { exact: true }).fill(passphrase);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await button('Sign out').waitFor();
  const me = await page.evaluate(() => fetch('/api/me').then((r) => r.json()));
  assert.equal(me.user.name, handle);
  assert.ok(me.state.scenarios.some((s) => s.name === 'Coastal QA circuit'));
  await button('Sign out').click();
  pass('Browser registration, sign out, sign in and cloud profile restore');
  await nav('Flight Deck');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/mobile.png' });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await button('Open navigation').click();
  await nav('Environments');
  assert.equal(await page.locator('.map-card').count(), 6);
  pass('Responsive 390px layout and mobile navigation');
  assert.deepEqual(errors, []);
  pass('No uncaught application or WebGL shader errors');
} catch (e) {
  console.error('BROWSER TEST FAILED', e);
  console.log(
    'PAGE',
    await page
      .locator('body')
      .innerText()
      .catch(() => ''),
  );
  console.error('Browser errors', errors);
  await page.screenshot({ path: 'test-results/failure.png' }).catch(() => {});
  process.exitCode = 1;
} finally {
  writeFileSync(
    'test-results/browser-report.json',
    JSON.stringify({ browser: await browser.version(), checks, errors }, null, 2),
  );
  await browser.close();
}
