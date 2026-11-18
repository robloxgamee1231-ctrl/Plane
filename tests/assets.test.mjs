import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
function glb(path) {
  const b = readFileSync(path);
  assert.equal(b.toString('utf8', 0, 4), 'glTF');
  assert.equal(b.readUInt32LE(4), 2);
  assert.equal(b.readUInt32LE(8), b.length);
  return JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
}
for (const id of ['stratus', 'meridian', 'atlas', 'vela', 'kestrel', 'solace', 'aether'])
  test(id + ' ships an original, animated, modular GLB, a lower-cost LOD, and Blender source', () => {
    const g = glb('public/models/' + id + '.glb'),
      lod = glb('public/models/' + id + '-lod1.glb');
    const names = g.nodes.map((n) => n.name);
    for (const n of [
      'body_front',
      'body_mid',
      'body_aft',
      'wing_l',
      'wing_r',
      'tail',
      'engine_l',
      'gear',
      'doors',
      'cabin_windows',
      'interior',
      'cockpit',
      'elevator',
      'aileron_r',
    ])
      assert.ok(names.includes(n), n);
    assert.ok(g.animations.length >= 2);
    assert.ok(g.meshes.flatMap((m) => m.primitives).every((p) => 'TEXCOORD_0' in p.attributes));
    const count = (doc) =>
      doc.meshes
        .flatMap((m) => m.primitives)
        .reduce((sum, p) => sum + doc.accessors[p.indices].count / 3, 0);
    assert.ok(count(lod) < count(g) * 0.5);
    assert.ok(existsSync('assets/blender/' + id + '.blend'));
  });
test('environment prefab library contains original reusable scenery', () => {
  const props = glb('public/models/world-props.glb').nodes.map((n) => n.name);
  for (const name of [
    'service_cart',
    'cargo_crate',
    'pine',
    'hangar_wall',
    'industrial_vent',
    'bench',
    'barricade',
  ])
    assert.ok(props.includes(name));
});
