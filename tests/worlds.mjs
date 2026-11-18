import { launchBrowser, base } from './browser-tools.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const browser = await launchBrowser(),
  page = await browser.newPage({ viewport: { width: 944, height: 640 } });
page.setDefaultTimeout(45000);
const results = [],
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text());
});
mkdirSync('test-results', { recursive: true });
const cases = [
  ['airport', 'stratus', 'Free flight'],
  ['coast', 'vela', 'Checkpoint challenge'],
  ['alpine', 'meridian', 'Random disaster'],
  ['metro', 'atlas', 'City destruction lab'],
  ['desert', 'solace', 'Aircraft damage lab'],
  ['future', 'aether', 'Sandbox'],
  ['airport', 'kestrel', 'Sandbox'],
];
try {
  await page.goto(base + '/#settings');
  await page.getByRole('button', { name: 'Low', exact: true }).click();
  await page.getByRole('switch', { name: 'Simulator audio' }).click();
  for (const [map, plane, mode] of cases) {
    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'Scenario Lab', exact: true })
      .click();
    await page.getByLabel('Simulation mode', { exact: true }).selectOption(mode);
    await page.getByLabel('Aircraft', { exact: true }).selectOption(plane);
    await page.getByLabel('Environment', { exact: true }).selectOption(map);
    await page
      .getByLabel('Time of day', { exact: true })
      .selectOption(map === 'future' ? 'Twilight' : map === 'alpine' ? 'Golden hour' : 'Daylight');
    await page
      .getByLabel('Flight physics', { exact: true })
      .selectOption(map === 'desert' ? 'Simulation' : 'Arcade');
    await page
      .getByLabel('Weather profile', { exact: true })
      .selectOption(map === 'alpine' ? 'storm' : 'clear');
    await page.getByRole('button', { name: 'Launch simulation', exact: true }).click();
    await page.waitForFunction(() => !!window.__NDX_ENGINE__, undefined, { timeout: 60000 });
    const data = await page.evaluate(
      ({ mode, map }) => {
        const e = window.__NDX_ENGINE__;
        let n =
          mode === 'Random disaster'
            ? Math.ceil(e.nextFault * 60) + 10
            : mode === 'Checkpoint challenge'
              ? 440
              : mode === 'City destruction lab'
                ? 300
                : mode === 'Aircraft damage lab'
                  ? 380
                  : 80;
        for (let i = 0; i < n; i++) e.step();
        e.updateCamera(1);
        e.publish();
        return {
          map: e.c.map,
          airframe: e.plane.id,
          mode: e.c.mode,
          structuralModules: e.env.sections.length,
          triangles: e.renderer.info.render.triangles,
          clock: +e.t.toFixed(2),
          checkpoint: e.gate,
          broken: e.broken.size,
          power: e.enginePower,
          hp: e.hp,
          finite: [
            e.model.position.x,
            e.model.position.y,
            e.model.position.z,
            e.model.quaternion.w,
          ].every(Number.isFinite),
          nextFault: e.nextFault,
          webgl2: e.renderer.getContext() instanceof WebGL2RenderingContext,
          loadedLOD: !!e.farModel,
        };
      },
      { mode, map },
    );
    assert.equal(data.map, map);
    assert.equal(data.airframe, plane);
    assert.ok(
      data.finite && data.webgl2 && data.loadedLOD && data.structuralModules > 10 && data.triangles > 0,
    );
    if (mode === 'Checkpoint challenge') assert.ok(data.checkpoint >= 1);
    if (mode === 'City destruction lab') assert.ok(data.broken > 0);
    if (mode === 'Aircraft damage lab') assert.ok(data.power < 1);
    if (mode === 'Random disaster') assert.ok(data.nextFault > data.clock);
    await page.screenshot({ path: `test-results/world-${map}-${plane}.png` });
    console.log('PASS', JSON.stringify(data));
    results.push(data);
    if (map === 'metro') {
      await page.getByRole('button', { name: 'Events', exact: true }).click();
      await page.getByRole('button', { name: 'District stress test', exact: true }).click();
      const large = await page.evaluate(() => {
        const e = window.__NDX_ENGINE__;
        let peak = 0;
        for (let i = 0; i < 340; i++) {
          e.step();
          peak = Math.max(peak, e.debris.filter((d) => d.body).length);
        }
        e.publish();
        return { sections: e.broken.size, visible: e.debris.length, peak, limit: e.maxBodies };
      });
      assert.ok(large.sections >= 16 && large.visible > 100 && large.peak <= large.limit);
      data.districtTest = large;
      console.log('PASS District-scale bounded cascade', large);
      await page.screenshot({ path: 'test-results/district-test.png' });
    }
    if (map === 'coast') {
      const wet = await page.evaluate(() => {
        const e = window.__NDX_ENGINE__;
        e.body.setTranslation({ x: 840, y: 1, z: 270 }, true);
        e.body.setLinvel({ x: 2, y: -13, z: -23 }, true);
        for (let i = 0; i < 45; i++) e.step();
        return { wet: e.inWater, hp: e.hp, altitude: e.body.translation().y };
      });
      assert.ok(wet.wet && Number.isFinite(wet.altitude));
      console.log('PASS Water interaction', wet);
    }
    if (plane === 'stratus') {
      const result = await page.evaluate(() => {
        const e = window.__NDX_ENGINE__;
        e.toggleGear();
        e.body.setTranslation({ x: 0, y: 8, z: 320 }, true);
        e.body.setLinvel({ x: 0, y: -4, z: -21 }, true);
        e.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
        e.throttle = 0;
        e.keys.add('Space');
        for (let i = 0; i < 200; i++) e.step();
        e.keys.delete('Space');
        return { altitude: e.body.translation().y, hp: e.hp, gear: e.gear, speed: e.speed };
      });
      assert.ok(result.altitude > 0 && result.altitude < 4 && result.speed < 15);
      console.log('PASS Landing contact and ground braking', result);
    }
    if (plane === 'aether') {
      const systems = await page.evaluate(() => {
        const e = window.__NDX_ENGINE__;
        e.trigger('Electrical fault');
        const electrical = e.electrical;
        e.trigger('Hydraulic fault');
        const control = e.hydraulic;
        e.trigger('Navigation fault');
        const nav = e.navFault;
        e.trigger('Restore systems');
        return { electrical, control, nav, restored: !e.electrical && !e.navFault && e.hydraulic === 1 };
      });
      assert.ok(systems.electrical && systems.control < 1 && systems.nav && systems.restored);
      console.log('PASS Electrical, hydraulic, navigation faults and restoration');
    }
    if (plane === 'kestrel') {
      const cams = await page.evaluate(() => {
        const e = window.__NDX_ENGINE__,
          out = [];
        for (let i = 0; i < 6; i++) {
          e.setCamera(i);
          e.updateCamera(1);
          out.push([e.camIndex, ...e.camera.position.toArray()]);
        }
        return out;
      });
      assert.ok(cams.length === 6 && cams.flat().every(Number.isFinite));
      console.log('PASS All 6 camera transforms');
      await page.getByRole('button', { name: 'Restart simulation', exact: true }).click();
      await page.getByRole('button', { name: 'Restart', exact: true }).click();
      await page.waitForFunction(
        () => !!window.__NDX_ENGINE__ && window.__NDX_ENGINE__.t < 1,
        undefined,
        { timeout: 60000 },
      );
      console.log('PASS Restart rebuilds airframe and environment');
    }
    await page.getByRole('button', { name: 'End flight', exact: true }).click();
    await page.getByRole('checkbox').uncheck();
    await page.getByRole('button', { name: 'Finish session', exact: true }).click();
    await page.getByRole('heading', { name: 'Flight Deck', exact: true }).waitFor();
  }
  assert.deepEqual(errors, []);
} catch (e) {
  console.error(e, errors);
  await page.screenshot({ path: 'test-results/world-failure.png' }).catch(() => {});
  process.exitCode = 1;
} finally {
  writeFileSync('test-results/world-report.json', JSON.stringify({ results, errors }, null, 2));
  await browser.close();
}
