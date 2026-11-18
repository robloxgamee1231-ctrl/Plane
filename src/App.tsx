import { localProfilesOnly } from './hosting';
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import {
  PanelLeft,
  ChevronRight,
  ChevronsUpDown,
  Volume2,
  VolumeX,
  Menu,
  X,
  Check,
  Cpu,
  LoaderCircle,
  ArrowUpRight,
} from 'lucide-react';
import { pages, Brand, Modal } from './ui/common';
import { Dashboard } from './ui/Dashboard';
import {
  Hangar,
  MapsPage,
  ScenarioLab,
  SettingsPage,
  Manual,
  ReplaysPage,
  AircraftSelect,
  MapsSelect,
  WeatherSelect,
} from './ui/Library';
import { Profile, api } from './ui/Profile';
import {
  loadLocal,
  validState,
  defaultConfig,
  uniqueId,
  type Config,
  type PilotState,
  type User,
  type Settings,
} from './data';
import { tickSound, audioContext } from './game/audio';
import type { Session } from './ui/Flight';
const Flight = lazy(() => import('./ui/Flight'));
const hashPage = () => {
  const s = location.hash.replace('#', '');
  return pages.some((p) => p.id === s) ? s : 'deck';
};
function UtcClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  return (
    <span className="utc-clock">
      {now.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour12: false })}
      <small>UTC</small>
    </span>
  );
}
export default function App() {
  const [page, setPage] = useState(hashPage),
    [dialog, setDialog] = useState(''),
    [mobile, setMobile] = useState(false),
    [state, setState] = useState<PilotState>(() => loadLocal()),
    [user, setUser] = useState<User | null>(null),
    [hydrated, setHydrated] = useState(false),
    [service, setService] = useState(false),
    [cloud, setCloud] = useState('Local profile'),
    [session, setSession] = useState<Session | null>(null),
    [toast, setToast] = useState('');
  const toastTimer = useRef(0);
  const main = useRef<HTMLElement>(null);
  const owner = user?.name || 'guest';
  const notify = (s: string) => {
    setToast(s);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2900);
  };
  useEffect(() => {
    if (localProfilesOnly) {
      setHydrated(true);
      return;
    }
    let active = true;
    api('me')
      .then((r) => {
        if (!active) return;
        setService(true);
        if (r.user) {
          setUser(r.user);
          setState(r.state?.config ? validState(r.state) : loadLocal(r.user.name));
          setCloud('Saved');
        }
      })
      .catch(() => setService(false))
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem('ndx.pilot.' + owner, JSON.stringify(state));
    } catch {
      notify('Local profile storage is unavailable.');
    }
    if (!user || localProfilesOnly) return;
    setCloud('Syncing…');
    let active = true;
    const timer = setTimeout(
      () =>
        api('save', state)
          .then(() => {
            if (active) setCloud('Saved');
          })
          .catch(() => {
            if (active) setCloud('Saved on this device · sync pending');
          }),
      420,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [state, user, hydrated, owner]);
  useEffect(() => {
    const f = () => {
      setPage(hashPage());
      setDialog('');
      setMobile(false);
      main.current?.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  useEffect(() => {
    document.title =
      (session ? session.name : pages.find((p) => p.id === page)?.label || 'Flight Deck') +
      ' · NDX Flight Disaster';
    window.scrollTo(0, 0);
  }, [page, session]);
  const go = (s: string) => {
    setMobile(false);
    setDialog('');
    location.hash = s;
    setPage(s);
    main.current?.scrollTo({ top: 0 });
  };
  const applyConfig = (c: Partial<Config>) => {
    setState((s) => ({ ...s, config: { ...s.config, ...c } }));
    notify('Flight configuration updated');
    tickSound(state.settings.sound, state.settings.volume);
  };
  const update = (v: Partial<PilotState>) => setState((s) => ({ ...s, ...v }));
  const pref = (v: Partial<Settings>) => setState((s) => ({ ...s, settings: { ...s.settings, ...v } }));
  const launch = (config: Config, name: string) => {
    if (state.settings.sound) audioContext();
    tickSound(state.settings.sound, state.settings.volume);
    setSession({
      id: uniqueId(),
      name: name === 'Free flight' ? config.mode : name,
      config: { ...config },
    });
    setDialog('');
    setToast('');
  };
  const title = pages.find((p) => p.id === page)?.label || 'Flight Deck';
  const initials = user ? user.name.slice(0, 2).toUpperCase() : 'GP';
  if (session)
    return (
      <Suspense
        fallback={
          <div className="initial-load">
            <Brand />
            <LoaderCircle className="spin" />
            <p>Loading simulation engine…</p>
          </div>
        }
      >
        <Flight
          key={session.id}
          session={session}
          settings={state.settings}
          owner={owner}
          onRestart={() => setSession({ ...session, id: uniqueId() })}
          onExit={(log) => {
            if (log) setState((s) => ({ ...s, log: [log, ...s.log].slice(0, 64) }));
            setSession(null);
            if (log) {
              go('deck');
              notify('Flight logged · session complete');
            } else if (session.record) go('replays');
          }}
        />
      </Suspense>
    );
  return (
    <div className="app-shell">
      {mobile && (
        <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobile(false)} />
      )}
      <aside className={'sidebar ' + (mobile ? 'open' : '')}>
        <a
          href="#deck"
          className="brand-link"
          aria-label="NDX Flight Disaster home"
          onClick={() => go('deck')}
        >
          <Brand />
        </a>
        <nav aria-label="Main navigation">
          {['WORKSPACE', 'LIBRARY', 'SYSTEM'].map((group) => (
            <div key={group} className="nav-group">
              <div className="nav-label">{group}</div>
              {pages
                .filter((v) => v.group === group)
                .map((item) => (
                  <button
                    className={'nav-item ' + (item.id === page ? 'active' : '')}
                    aria-current={item.id === page ? 'page' : undefined}
                    key={item.id}
                    onClick={() => go(item.id)}
                  >
                    <item.icon size={17} strokeWidth={1.7} />
                    <span>{item.label}</span>
                    {item.count && <em>{item.count}</em>}
                    {item.id === 'manual' && <ArrowUpRight size={12} className="manual-arrow" />}
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="engine-card">
            <div className="engine-glyph">
              <Cpu size={17} />
            </div>
            <div>
              <small>SIMULATION CORE</small>
              <b>
                NDX Engine <span>1.0</span>
              </b>
            </div>
            <i className="green-dot" />
          </div>
          <button
            className="user-button"
            onClick={() => {
              setDialog('profile');
              setMobile(false);
            }}
          >
            <span className="avatar">{initials}</span>
            <span>
              <b>{user?.name || 'Guest pilot'}</b>
              <small>{user ? 'Cloud profile' : 'Local profile'}</small>
            </span>
            <ChevronsUpDown size={14} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu iconbtn"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumbs">
            <PanelLeft size={16} />
            <span>Workspace</span>
            <ChevronRight size={12} />
            <b>{title}</b>
          </div>
          <div className="top-status">
            <span className="online">
              <i className={'green-dot ' + (!service ? 'local' : '')} />
              {service ? 'System online' : 'Local mode'}
            </span>
            <i className="top-divider" />
            <UtcClock />
            <i className="top-divider secondary-divider" />
            <button
              className="iconbtn top-audio"
              title={state.settings.sound ? 'Mute audio' : 'Enable audio'}
              aria-label={state.settings.sound ? 'Mute audio' : 'Enable audio'}
              onClick={() => {
                pref({ sound: !state.settings.sound });
                tickSound(!state.settings.sound, state.settings.volume);
              }}
            >
              {state.settings.sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          </div>
        </header>
        <main className="workspace-main" ref={main}>
          <div className="content-wrap" key={page}>
            {page === 'deck' ? (
              <Dashboard
                state={state}
                launch={launch}
                open={setDialog}
                go={go}
                reset={() => {
                  setState((s) => ({ ...s, config: { ...defaultConfig } }));
                  notify('Default flight setup restored');
                }}
              />
            ) : page === 'aircraft' ? (
              <Hangar
                c={state.config}
                apply={applyConfig}
                launch={() => launch(state.config, 'Free flight')}
              />
            ) : page === 'maps' ? (
              <MapsPage c={state.config} apply={applyConfig} />
            ) : page === 'scenarios' ? (
              <ScenarioLab state={state} update={update} launch={launch} notify={notify} />
            ) : page === 'settings' ? (
              <SettingsPage s={state.settings} update={pref} />
            ) : page === 'manual' ? (
              <Manual />
            ) : (
              <ReplaysPage
                owner={owner}
                go={() => go('deck')}
                play={(r) => {
                  if (state.settings.sound) audioContext();
                  setSession({ id: uniqueId(), name: r.name, config: { ...r.config }, record: r });
                }}
              />
            )}
          </div>
        </main>
      </div>
      {dialog === 'aircraft' && (
        <Modal wide title="Select aircraft" kicker="AIRCRAFT HANGAR" onClose={() => setDialog('')}>
          <AircraftSelect config={state.config} apply={applyConfig} close={() => setDialog('')} />
        </Modal>
      )}
      {dialog === 'maps' && (
        <Modal wide title="Select environment" kicker="WORLD DIRECTORY" onClose={() => setDialog('')}>
          <div className="dialog-padding">
            <MapsSelect c={state.config} apply={applyConfig} close={() => setDialog('')} />
          </div>
        </Modal>
      )}
      {dialog === 'weather' && (
        <Modal title="Flight conditions" kicker="ATMOSPHERE CONTROL" onClose={() => setDialog('')}>
          <WeatherSelect c={state.config} apply={applyConfig} close={() => setDialog('')} />
        </Modal>
      )}
      {dialog === 'profile' && (
        <Modal
          title={user || localProfilesOnly ? 'Pilot profile' : 'Pilot access'}
          kicker="NDX FLIGHT SYSTEMS"
          onClose={() => setDialog('')}
        >
          <Profile
            state={state}
            user={user}
            cloud={cloud}
            onAuth={(u, stored, register) => {
              setUser(u);
              const st = stored as Partial<PilotState>;
              setState(st?.config ? validState(st) : register ? state : loadLocal(u.name));
              setService(true);
              notify(register ? 'Pilot profile created' : 'Welcome back, ' + u.name);
            }}
            onLogout={async () => {
              await api('save', state);
              await api('logout', {});
              setUser(null);
              setState(loadLocal());
              setCloud('Local profile');
              setDialog('');
              notify('Signed out · guest profile active');
            }}
          />
        </Modal>
      )}
      {toast && (
        <div className="app-toast" role="status">
          <span>
            <Check size={13} />
          </span>
          {toast}
          <button aria-label="Dismiss notification" onClick={() => setToast('')}>
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
