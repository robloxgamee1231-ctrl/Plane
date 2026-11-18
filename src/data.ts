import { assetUrl } from './hosting';
export const planes = [
  {
    id: 'stratus',
    name: 'Stratus NX-220',
    type: 'Passenger jet',
    code: 'NX-220',
    length: 31,
    span: 29,
    radius: 1.55,
    mass: 28000,
    cruise: 70,
    agility: 1,
    strength: 1,
    seats: 78,
    accent: '#de643c',
    desc: 'A balanced twin-engine airliner. Predictable handling and a modular airframe make the Stratus an ideal starting point.',
  },
  {
    id: 'meridian',
    name: 'Meridian H-90',
    type: 'Heavy airliner',
    code: 'H-90',
    length: 47,
    span: 43,
    radius: 2.35,
    mass: 87000,
    cruise: 82,
    agility: 0.65,
    strength: 1.3,
    seats: 184,
    accent: '#dc792f',
    desc: 'A wide-body, four-engine long-haul aircraft. Its considerable inertia rewards smooth, deliberate inputs.',
  },
  {
    id: 'atlas',
    name: 'Atlas C-40',
    type: 'Cargo transport',
    code: 'C-40',
    length: 35,
    span: 38,
    radius: 2.15,
    mass: 56000,
    cruise: 64,
    agility: 0.78,
    strength: 1.5,
    seats: 12,
    accent: '#587e63',
    desc: 'A high-wing freighter with four underslung engines, a broad wing surface, and a reinforced cargo hull.',
  },
  {
    id: 'vela',
    name: 'Vela J-8',
    type: 'Private jet',
    code: 'J-8',
    length: 19,
    span: 17,
    radius: 0.96,
    mass: 8700,
    cruise: 79,
    agility: 1.45,
    strength: 0.85,
    seats: 8,
    accent: '#527cad',
    desc: 'A light business jet with rear-mounted engines. Fast roll response gives this compact aircraft its unmistakable character.',
  },
  {
    id: 'kestrel',
    name: 'Kestrel X-1',
    type: 'Experimental',
    code: 'X-1',
    length: 20,
    span: 24,
    radius: 1.12,
    mass: 11500,
    cruise: 87,
    agility: 1.55,
    strength: 0.9,
    seats: 4,
    accent: '#cca044',
    desc: 'An experimental swept-wing testbed built for sharp turns and high-altitude sandbox experiments.',
  },
  {
    id: 'solace',
    name: 'Solace P-6',
    type: 'Vintage propeller',
    code: 'P-6',
    length: 14,
    span: 16,
    radius: 0.83,
    mass: 3700,
    cruise: 46,
    agility: 1.22,
    strength: 0.76,
    seats: 6,
    accent: '#9e5040',
    desc: 'A heritage-inspired twin propeller with low cruising speed, a narrow cabin, and wonderfully gentle handling.',
  },
  {
    id: 'aether',
    name: 'Aether V-12',
    type: 'Future concept',
    code: 'V-12',
    length: 29,
    span: 36,
    radius: 1.3,
    mass: 21800,
    cruise: 93,
    agility: 1.32,
    strength: 1.14,
    seats: 24,
    accent: '#40989e',
    desc: 'A forward-looking research airframe with extended winglets, a slender composite hull, and responsive control surfaces.',
  },
];
export type Plane = (typeof planes)[number];
export const maps = [
  {
    id: 'airport',
    name: 'NDX International',
    type: 'International airport',
    region: 'Sector 01',
    art: assetUrl('art/airport.jpg'),
    desc: 'Parallel taxiways, modular terminals, maintenance hangars, and a working flight corridor.',
  },
  {
    id: 'metro',
    name: 'NDX Metropolis',
    type: 'Urban district',
    region: 'Sector 02',
    art: assetUrl('art/metropolis.jpg'),
    desc: 'An unoccupied riverside test city with glass towers, low-rise blocks, boulevards, and bridges.',
  },
  {
    id: 'coast',
    name: 'Coastline',
    type: 'Coastal archipelago',
    region: 'Sector 03',
    art: assetUrl('art/coast.jpg'),
    desc: 'Follow the edge of the sea past sandy beaches, coastal villages, and a cliffside airfield.',
  },
  {
    id: 'desert',
    name: 'Desert Valley',
    type: 'Industrial desert',
    region: 'Sector 04',
    art: assetUrl('art/desert.jpg'),
    desc: 'A desert research campus surrounded by copper mesas, dusty access roads, and modular warehouses.',
  },
  {
    id: 'alpine',
    name: 'Mountain Range',
    type: 'Alpine wilderness',
    region: 'Sector 05',
    art: assetUrl('art/alpine-flight.jpg'),
    desc: 'A broad valley between snow-capped peaks, evergreen forests, and a small mountain settlement.',
  },
  {
    id: 'future',
    name: 'Future City',
    type: 'Futuristic metropolis',
    region: 'Sector 06',
    art: assetUrl('art/future.jpg'),
    desc: 'Fly between luminous stepped towers and elevated crossings in a blue-hour simulation district.',
  },
];
export const conditions = [
  { id: 'clear', name: 'Clear skies', wind: 3, desc: 'Light winds · Unlimited visibility' },
  { id: 'crosswind', name: 'Crosswind', wind: 13, desc: 'Steady gusts · Good visibility' },
  { id: 'overcast', name: 'Overcast', wind: 7, desc: 'Cloud cover · Soft daylight' },
  { id: 'storm', name: 'Storm front', wind: 21, desc: 'Heavy turbulence · Reduced visibility' },
];
export const modes = [
  'Free flight',
  'Sandbox',
  'Random disaster',
  'Aircraft damage lab',
  'City destruction lab',
  'Checkpoint challenge',
];
export type Config = {
  aircraft: string;
  map: string;
  weather: string;
  mode: string;
  physics: 'Arcade' | 'Simulation';
  time: 'Daylight' | 'Golden hour' | 'Twilight';
  altitude: number;
  turbulence: number;
  seed: number;
};
export const defaultConfig: Config = {
  aircraft: 'stratus',
  map: 'airport',
  weather: 'clear',
  mode: 'Free flight',
  physics: 'Arcade',
  time: 'Daylight',
  altitude: 120,
  turbulence: 20,
  seed: 2201,
};
export type Settings = {
  quality: 'Low' | 'Medium' | 'High' | 'Ultra';
  volume: number;
  sound: boolean;
  help: boolean;
  units: 'Aviation' | 'Metric';
  sensitivity: number;
  adaptive: boolean;
};
export const defaultSettings: Settings = {
  quality: 'High',
  volume: 45,
  sound: true,
  help: true,
  units: 'Aviation',
  sensitivity: 1,
  adaptive: true,
};
export const features = [
  {
    name: 'Alpine Approach',
    desc: 'Take the Stratus NX-220 through a mountain corridor with shifting crosswinds.',
    art: assetUrl('art/alpine-flight.jpg'),
    tag: 'Crosswind',
    level: 'Intermediate',
    config: {
      map: 'alpine',
      aircraft: 'stratus',
      weather: 'crosswind',
      time: 'Golden hour',
      altitude: 190,
      turbulence: 38,
      mode: 'Sandbox',
    },
  },
  {
    name: 'Coastal Circuit',
    desc: 'Follow a sunlit coastline in the nimble Vela J-8. Clear skies, open water, and room to explore.',
    art: assetUrl('art/coast.jpg'),
    tag: 'Clear skies',
    level: 'Easy',
    config: {
      map: 'coast',
      aircraft: 'vela',
      weather: 'clear',
      time: 'Daylight',
      altitude: 145,
      turbulence: 10,
      mode: 'Checkpoint challenge',
    },
  },
  {
    name: 'After Hours',
    desc: 'Explore an illuminated test city after sunset in the experimental Aether V-12.',
    art: assetUrl('art/future.jpg'),
    tag: 'Overcast',
    level: 'Advanced',
    config: {
      map: 'future',
      aircraft: 'aether',
      weather: 'overcast',
      time: 'Twilight',
      altitude: 185,
      turbulence: 28,
      mode: 'Sandbox',
    },
  },
] as const;
export type SavedScenario = { id: string; name: string; config: Config; created: string };
export type FlightLog = {
  id: string;
  name: string;
  map: string;
  aircraft: string;
  duration: number;
  damage: number;
  sections: number;
  date: string;
};
export type PilotState = {
  config: Config;
  settings: Settings;
  scenarios: SavedScenario[];
  log: FlightLog[];
};
export type User = { name: string; role: 'pilot' | 'owner' };
const numeric = (v: unknown, fallback: number, lo: number, hi: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
export function cleanConfig(value: Partial<Config> | null | undefined): Config {
  const v = value || {},
    d = defaultConfig;
  return {
    aircraft: planes.some((p) => p.id === v.aircraft) ? v.aircraft! : d.aircraft,
    map: maps.some((p) => p.id === v.map) ? v.map! : d.map,
    weather: conditions.some((p) => p.id === v.weather) ? v.weather! : d.weather,
    mode: modes.includes(v.mode || '') ? v.mode! : d.mode,
    physics: v.physics === 'Simulation' ? 'Simulation' : 'Arcade',
    time: v.time === 'Golden hour' || v.time === 'Twilight' ? v.time : 'Daylight',
    altitude: numeric(v.altitude, d.altitude, 12, 800),
    turbulence: numeric(v.turbulence, d.turbulence, 0, 100),
    seed: Math.floor(numeric(v.seed, d.seed, 1, 999999)),
  };
}
export function validState(s: any): PilotState {
  const q = s?.settings || {},
    d = defaultSettings;
  return {
    config: cleanConfig(s?.config),
    settings: {
      quality: ['Low', 'Medium', 'High', 'Ultra'].includes(q.quality) ? q.quality : d.quality,
      volume: numeric(q.volume, d.volume, 0, 100),
      sound: typeof q.sound === 'boolean' ? q.sound : d.sound,
      help: typeof q.help === 'boolean' ? q.help : d.help,
      units: q.units === 'Metric' ? 'Metric' : 'Aviation',
      sensitivity: numeric(q.sensitivity, d.sensitivity, 0.5, 1.8),
      adaptive: typeof q.adaptive === 'boolean' ? q.adaptive : d.adaptive,
    },
    scenarios: Array.isArray(s?.scenarios)
      ? s.scenarios
          .filter((v: any) => v && typeof v.name === 'string' && typeof v.id === 'string')
          .slice(0, 32)
          .map((v: SavedScenario) => ({
            id: v.id,
            name: v.name.slice(0, 48),
            config: cleanConfig(v.config),
            created: v.created,
          }))
      : [],
    log: Array.isArray(s?.log)
      ? s.log
          .filter(
            (v: any) =>
              v && typeof v.id === 'string' && typeof v.name === 'string' && Number.isFinite(v.duration),
          )
          .slice(0, 64)
      : [],
  };
}
export function loadLocal(key = 'guest'): PilotState {
  try {
    return validState(JSON.parse(localStorage.getItem('ndx.pilot.' + key) || '{}'));
  } catch {
    return validState({});
  }
}
export const clock = (s: number) =>
  `${Math.floor(s / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(s % 60)
    .toString()
    .padStart(2, '0')}`;
export const aircraftBy = (id: string) => planes.find((p) => p.id === id) || planes[0];
export const mapBy = (id: string) => maps.find((p) => p.id === id) || maps[0];
export const weatherBy = (id: string) => conditions.find((p) => p.id === id) || conditions[0];
export const uniqueId = () =>
  crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
