import { assetUrl } from '../hosting';
import { useState } from 'react';
import {
  Play,
  Mountain,
  Wind,
  BarChart3,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  Plane,
  Map as MapIcon,
  CloudSun,
  SlidersHorizontal,
  ArrowRight,
  Box,
  Layers3,
  UserRound,
  RotateCcw,
  Timer,
  Radio,
  Check,
} from 'lucide-react';
import { features, aircraftBy, mapBy, weatherBy, clock, type Config, type PilotState } from '../data';
import { PageTitle } from './common';
export function Dashboard({
  state,
  launch,
  open,
  go,
  reset,
}: {
  state: PilotState;
  launch: (c: Config, name: string) => void;
  open: (s: string) => void;
  go: (s: string) => void;
  reset: () => void;
}) {
  const [slide, setSlide] = useState(0);
  const f = features[slide];
  const c = state.config,
    p = aircraftBy(c.aircraft),
    map = mapBy(c.map),
    w = weatherBy(c.weather);
  const cards = [
    {
      label: 'AIRCRAFT',
      icon: Plane,
      title: p.name,
      desc: p.type === 'Passenger jet' ? 'Twin-engine passenger jet' : p.type,
      art: p.id === 'stratus' ? assetUrl('art/stratus.jpg') : assetUrl(`art/fleet/${p.id}.jpg`),
      action: 'aircraft',
    },
    {
      label: 'ENVIRONMENT',
      icon: MapIcon,
      title: map.name,
      desc: map.type,
      art: map.art,
      action: 'maps',
    },
    {
      label: 'CONDITIONS',
      icon: CloudSun,
      title: w.name,
      desc: w.desc,
      art: assetUrl('art/weather.jpg'),
      action: 'weather',
    },
  ];
  return (
    <>
      <PageTitle
        tag="SIMULATOR OVERVIEW"
        title="Flight Deck"
        desc="Your command center for flight and destruction simulation."
        action={
          <button className="btn dark quick-launch" onClick={() => launch(c, 'Free flight')}>
            <Play size={14} fill="currentColor" />
            Quick launch
          </button>
        }
      />
      <section className={'feature feature-' + slide} aria-label="Featured scenario">
        <img
          className="feature-image"
          key={f.art}
          src={f.art}
          alt={slide === 0 ? 'A Stratus jet banking above a sunlit alpine valley' : f.name + ' scenery'}
        />
        <div className="feature-shade" />
        <div className="feature-top">
          <span className="feature-badge">
            <i />
            FEATURED SCENARIO
          </span>
          <span className="scenario-id">
            SCN <b>/</b> 00{slide + 1}
          </span>
        </div>
        <div className="feature-copy">
          <h2>{f.name}</h2>
          <p>{f.desc}</p>
          <button
            className="btn orange"
            onClick={() =>
              launch({ ...c, ...f.config, seed: Math.floor(Math.random() * 800000) + 1 }, f.name)
            }
          >
            <Play size={14} fill="currentColor" />
            Launch scenario
          </button>
        </div>
        <div className="feature-bottom">
          <div className="feature-meta">
            <span>
              <Mountain />
              {mapBy(f.config.map).name}
            </span>
            <i />
            <span>
              <Wind />
              {f.tag}
            </span>
            <i />
            <span>
              <BarChart3 />
              {f.level}
            </span>
          </div>
          <div className="carousel-nav">
            <span className="carousel-count">
              0{slide + 1}
              <em> / 03</em>
            </span>
            <button aria-label="Previous featured scenario" onClick={() => setSlide((slide + 2) % 3)}>
              <ChevronLeft />
            </button>
            <button aria-label="Next featured scenario" onClick={() => setSlide((slide + 1) % 3)}>
              <ChevronRight />
            </button>
          </div>
        </div>
      </section>
      <section className="config-section">
        <div className="section-head">
          <div>
            <div className="section-kicker">
              <i />
              PREFLIGHT SETUP
            </div>
            <h2>Flight configuration</h2>
          </div>
          <button className="text-btn" onClick={() => go('scenarios')}>
            <SlidersHorizontal size={14} />
            Open sandbox
            <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="config-grid">
          {cards.map((v, i) => (
            <button className="config-card" key={v.label} onClick={() => open(v.action)}>
              <div className={'config-photo config-photo-' + i + ' ' + (i === 2 ? w.id : '')}>
                <img src={v.art} alt="" />
                <span className="photo-tag">
                  <v.icon size={12} />
                  {v.label}
                </span>
                <span className="photo-id">0{i + 1}</span>
              </div>
              <div className="config-caption">
                <div>
                  <h3>{v.title}</h3>
                  <p>{v.desc}</p>
                </div>
                <span className="circle-arrow">
                  <ArrowUpRight size={16} />
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
      <div className="config-strip">
        <div>
          <span>
            <Box />
            {c.physics} physics
          </span>
          <i />
          <span>
            <Layers3 />
            Real-time destruction
          </span>
          <i />
          <span>
            <UserRound />
            Single player
          </span>
        </div>
        <button onClick={reset}>
          <RotateCcw size={13} />
          Reset setup
        </button>
      </div>
      {state.log.length > 0 && (
        <section className="recent">
          <div className="section-head">
            <h2>Recent flight</h2>
            <button className="text-btn" onClick={() => go('replays')}>
              Flight library
              <ArrowRight size={15} />
            </button>
          </div>
          <div className="recent-row">
            <span className="recent-icon">
              <Plane />
            </span>
            <div>
              <b>{state.log[0].name}</b>
              <p>
                {aircraftBy(state.log[0].aircraft).name} · {mapBy(state.log[0].map).name}
              </p>
            </div>
            <span>
              <Timer size={14} />
              {clock(state.log[0].duration)}
            </span>
            <span>
              <Check size={14} />
              Logged
            </span>
          </div>
        </section>
      )}
      <footer className="page-footer">
        <span>
          <Radio size={12} /> NDX FLIGHT SYSTEMS
        </span>
        <span>
          SIMULATOR BUILD <b>1.0.0</b>
        </span>
      </footer>
    </>
  );
}
