import type { Config } from '../data';
// Transforms use compact fixed-point integers; no input or recorded movie is needed to replay.
export type Pose = [number, number, number, number, number, number, number];
export type DebrisSpec = {
  id: number;
  kind: 'part' | 'block';
  name: string;
  scale: [number, number, number];
  born: number;
};
export type Frame = {
  t: number;
  p: Pose;
  v: number;
  hp: number;
  gear: boolean;
  throttle: number;
  d: [number, ...Pose][];
  gate: number;
};
export type Recording = {
  version: 1;
  id: string;
  name: string;
  created: string;
  config: Config;
  duration: number;
  frames: Frame[];
  parts: DebrisSpec[];
  breaks: [number, number][];
  owner: string;
};
export const pack = (
  p: { x: number; y: number; z: number },
  q: { x: number; y: number; z: number; w: number },
): Pose => [
  Math.round(p.x * 100),
  Math.round(p.y * 100),
  Math.round(p.z * 100),
  Math.round(q.x * 10000),
  Math.round(q.y * 10000),
  Math.round(q.z * 10000),
  Math.round(q.w * 10000),
];
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('NDX-flight-recordings', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('replays', { keyPath: 'id' });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function listRecordings(owner: string) {
  const db = await database();
  const all = await new Promise<Recording[]>((resolve, reject) => {
    const r = db.transaction('replays').objectStore('replays').getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  db.close();
  return all.filter((r) => r.owner === owner).sort((a, b) => b.created.localeCompare(a.created));
}
export async function saveRecording(rec: Recording) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('replays', 'readwrite');
    tx.objectStore('replays').put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  const old = await listRecordings(rec.owner);
  for (const r of old.slice(8)) await deleteRecording(r.id);
}
export async function deleteRecording(id: string) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('replays', 'readwrite');
    tx.objectStore('replays').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
