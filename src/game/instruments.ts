import * as T from 'three';
import type { Plane } from '../data';

/** The cockpit glass is single-view tinted from outside; inside, its metal edges frame a clear view. */
export function cockpitInstruments(model: T.Group, plane: Plane) {
  const group = new T.Group();
  group.name = 'Cockpit instrumentation';
  group.visible = false;
  model.add(group);
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  const display = new T.Mesh(
    new T.PlaneGeometry(plane.radius * 1.75, plane.radius * 0.4375),
    new T.MeshBasicMaterial({ map: texture, toneMapped: false }),
  );
  display.position.set(0, -plane.radius * 0.035, -plane.length * 0.416 + 0.26);
  group.add(display);
  const windshield = model.getObjectByName('windshield');
  model.updateMatrixWorld(true);
  windshield?.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    const lines = new T.LineSegments(
      new T.EdgesGeometry(o.geometry, 16),
      new T.LineBasicMaterial({ color: 0x29343b }),
    );
    lines.applyMatrix4(o.matrixWorld);
    group.add(lines);
  });
  let last = -10;
  function update(
    t: number,
    speed: number,
    alt: number,
    bank: number,
    pitch: number,
    heading: number,
    fault: boolean,
    systems: [number, number, number],
  ) {
    if (Math.abs(t - last) < 0.11) return;
    last = t;
    ctx.fillStyle = '#2a3033';
    ctx.fillRect(0, 0, 768, 192);
    ctx.fillStyle = '#475156';
    ctx.fillRect(0, 0, 768, 4);
    ctx.fillStyle = '#191f21';
    ctx.fillRect(6, 8, 756, 177);
    ctx.font = '10px monospace';
    ctx.fillStyle = '#b1c0bc';
    ctx.fillText('NDX  /  FLIGHT INSTRUMENTS', 20, 24);
    ctx.fillText(plane.code, 694, 24);
    const bezel = (x: number, w: number) => {
      ctx.fillStyle = '#394348';
      ctx.fillRect(x, 31, w, 143);
      ctx.fillStyle = '#101e23';
      ctx.fillRect(x + 5, 36, w - 10, 133);
    };
    bezel(16, 165);
    bezel(193, 207);
    bezel(411, 151);
    bezel(574, 178);
    if (fault) {
      ctx.fillStyle = '#a6805e';
      ctx.fillText('BACKUP POWER', 28, 62);
      texture.needsUpdate = true;
      return;
    }
    ctx.fillStyle = '#90c2b3';
    ctx.font = '12px monospace';
    ctx.fillText('AIRSPEED', 31, 56);
    ctx.fillText('ALTITUDE', 426, 56);
    ctx.fillText('SYSTEMS', 590, 56);
    ctx.fillStyle = '#d7efda';
    ctx.font = 'bold 32px monospace';
    ctx.fillText(String(Math.round(speed * 1.94384)).padStart(3, '0'), 31, 103);
    ctx.fillText(String(Math.round(alt * 3.28084)).padStart(4, '0'), 424, 103);
    ctx.font = '11px monospace';
    ctx.fillStyle = '#7f9e97';
    ctx.fillText('KTS', 32, 121);
    ctx.fillText('FT AGL', 426, 121);
    for (let i = 0; i < 22; i++) {
      ctx.fillStyle = i < (16 * speed) / plane.cruise ? '#96b58e' : '#334b45';
      ctx.fillRect(32 + i * 5.6, 140, 3, 12);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(200, 39, 193, 125);
    ctx.clip();
    ctx.translate(296, 103);
    ctx.rotate(-bank);
    ctx.translate(0, pitch * 115);
    ctx.fillStyle = '#6399ac';
    ctx.fillRect(-220, -240, 440, 240);
    ctx.fillStyle = '#947964';
    ctx.fillRect(-220, 0, 440, 240);
    ctx.strokeStyle = '#dce7d7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-230, 0);
    ctx.lineTo(230, 0);
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      const w = i % 2 ? 11 : 26;
      ctx.beginPath();
      ctx.moveTo(-w, i * 13);
      ctx.lineTo(w, i * 13);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = '#ffca6c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(260, 99);
    ctx.lineTo(282, 99);
    ctx.lineTo(288, 106);
    ctx.lineTo(296, 99);
    ctx.lineTo(304, 106);
    ctx.lineTo(310, 99);
    ctx.lineTo(332, 99);
    ctx.stroke();
    ctx.fillStyle = '#b3cfb0';
    ctx.font = '11px monospace';
    ctx.fillText('HDG ' + String(Math.round(heading) % 360).padStart(3, '0'), 431, 148);
    ['ENG 1', 'ENG 2', 'HYD'].forEach((s, i) => {
      ctx.fillStyle = '#92aea7';
      ctx.fillText(s, 589, 81 + i * 29);
      ctx.fillStyle = '#344d43';
      ctx.fillRect(641, 73 + i * 29, 90, 6);
      ctx.fillStyle = '#a5bc8b';
      ctx.fillRect(641, 73 + i * 29, 90 * T.MathUtils.clamp(systems[i], 0, 1), 6);
    });
    texture.needsUpdate = true;
  }
  return { group, update };
}
