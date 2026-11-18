import { assetUrl } from '../hosting';
import { useState, lazy, Suspense, useEffect } from 'react';
import {
  Search,
  Check,
  ArrowUpRight,
  Play,
  MapPin,
  ChevronRight,
  CloudSun,
  Wind,
  CloudRain,
  Cloudy,
  Bookmark,
  Trash2,
  SlidersHorizontal,
  Clapperboard,
  Timer,
  Save,
  RefreshCw,
  Gamepad2,
  Keyboard,
  Layers3,
  Monitor,
  Volume2,
  Gauge,
  AlertTriangle,
  LoaderCircle,
  Compass,
  Camera,
} from 'lucide-react';
import {
  planes,
  maps,
  conditions,
  modes,
  aircraftBy,
  mapBy,
  weatherBy,
  clock,
  uniqueId,
  type Config,
  type PilotState,
  type SavedScenario,
  type Settings,
} from '../data';
import { Eyebrow, Modal, PageTitle, Tag, Toggle, Empty, Field, Key } from './common';
import { listRecordings, deleteRecording, type Recording } from '../game/recording';
const Preview = lazy(() => import('./Preview'));
const cicons = [CloudSun, Wind, Cloudy, CloudRain];
export function AircraftSelect({
  config,
  apply,
  close,
}: {
  config: Config;
  apply: (c: Partial<Config>) => void;
  close?: () => void;
}) {
  const [which, setWhich] = useState(config.aircraft),
    [search, setSearch] = useState('');
  const p = aircraftBy(which);
  const list = planes.filter((v) => (v.name + v.type).toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="aircraft-selector">
      <div className="airframe-focus">
        <Suspense
          fallback={
            <div className="preview-loading">
              <LoaderCircle className="spin" />
              Loading hangar
            </div>
          }
        >
          <Preview plane={p} />
        </Suspense>
        <div className="airframe-details">
          <div className="inline-tags">
            <Tag>{p.type}</Tag>
            <span className="mono little">AIRFRAME / {p.code}</span>
          </div>
          <h2>{p.name}</h2>
          <p>{p.desc}</p>
          <div className="spec-grid">
            <div>
              <small>WINGSPAN</small>
              <b>
                {p.span} <em>m</em>
              </b>
            </div>
            <div>
              <small>EMPTY MASS</small>
              <b>
                {(p.mass / 1000).toFixed(1)} <em>t</em>
              </b>
            </div>
            <div>
              <small>SEATING</small>
              <b>{p.seats}</b>
            </div>
          </div>
          <button
            className="btn orange"
            onClick={() => {
              apply({ aircraft: p.id });
              close?.();
            }}
          >
            <Check size={15} />
            {which === config.aircraft ? 'Confirm aircraft' : 'Select aircraft'}
          </button>
        </div>
      </div>
      <div className="fleet-list">
        <div className="list-heading">
          <h3>Aircraft collection</h3>
          <span className="mono little">07</span>
        </div>
        <label className="search">
          <Search size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search aircraft"
            aria-label="Search aircraft"
          />
        </label>
        <div className="fleet-rows">
          {list.map((v) => (
            <button
              key={v.id}
              className={'fleet-row ' + (which === v.id ? 'chosen' : '')}
              onClick={() => setWhich(v.id)}
            >
              <img src={assetUrl(`art/fleet/${v.id}.jpg`)} alt="" />
              <span>
                <b>{v.name}</b>
                <small>{v.type}</small>
              </span>
              {which === v.id ? <span className="selected-dot" /> : <ChevronRight size={13} />}
            </button>
          ))}
          {!list.length && <p className="muted">No aircraft match this search.</p>}
        </div>
      </div>
    </div>
  );
}
export function Hangar({
  c,
  apply,
  launch,
}: {
  c: Config;
  apply: (c: Partial<Config>) => void;
  launch: () => void;
}) {
  return (
    <>
      <PageTitle
        tag="FLEET MANAGEMENT"
        title="Aircraft Hangar"
        desc="Inspect the airframes and choose your next aircraft."
        action={
          <button className="btn dark" onClick={launch}>
            <Play size={14} fill="currentColor" />
            Launch flight
          </button>
        }
      />
      <div className="panel flush">
        <AircraftSelect config={c} apply={apply} />
      </div>
      <div className="info-note">
        <Layers3 size={16} />
        <span>
          Seven original airframes. Each has a unique mass, handling profile, and modular structure.
        </span>
      </div>
    </>
  );
}
export function MapsSelect({
  c,
  apply,
  close,
}: {
  c: Config;
  apply: (c: Partial<Config>) => void;
  close?: () => void;
}) {
  const [which, setWhich] = useState(c.map);
  return (
    <>
      <div className="map-grid">
        {maps.map((v, i) => (
          <button
            key={v.id}
            className={'map-card ' + (which === v.id ? 'chosen' : '')}
            onClick={() => setWhich(v.id)}
          >
            <div className="map-img">
              <img src={v.art} alt="" />
              <span className="photo-tag">SECTOR 0{i + 1}</span>
              {which === v.id && (
                <span className="check-float">
                  <Check size={13} />
                </span>
              )}
            </div>
            <div className="map-info">
              <h3>{v.name}</h3>
              <p>{v.type}</p>
              {!close && <small>{v.desc}</small>}
            </div>
          </button>
        ))}
      </div>
      <div className="selector-actions">
        <span>
          <MapPin size={15} />
          {mapBy(which).name} selected
        </span>
        <button
          className="btn orange"
          onClick={() => {
            apply({ map: which });
            close?.();
          }}
        >
          Use environment
          <ArrowUpRight size={15} />
        </button>
      </div>
    </>
  );
}
export function MapsPage({ c, apply }: { c: Config; apply: (c: Partial<Config>) => void }) {
  return (
    <>
      <PageTitle
        tag="WORLD DIRECTORY"
        title="Environments"
        desc="Six fictional worlds, each with its own terrain and destructible structures."
      />
      <MapsSelect c={c} apply={apply} />
    </>
  );
}
export function WeatherSelect({
  c,
  apply,
  close,
}: {
  c: Config;
  apply: (c: Partial<Config>) => void;
  close: () => void;
}) {
  const [weather, setW] = useState(c.weather),
    [time, setT] = useState(c.time),
    [turb, setTb] = useState(c.turbulence);
  return (
    <div className="dialog-padding">
      <div className="weather-banner">
        <img src={assetUrl('art/weather.jpg')} alt="Sunlit cloud formations" />
        <div>
          <CloudSun size={22} />
          <b>Atmosphere control</b>
        </div>
      </div>
      <div className="weather-choices">
        {conditions.map((v, i) => {
          const Icon = cicons[i];
          return (
            <button key={v.id} className={weather === v.id ? 'chosen' : ''} onClick={() => setW(v.id)}>
              <Icon size={19} />
              <div>
                <b>{v.name}</b>
                <small>{v.wind} m/s wind</small>
              </div>
              {weather === v.id && <Check size={14} />}
            </button>
          );
        })}
      </div>
      <div className="form-two">
        <Field label="Time of day">
          <select value={time} onChange={(e) => setT(e.target.value as Config['time'])}>
            {['Daylight', 'Golden hour', 'Twilight'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label={'Turbulence · ' + turb + '%'}>
          <input type="range" min="0" max="100" value={turb} onChange={(e) => setTb(+e.target.value)} />
        </Field>
      </div>
      <div className="dialog-foot">
        <button className="btn secondary" onClick={close}>
          Cancel
        </button>
        <button
          className="btn orange"
          onClick={() => {
            apply({ weather, time, turbulence: turb });
            close();
          }}
        >
          Apply conditions
          <Check size={15} />
        </button>
      </div>
    </div>
  );
}
export function ScenarioLab({
  state,
  update,
  launch,
  notify,
}: {
  state: PilotState;
  update: (s: Partial<PilotState>) => void;
  launch: (c: Config, n: string) => void;
  notify: (s: string) => void;
}) {
  const c = state.config,
    change = (x: Partial<Config>) => update({ config: { ...c, ...x } });
  const [save, setSave] = useState(false),
    [name, setName] = useState(''),
    [tab, setTab] = useState('Editor');
  const preset = (s: SavedScenario) => {
    update({ config: { ...s.config } });
    setTab('Editor');
    notify('Loaded ' + s.name);
  };
  return (
    <>
      <PageTitle
        tag="SANDBOX TOOLS"
        title="Scenario Lab"
        desc="Build a flight from the ground up. Every outcome is simulated."
        action={
          <button
            className="btn secondary"
            onClick={() => {
              setName('');
              setSave(true);
            }}
          >
            <Bookmark size={15} />
            Save scenario
          </button>
        }
      />
      <div className="tabs">
        {['Editor', 'Saved scenarios'].map((v) => (
          <button key={v} className={tab === v ? 'active' : ''} onClick={() => setTab(v)}>
            {v}
            {v === 'Saved scenarios' && <span>{state.scenarios.length}</span>}
          </button>
        ))}
      </div>
      {tab === 'Editor' ? (
        <div className="editor-layout">
          <section className="panel">
            <div className="panel-title">
              <SlidersHorizontal size={18} />
              <h3>Starting conditions</h3>
              <span className="mono little">CFG / 01</span>
            </div>
            <div className="form-grid">
              <Field label="Simulation mode">
                <select
                  value={c.mode}
                  onChange={(e) => {
                    const mode = e.target.value;
                    change({ mode, ...(mode === 'City destruction lab' ? { map: 'metro' } : {}) });
                  }}
                >
                  {modes.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Aircraft">
                <select value={c.aircraft} onChange={(e) => change({ aircraft: e.target.value })}>
                  {planes.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Environment">
                <select value={c.map} onChange={(e) => change({ map: e.target.value })}>
                  {maps.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Weather profile">
                <select value={c.weather} onChange={(e) => change({ weather: e.target.value })}>
                  {conditions.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Flight physics">
                <select
                  value={c.physics}
                  onChange={(e) => change({ physics: e.target.value as Config['physics'] })}
                >
                  <option>Arcade</option>
                  <option>Simulation</option>
                </select>
              </Field>
              <Field label="Time of day">
                <select
                  value={c.time}
                  onChange={(e) => change({ time: e.target.value as Config['time'] })}
                >
                  {['Daylight', 'Golden hour', 'Twilight'].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="form-divider" />
            <Field label={'Start altitude · ' + c.altitude + ' m AGL'}>
              <input
                type="range"
                min="12"
                max="650"
                value={c.altitude}
                onChange={(e) => change({ altitude: +e.target.value })}
              />
            </Field>
            <Field label={'Turbulence intensity · ' + c.turbulence + '%'}>
              <input
                type="range"
                min="0"
                max="100"
                value={c.turbulence}
                onChange={(e) => change({ turbulence: +e.target.value })}
              />
            </Field>
            <Field label="World seed" help="Reuse a seed to repeat terrain and randomized event timing.">
              <span className="input-action">
                <input
                  aria-label="World seed"
                  type="number"
                  min="1"
                  max="999999"
                  value={c.seed}
                  onChange={(e) =>
                    change({ seed: Math.max(1, Math.min(999999, Math.floor(+e.target.value))) })
                  }
                />
                <button
                  aria-label="Randomize world seed"
                  onClick={() => change({ seed: 1 + Math.floor(Math.random() * 999998) })}
                >
                  <RefreshCw size={15} />
                </button>
              </span>
            </Field>
          </section>
          <aside className="briefing panel flush">
            <img src={mapBy(c.map).art} alt="Selected environment" />
            <div className="briefing-copy">
              <Eyebrow>FLIGHT BRIEFING</Eyebrow>
              <h2>{c.mode}</h2>
              <p>
                {
                  (
                    {
                      'Free flight':
                        'Explore the environment at your own pace. Live controls and an optional event panel are always available.',
                      Sandbox:
                        'An open test flight. Activate fictional system faults and structural tests from the events panel.',
                      'Random disaster':
                        'Randomized faults occur during flight. Adapt your inputs and observe how each system responds.',
                      'Aircraft damage lab':
                        'An engine fault begins six seconds after launch. Inspect the response, release panels, or introduce structural fatigue.',
                      'City destruction lab':
                        'A structural stress test begins after four seconds. The observer camera follows the failing modules into the aftermath.',
                      'Checkpoint challenge':
                        'Fly through nine orange gates along the corridor. Keep the next ring centered and manage your speed.',
                    } as Record<string, string>
                  )[c.mode]
                }
              </p>
              <dl>
                <dt>Aircraft</dt>
                <dd>{aircraftBy(c.aircraft).name}</dd>
                <dt>Region</dt>
                <dd>{mapBy(c.map).name}</dd>
                <dt>Conditions</dt>
                <dd>{weatherBy(c.weather).name}</dd>
                <dt>Flight model</dt>
                <dd>{c.physics}</dd>
              </dl>
              <button className="btn orange wide-btn" onClick={() => launch(c, c.mode)}>
                <Play size={14} fill="currentColor" />
                Launch simulation
              </button>
            </div>
          </aside>
        </div>
      ) : state.scenarios.length ? (
        <div className="saved-list">
          {state.scenarios.map((s) => (
            <div className="saved-row" key={s.id}>
              <img src={mapBy(s.config.map).art} alt="" />
              <div>
                <Tag>SCENARIO PRESET</Tag>
                <h3>{s.name}</h3>
                <p>
                  {aircraftBy(s.config.aircraft).name} · {mapBy(s.config.map).name}
                </p>
              </div>
              <button className="btn secondary" onClick={() => preset(s)}>
                Load preset
              </button>
              <button
                className="iconbtn"
                aria-label={'Delete ' + s.name}
                onClick={() => {
                  update({ scenarios: state.scenarios.filter((v) => v.id !== s.id) });
                  notify('Preset removed');
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          icon={<Bookmark />}
          title="Your scenario library"
          desc="Save a configuration from the editor to return to the same aircraft, world, and starting conditions."
          action="Open editor"
          onClick={() => setTab('Editor')}
        />
      )}
      {save && (
        <Modal title="Save scenario" kicker="PRESET LIBRARY" onClose={() => setSave(false)}>
          <form
            className="dialog-padding"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              update({
                scenarios: [
                  {
                    id: uniqueId(),
                    name: name.trim(),
                    config: { ...c },
                    created: new Date().toISOString(),
                  },
                  ...state.scenarios,
                ].slice(0, 32),
              });
              setSave(false);
              notify('Scenario saved');
            }}
          >
            <Field label="Scenario name">
              <input
                required
                maxLength={48}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Coastal crosswind test"
              />
            </Field>
            <p className="muted">
              Saves your current aircraft, environment, flight mode, and world seed.
            </p>
            <div className="dialog-foot">
              <button className="btn orange" type="submit">
                <Save size={14} />
                Save preset
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
export function SettingsPage({ s, update }: { s: Settings; update: (v: Partial<Settings>) => void }) {
  return (
    <>
      <PageTitle
        tag="SYSTEM PREFERENCES"
        title="Settings"
        desc="Tune the simulator to your hardware and flying style."
      />
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-title">
            <Monitor size={18} />
            <h3>Graphics</h3>
          </div>
          <Field
            label="Graphics preset"
            help="Sets shadow detail, render resolution, scenery density, and the active debris-body budget."
          >
            <div className="segmented">
              {(['Low', 'Medium', 'High', 'Ultra'] as const).map((q) => (
                <button
                  key={q}
                  className={q === s.quality ? 'active' : ''}
                  onClick={() => update({ quality: q })}
                >
                  {q}
                </button>
              ))}
            </div>
          </Field>
          <div className="setting-row">
            <span>
              <b>Adaptive resolution</b>
              <small>Reduce pixel density if frame rate drops.</small>
            </span>
            <Toggle
              label="Adaptive resolution"
              value={s.adaptive}
              onChange={(adaptive) => update({ adaptive })}
            />
          </div>
          <div className="budget">
            <Layers3 size={17} />
            <span>Active debris budget</span>
            <b>{{ Low: 24, Medium: 48, High: 80, Ultra: 120 }[s.quality]} bodies</b>
          </div>
        </section>
        <section className="panel">
          <div className="panel-title">
            <Volume2 size={18} />
            <h3>Audio</h3>
          </div>
          <div className="setting-row">
            <span>
              <b>Simulator audio</b>
              <small>Engines, atmosphere, impacts, and UI tones.</small>
            </span>
            <Toggle label="Simulator audio" value={s.sound} onChange={(sound) => update({ sound })} />
          </div>
          <Field label={'Master volume · ' + s.volume + '%'}>
            <input
              type="range"
              min="0"
              max="100"
              value={s.volume}
              onChange={(e) => update({ volume: +e.target.value })}
            />
          </Field>
        </section>
        <section className="panel">
          <div className="panel-title">
            <Gamepad2 size={18} />
            <h3>Flight controls</h3>
          </div>
          <Field label={'Control sensitivity · ' + s.sensitivity.toFixed(1) + '×'}>
            <input
              type="range"
              min="0.5"
              max="1.8"
              step="0.1"
              value={s.sensitivity}
              onChange={(e) => update({ sensitivity: +e.target.value })}
            />
          </Field>
          <div className="setting-row">
            <span>
              <b>In-flight control hints</b>
              <small>Display the compact keyboard guide.</small>
            </span>
            <Toggle
              label="In-flight control hints"
              value={s.help}
              onChange={(help) => update({ help })}
            />
          </div>
        </section>
        <section className="panel">
          <div className="panel-title">
            <Gauge size={18} />
            <h3>Instrumentation</h3>
          </div>
          <Field
            label="Measurement units"
            help={
              s.units === 'Aviation'
                ? 'Speed in knots, altitude in feet above ground.'
                : 'Speed in kilometers per hour, altitude in meters above ground.'
            }
          >
            <div className="segmented">
              <button
                className={s.units === 'Aviation' ? 'active' : ''}
                onClick={() => update({ units: 'Aviation' })}
              >
                Aviation
              </button>
              <button
                className={s.units === 'Metric' ? 'active' : ''}
                onClick={() => update({ units: 'Metric' })}
              >
                Metric
              </button>
            </div>
          </Field>
        </section>
      </div>
      <div className="info-note">
        <Check size={16} />
        Preferences save automatically and apply to your next flight.
      </div>
    </>
  );
}
const commands = [
  ['W / ↑', 'Pitch nose down'],
  ['S / ↓', 'Pitch nose up'],
  ['A / D', 'Roll left / right'],
  ['Q / E', 'Rudder left / right'],
  ['Shift', 'Increase throttle'],
  ['Ctrl / −', 'Decrease throttle'],
  ['Space', 'Airbrake / ground brake'],
  ['G', 'Toggle landing gear'],
  ['C', 'Cycle camera'],
  ['T', 'Toggle ¼× slow motion'],
  ['P / Esc', 'Pause or resume'],
  ['F', 'Trigger a random fault'],
];
export function Manual({ compact = false }: { compact?: boolean }) {
  return (
    <>
      {!compact && (
        <PageTitle
          tag="PILOT RESOURCES"
          title="Flight Manual"
          desc="The essentials for your first flight and your next experiment."
        />
      )}
      <div className={compact ? 'manual-content dialog-padding' : 'manual-content'}>
        <div className="manual-banner">
          <span className="manual-symbol">
            <Compass size={28} />
          </span>
          <div>
            <b>Start in the air</b>
            <p>
              Every flight begins at cruise speed. Use small inputs, bank to turn, and keep the horizon
              level.
            </p>
          </div>
        </div>
        <div className="panel">
          <div className="panel-title">
            <Keyboard size={18} />
            <h3>Flight controls</h3>
          </div>
          <div className="key-grid">
            {commands.map(([k, v]) => (
              <div key={k}>
                <Key>{k}</Key>
                <span>{v}</span>
              </div>
            ))}
          </div>
        </div>
        {!compact && (
          <div className="manual-cards">
            <section className="panel">
              <Camera />
              <h3>Camera & observation</h3>
              <p>
                Drag the world to orbit; scroll to change distance. In Free camera, drag to look and use
                W/A/S/D to move. Q/E changes height. Hold Shift to travel faster.
              </p>
            </section>
            <section className="panel">
              <Layers3 />
              <h3>Physical destruction</h3>
              <p>
                Each unoccupied test building has supported structural modules. Contacts or a stress test
                release panels and floor slabs. Unsupported sections fall under gravity, leaving
                persistent rubble.
              </p>
            </section>
            <section className="panel">
              <Clapperboard />
              <h3>Flight recorder</h3>
              <p>
                Save a replay from the HUD or end-flight debrief. The recorder keeps about 90 seconds of
                positions, component separation, and structural events. Scrub the timeline and change
                camera angles.
              </p>
            </section>
            <section className="panel">
              <AlertTriangle />
              <h3>Fictional test environment</h3>
              <p>
                These simplified airframes, flight dynamics, and structural rules are built for play, not
                aviation training. All test sites are fictional and unoccupied.
              </p>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
export function ReplaysPage({
  owner,
  play,
  go,
}: {
  owner: string;
  play: (r: Recording) => void;
  go: () => void;
}) {
  const [items, setItems] = useState<Recording[]>([]),
    [loading, setLoading] = useState(true),
    [err, setErr] = useState(''),
    [del, setDel] = useState<Recording | null>(null);
  const reload = () => {
    setLoading(true);
    listRecordings(owner)
      .then(setItems)
      .catch(() => setErr('Replay storage could not be opened. Allow browser storage and retry.'))
      .finally(() => setLoading(false));
  };
  useEffect(reload, [owner]);
  return (
    <>
      <PageTitle
        tag="FLIGHT LIBRARY"
        title="Flight Replays"
        desc="Revisit your flights from a different angle. Every recording is a 3D simulation trace."
      />
      <div className="library-note">
        <Clapperboard size={15} />
        <span>LOCAL RECORDER</span>
        <b>{items.length} / 8 slots</b>
      </div>
      {loading ? (
        <div className="empty-state">
          <LoaderCircle className="spin" />
        </div>
      ) : err ? (
        <Empty
          icon={<AlertTriangle />}
          title="Storage unavailable"
          desc={err}
          action="Retry"
          onClick={reload}
        />
      ) : items.length ? (
        <div className="saved-list">
          {items.map((r) => (
            <div key={r.id} className="saved-row">
              <div className="replay-thumb">
                <img src={mapBy(r.config.map).art} alt="" />
                <span>
                  <Timer size={11} />
                  {clock(r.frames.at(-1)!.t - r.frames[0].t)}
                </span>
              </div>
              <div>
                <Tag>FLIGHT RECORDING</Tag>
                <h3>{r.name}</h3>
                <p>
                  {aircraftBy(r.config.aircraft).name} · {new Date(r.created).toLocaleDateString()}
                </p>
              </div>
              <button className="btn dark" onClick={() => play(r)}>
                <Play size={13} fill="currentColor" />
                Watch replay
              </button>
              <button
                className="iconbtn"
                aria-label={'Delete replay ' + r.name}
                onClick={() => setDel(r)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          icon={<Clapperboard size={28} />}
          title="Your flight recorder is ready"
          desc="Launch a flight and save a recording from the in-flight toolbar. Your latest eight replays stay on this device."
          action="Go to Flight Deck"
          onClick={go}
        />
      )}
      {del && (
        <Modal title="Delete recording?" kicker="LOCAL RECORDER" onClose={() => setDel(null)}>
          <div className="dialog-padding">
            <p>Remove “{del.name}” from this device? This cannot be undone.</p>
            <div className="dialog-foot">
              <button className="btn secondary" onClick={() => setDel(null)}>
                Keep replay
              </button>
              <button
                className="btn orange"
                onClick={async () => {
                  await deleteRecording(del.id);
                  setDel(null);
                  reload();
                }}
              >
                Delete recording
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
