import { assetUrl } from '../hosting';
import { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  ChevronDown,
  Camera,
  CloudSun,
  Timer,
  Maximize2,
  Volume2,
  VolumeX,
  SlidersHorizontal,
  RotateCcw,
  LogOut,
  Clapperboard,
  Keyboard,
  Gauge,
  Layers3,
  ShieldCheck,
  AlertTriangle,
  X,
  Check,
  LoaderCircle,
  ChevronsUp,
  ChevronLeft,
  ChevronRight,
  Flag,
  Plane,
  Radio,
  ArrowRight,
  Mountain,
  MapPin,
  MoveUp,
  MoveDown,
} from 'lucide-react';
import { FlightEngine, emptyTelemetry, cameras, faults } from '../game/engine';
import { saveRecording, type Recording } from '../game/recording';
import {
  clock,
  aircraftBy,
  mapBy,
  weatherBy,
  uniqueId,
  type Config,
  type FlightLog,
  type Settings,
} from '../data';
import { Modal, Key, Eyebrow } from './common';
import { Manual } from './Library';
export type Session = { id: string; name: string; config: Config; record?: Recording };
export default function Flight({
  session,
  settings,
  owner,
  onExit,
  onRestart,
}: {
  session: Session;
  settings: Settings;
  owner: string;
  onExit: (log?: FlightLog) => void;
  onRestart: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    engine = useRef<FlightEngine | null>(null),
    notifyTimer = useRef(0);
  const [hud, setHUD] = useState(emptyTelemetry),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [toast, setToast] = useState(''),
    [panel, setPanel] = useState(''),
    [ending, setEnding] = useState(false),
    [saving, setSaving] = useState(false),
    [saveOnExit, setSaveOnExit] = useState(true),
    [muted, setMuted] = useState(!settings.sound),
    [hints, setHints] = useState(settings.help);
  const c = session.config,
    p = aircraftBy(c.aircraft),
    m = mapBy(c.map),
    replay = !!session.record;
  const notify = (msg: string) => {
    setToast(msg);
    window.clearTimeout(notifyTimer.current);
    notifyTimer.current = window.setTimeout(() => setToast(''), 3100);
  };
  useEffect(() => {
    let ended = false;
    const cv = canvas.current!;
    let e: FlightEngine;
    try {
      e = new FlightEngine(
        cv,
        c,
        settings,
        (v) => {
          if (!ended) setHUD(v);
        },
        (s) => {
          if (!ended) notify(s);
        },
        session.record,
      );
      engine.current = e;
      e.init()
        .then(() => {
          if (!ended) {
            setReady(true);
            if (import.meta.env.DEV) (window as any).__NDX_ENGINE__ = e;
          }
        })
        .catch((err) => {
          if (!ended)
            setError(
              'The simulation could not initialize. Enable WebGL 2 and hardware acceleration, then retry. ' +
                err.message,
            );
        });
    } catch (err) {
      setError(
        'WebGL 2 is required. Turn on hardware acceleration in your browser to enter the 3D world.',
      );
    }
    return () => {
      ended = true;
      e?.destroy();
      window.clearTimeout(notifyTimer.current);
      engine.current = null;
      if (import.meta.env.DEV) delete (window as any).__NDX_ENGINE__;
    };
  }, [session.id]);
  const action = (f: (e: FlightEngine) => void) => {
    const e = engine.current;
    if (e && ready) f(e);
  };
  const openEnd = () => {
    if (replay) {
      onExit();
      return;
    }
    action((e) => {
      e.paused = true;
      e.keys.clear();
      e.publish();
    });
    setPanel('');
    setEnding(true);
  };
  const save = async () => {
    if (!engine.current || replay) return;
    setSaving(true);
    try {
      await saveRecording(engine.current.recording(session.name, owner));
      notify('Recording saved to Flight Replays');
    } catch {
      notify('Replay storage is full or unavailable.');
    } finally {
      setSaving(false);
    }
  };
  const finish = async () => {
    if (saving || !engine.current) return;
    setSaving(true);
    const e = engine.current;
    try {
      if (saveOnExit) await saveRecording(e.recording(session.name, owner));
      const log: FlightLog = {
        id: uniqueId(),
        name: session.name,
        map: c.map,
        aircraft: c.aircraft,
        duration: e.t,
        damage: Math.round(100 - e.hp),
        sections: e.broken.size,
        date: new Date().toISOString(),
      };
      onExit(log);
    } catch {
      notify('Unable to save replay. Uncheck “Save flight replay” to exit without saving.');
      setSaving(false);
    }
  };
  const metric = settings.units === 'Metric';
  const setPanelOr = (s: string) => setPanel(panel === s ? '' : s);
  const actualCamera = () => cameras.indexOf(hud.camera as (typeof cameras)[number]);
  return (
    <main className={'flight-screen ' + (replay ? 'is-replay' : '')}>
      <canvas ref={canvas} className="flight-canvas" aria-label="Interactive 3D aircraft simulation" />
      {!ready && (
        <div
          className="flight-loading"
          style={{
            backgroundImage: `linear-gradient(0deg,rgba(16,27,27,.86),rgba(16,27,27,.6)),url(${m.art})`,
          }}
        >
          <img src={assetUrl('ndx.svg')} alt="NDX" />
          <Eyebrow>SIMULATION ENGINE</Eyebrow>
          <h1>{error ? 'Unable to enter simulation' : 'Preparing your flight'}</h1>
          <p>{error || `${p.name} · ${m.name}`}</p>
          {error ? (
            <button className="btn secondary" onClick={() => onExit()}>
              Return to Flight Deck
            </button>
          ) : (
            <>
              <LoaderCircle className="spin" />
              <button className="loading-cancel" onClick={() => onExit()}>
                Cancel launch
              </button>
            </>
          )}
        </div>
      )}
      {ready && (
        <>
          <div className="flight-top">
            <button className="sim-brand" onClick={openEnd} aria-label="Return to Flight Deck">
              <img src={assetUrl('ndx.svg')} alt="" />
              <b>NDX</b>
            </button>
            <i />
            <div className="sim-heading">
              <small>{replay ? 'REPLAY THEATER' : 'LIVE SIMULATION'}</small>
              <b>{session.name}</b>
            </div>
            <div className="sim-top-right">
              <span className="live-tag">
                <i />
                {replay ? 'REPLAY' : hud.paused ? 'PAUSED' : 'LIVE'}
              </span>
              <span className="sim-time">
                <Timer size={14} />
                {clock(hud.t)}
              </span>
              <button
                title={muted ? 'Enable sound' : 'Mute sound'}
                aria-label={muted ? 'Enable sound' : 'Mute sound'}
                onClick={() => {
                  setMuted(!muted);
                  action((e) => {
                    if (e.audio) e.audio.enabled = muted;
                  });
                }}
              >
                {muted ? <VolumeX /> : <Volume2 />}
              </button>
              <button
                title="Fullscreen"
                aria-label="Fullscreen"
                onClick={() => {
                  if (document.fullscreenElement) void document.exitFullscreen();
                  else
                    document.documentElement
                      .requestFullscreen?.()
                      .catch(() => notify('Fullscreen is not available in this browser view'));
                }}
              >
                <Maximize2 />
              </button>
              <button className="exit-sim" onClick={openEnd}>
                <LogOut />
                {replay ? 'Exit replay' : 'End flight'}
              </button>
            </div>
          </div>
          <div className={'hud-wrap ' + (hud.electrical ? 'power-fault' : '')}>
            <div className="compass">
              <span>W</span>
              <i />
              <i />
              <i />
              <b>{hud.navFault ? '---' : String(Math.round(hud.heading)).padStart(3, '0')}°</b>
              <i />
              <i />
              <i />
              <span>E</span>
              <small>HEADING</small>
            </div>
            <div className="sim-region">
              <span className="hud-eyebrow">
                <MapPin size={12} />
                {m.region}
              </span>
              <b>{m.name}</b>
              <small>
                <CloudSun size={13} />
                {weatherBy(c.weather).name} <em>/</em> {c.time}
              </small>
            </div>
            <div className="sim-plane">
              <small>AIRFRAME</small>
              <b>{p.name}</b>
              <span className={hud.hp < 85 ? 'warning' : ''}>
                <i />
                {hud.status}
              </span>
            </div>
            {!hud.electrical ? (
              <div className="instruments">
                <div className="gauge">
                  <span>
                    <Gauge size={14} />
                    AIRSPEED
                  </span>
                  <b>{Math.round(hud.speed * (metric ? 3.6 : 1.94384))}</b>
                  <small>{metric ? 'KM/H' : 'KTS'}</small>
                </div>
                <div className="gauge">
                  <span>
                    <Mountain size={14} />
                    ALTITUDE
                  </span>
                  <b>{Math.round(hud.alt * (metric ? 1 : 3.28084)).toLocaleString()}</b>
                  <small>{metric ? 'M AGL' : 'FT AGL'}</small>
                </div>
                <div className="gauge compact-gauge">
                  <span>
                    <ChevronsUp size={14} />
                    THROTTLE
                  </span>
                  <b>
                    {hud.throttle}
                    <em>%</em>
                  </b>
                  <div className="hud-bar">
                    <i style={{ width: hud.throttle + '%' }} />
                  </div>
                </div>
                <div className="gauge compact-gauge">
                  <span>
                    <ShieldCheck size={14} />
                    INTEGRITY
                  </span>
                  <b>
                    {Math.round(hud.hp)}
                    <em>%</em>
                  </b>
                  <div className={'hud-bar health ' + (hud.hp < 70 ? 'damaged' : '')}>
                    <i style={{ width: hud.hp + '%' }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="power-message">
                <AlertTriangle />
                Electrical fault · instruments offline
                <br />
                Use Events → Restore systems
              </div>
            )}
            <div
              className="hud-reticle"
              style={{ transform: `translate(-50%,-50%) rotate(${hud.bank * 0.68}deg)` }}
            >
              <i />
              <b />
              <i />
            </div>
            {c.mode === 'Checkpoint challenge' && (
              <div className="challenge-progress">
                <Flag size={15} />
                CHECKPOINTS <b>{hud.gate} / 9</b>
              </div>
            )}
            <div className="physics-counter">
              <span>
                <i />
                {hud.fps} FPS
              </span>
              <span>{hud.bodies} ACTIVE BODIES</span>
              <span>{hud.sections} BROKEN SECTIONS</span>
            </div>
          </div>
          <div className="flight-bottom">
            {toast && (
              <div className="sim-toast" role="status">
                <Radio size={14} />
                {toast}
              </div>
            )}
            {hud.paused && !ending && !replay && (
              <div className="pause-card">
                <Pause size={17} />
                <div>
                  <b>Simulation paused</b>
                  <small>Inspect the scene or resume your flight.</small>
                </div>
                <button className="btn orange" onClick={() => action((e) => e.togglePause())}>
                  <Play size={13} />
                  Resume
                </button>
              </div>
            )}
            {replay && (
              <div className="replay-timeline">
                <div>
                  <Clapperboard size={14} />
                  <b>REPLAY TIMELINE</b>
                  <span>
                    {clock(hud.t - hud.start)} / {clock(hud.end - hud.start)}
                  </span>
                </div>
                <input
                  aria-label="Replay timeline"
                  type="range"
                  min={hud.start}
                  max={Math.max(hud.start + 0.01, hud.end)}
                  step="0.01"
                  value={hud.t}
                  onChange={(e) =>
                    action((sim) => {
                      sim.playing = false;
                      sim.seek(+e.target.value);
                    })
                  }
                />
              </div>
            )}
            {panel === 'events' && (
              <div className="sim-popover">
                <div className="popover-head">
                  <Eyebrow>SCENARIO TOOLS</Eyebrow>
                  <button aria-label="Close events" onClick={() => setPanel('')}>
                    <X size={14} />
                  </button>
                </div>
                <h3>Simulation events</h3>
                <p>Apply a live change to this fictional test world.</p>
                <div className="fault-grid">
                  {faults.map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        action((e) => e.trigger(f));
                        setPanel('');
                      }}
                    >
                      {f}
                      <ArrowRight size={12} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {panel === 'camera' && (
              <div className="sim-popover camera-pop">
                <div className="popover-head">
                  <Eyebrow>VIEW CONTROLS</Eyebrow>
                  <button aria-label="Close cameras" onClick={() => setPanel('')}>
                    <X size={14} />
                  </button>
                </div>
                <h3>Camera mode</h3>
                <div className="camera-grid">
                  {cameras.map((v, i) => (
                    <button
                      className={actualCamera() === i ? 'active' : ''}
                      key={v}
                      onClick={() => {
                        action((e) => e.setCamera(i));
                        setPanel('');
                      }}
                    >
                      <Camera size={14} />
                      {v}
                      {actualCamera() === i && <Check size={12} />}
                    </button>
                  ))}
                </div>
                <p>Drag to orbit or look around. Scroll to zoom.</p>
              </div>
            )}
            <div className="sim-toolbar">
              <button
                className="toolbar-play"
                aria-label={
                  replay
                    ? !hud.playing
                      ? 'Play replay'
                      : 'Pause replay'
                    : hud.paused
                      ? 'Resume simulation'
                      : 'Pause simulation'
                }
                onClick={() =>
                  action((e) => {
                    if (replay && !e.playing && e.replayTime >= e.frames.at(-1)!.t - 0.025)
                      e.seek(e.frames[0].t);
                    e.togglePause();
                  })
                }
              >
                {(replay ? !hud.playing : hud.paused) ? (
                  <Play fill="currentColor" />
                ) : (
                  <Pause fill="currentColor" />
                )}
              </button>
              <button
                className={hud.rate !== 1 ? 'active' : ''}
                onClick={() =>
                  action((e) => e.setRate(hud.rate === 1 ? 0.25 : hud.rate === 0.25 ? 0.5 : 1))
                }
              >
                <Timer />
                {hud.rate}×<span className="hide-narrow"> speed</span>
              </button>
              <i />
              <button onClick={() => setPanelOr('camera')}>
                <Camera />
                {hud.camera}
                <ChevronDown size={11} />
              </button>
              {!replay && (
                <>
                  <button
                    onClick={() => setPanelOr('events')}
                    className={panel === 'events' ? 'active' : ''}
                  >
                    <SlidersHorizontal />
                    Events
                  </button>
                  <button aria-label="Toggle landing gear" onClick={() => action((e) => e.toggleGear())}>
                    <Plane />
                    <span>Gear {hud.gear ? 'down' : 'up'}</span>
                  </button>
                </>
              )}
              <i />
              {!replay && (
                <button disabled={saving} onClick={save}>
                  <Clapperboard />
                  <span>Save replay</span>
                </button>
              )}
              <button
                aria-label="Open flight controls"
                onClick={() => {
                  action((e) => {
                    if (!replay) e.paused = true;
                    e.keys.clear();
                    e.publish();
                  });
                  setPanel('manual');
                }}
              >
                <Keyboard />
              </button>
              <button
                aria-label="Restart simulation"
                onClick={() => {
                  action((e) => {
                    e.paused = true;
                    e.publish();
                  });
                  setPanel('restart');
                }}
              >
                <RotateCcw />
              </button>
            </div>
            {hints && !replay && (
              <div className="flight-hints">
                <span>
                  <Key>W</Key>
                  <Key>S</Key>Pitch
                </span>
                <span>
                  <Key>A</Key>
                  <Key>D</Key>Roll
                </span>
                <span>
                  <Key>Shift</Key>
                  <Key>Ctrl</Key>Throttle
                </span>
                <span>
                  <Key>C</Key>Camera
                </span>
                <span>
                  <Key>G</Key>Gear
                </span>
                <button aria-label="Hide control hints" onClick={() => setHints(false)}>
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
          {!replay && (
            <div className="touch-controls">
              {[
                ['KeyA', ChevronLeft],
                ['KeyS', MoveUp],
                ['KeyW', MoveDown],
                ['KeyD', ChevronRight],
              ].map(([k, I]) => {
                const Icon = I as typeof ChevronLeft;
                return (
                  <button
                    key={k as string}
                    aria-label={'Hold ' + k}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      engine.current?.keys.add(k as string);
                    }}
                    onPointerUp={() => engine.current?.keys.delete(k as string)}
                    onPointerCancel={() => engine.current?.keys.delete(k as string)}
                  >
                    <Icon size={19} />
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
      {panel === 'manual' && (
        <Modal title="Flight controls" kicker="PILOT RESOURCES" onClose={() => setPanel('')}>
          <Manual compact />
          <div className="dialog-foot dialog-padding">
            <button
              className="btn dark"
              onClick={() => {
                setPanel('');
                action((e) => {
                  e.paused = false;
                  e.publish();
                });
              }}
            >
              Return to flight
              <ArrowRight size={14} />
            </button>
          </div>
        </Modal>
      )}
      {panel === 'restart' && (
        <Modal
          title={replay ? 'Restart replay?' : 'Restart this flight?'}
          kicker="SIMULATION CONTROL"
          onClose={() => setPanel('')}
        >
          <div className="dialog-padding">
            <p className="muted">
              {replay
                ? 'Return to the start of this recording.'
                : 'Reset your aircraft and rebuild the environment using the same starting conditions. Unsaved replay data will be lost.'}
            </p>
            <div className="dialog-foot">
              <button className="btn secondary" onClick={() => setPanel('')}>
                Cancel
              </button>
              <button className="btn orange" onClick={onRestart}>
                <RotateCcw size={14} />
                Restart
              </button>
            </div>
          </div>
        </Modal>
      )}
      {ending && (
        <Modal title="Flight debrief" kicker="SESSION SUMMARY" onClose={() => setEnding(false)}>
          <div className="dialog-padding">
            <div className="debrief-title">
              <img src={assetUrl(`art/fleet/${p.id}.jpg`)} alt="" />
              <div>
                <h3>{session.name}</h3>
                <p>
                  {p.name} · {m.name}
                </p>
              </div>
            </div>
            <div className="profile-stats">
              <div>
                <Timer />
                <b>{clock(hud.t)}</b>
                <small>Flight time</small>
              </div>
              <div>
                <ShieldCheck />
                <b>{Math.round(hud.hp)}%</b>
                <small>Airframe integrity</small>
              </div>
              <div>
                <Layers3 />
                <b>{hud.sections}</b>
                <small>Sections released</small>
              </div>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={saveOnExit}
                onChange={(e) => setSaveOnExit(e.target.checked)}
              />
              <span>
                <b>Save flight replay</b>
                <small>
                  Keep the last {Math.max(1, Math.round(hud.end - hud.start))} seconds in your local
                  library.
                </small>
              </span>
            </label>
            {toast.includes('Unable') && <p className="error-text">{toast}</p>}
            <div className="dialog-foot">
              <button
                className="btn secondary"
                onClick={() => {
                  setEnding(false);
                  action((e) => {
                    e.paused = false;
                    e.publish();
                  });
                }}
              >
                Continue flight
              </button>
              <button className="btn orange" disabled={saving} onClick={finish}>
                {saving ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />}Finish
                session
              </button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
