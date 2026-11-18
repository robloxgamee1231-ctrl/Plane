import { localProfilesOnly } from '../hosting';
import { useState, useEffect } from 'react';
import {
  UserRound,
  LogIn,
  ShieldCheck,
  Cloud,
  Timer,
  Plane,
  LogOut,
  Database,
  LoaderCircle,
  UserPlus,
} from 'lucide-react';
import type { User, PilotState } from '../data';
import { clock } from '../data';
import { Field, Tag } from './common';
export async function api(path: string, body?: unknown) {
  if (localProfilesOnly) throw Error('This edition saves pilot data on this device.');
  const r = await fetch(
    '/api/' + path,
    body === undefined
      ? {}
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  let v;
  try {
    v = await r.json();
  } catch {
    throw Error('The profile service is unavailable. Guest flight is still available.');
  }
  if (!r.ok) throw Error(v.error || 'Request failed.');
  return v;
}
function PilotStats({ state }: { state: PilotState }) {
  return (
    <div className="profile-stats">
      <div>
        <Plane />
        <b>{state.log.length}</b>
        <small>Flights logged</small>
      </div>
      <div>
        <Timer />
        <b>{clock(state.log.reduce((v, s) => v + s.duration, 0))}</b>
        <small>Flight time</small>
      </div>
      <div>
        <Database />
        <b>{state.scenarios.length}</b>
        <small>Saved scenarios</small>
      </div>
    </div>
  );
}
export function Profile({
  user,
  state,
  onAuth,
  onLogout,
  cloud,
}: {
  user: User | null;
  state: PilotState;
  onAuth: (u: User, s: unknown, register: boolean) => void;
  onLogout: () => Promise<void>;
  cloud: string;
}) {
  const [mode, setMode] = useState('Sign in'),
    [name, setName] = useState(''),
    [password, setPass] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [admin, setAdmin] = useState<any>(null),
    [confirmRevoke, revoke] = useState(''),
    [adminMsg, setAdminMsg] = useState('');
  useEffect(() => {
    if (!localProfilesOnly && user?.role === 'owner')
      api('admin')
        .then(setAdmin)
        .catch((e) => setError(e.message));
  }, [user]);
  if (localProfilesOnly)
    return (
      <div className="dialog-padding">
        <div className="profile-hero">
          <span className="big-avatar">GP</span>
          <div>
            <Tag>LOCAL PROFILE</Tag>
            <h2>Guest pilot</h2>
            <p>
              <Database size={13} /> Saved on this device
            </p>
          </div>
        </div>
        <PilotStats state={state} />
        <p className="muted">
          Your flight setup, saved scenarios, and replays stay in this browser. No account is needed to
          fly.
        </p>
      </div>
    );
  if (user)
    return (
      <div className="dialog-padding">
        <div className="profile-hero">
          <span className="big-avatar">{user.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <Tag>{user.role === 'owner' ? 'SYSTEM OWNER' : 'REGISTERED PILOT'}</Tag>
            <h2>{user.name}</h2>
            <p>
              <Cloud size={13} /> {cloud === 'Saved' ? 'Cloud profile synchronized' : cloud}
            </p>
          </div>
        </div>
        <PilotStats state={state} />
        {admin && (
          <div className="admin-panel">
            <h3>
              <ShieldCheck size={16} />
              Owner console
            </h3>
            <p>
              {admin.pilots.length} pilot profiles · {admin.sessions} active sessions
            </p>
            <div>
              {admin.pilots.map((p: User) => (
                <span key={p.name}>
                  {p.name}
                  <Tag>{p.role}</Tag>
                  {p.role !== 'owner' && (
                    <button
                      className="text-btn"
                      onClick={async () => {
                        if (confirmRevoke !== p.name) {
                          revoke(p.name);
                          return;
                        }
                        try {
                          const r = await api('admin/revoke', { pilot: p.name });
                          setAdmin(await api('admin'));
                          setAdminMsg(`${r.revoked} session(s) revoked for ${p.name}.`);
                        } catch (e) {
                          setError((e as Error).message);
                        }
                        revoke('');
                      }}
                    >
                      {confirmRevoke === p.name ? 'Confirm sign-out' : 'Revoke sessions'}
                    </button>
                  )}
                </span>
              ))}
            </div>
            {adminMsg && <p role="status">{adminMsg}</p>}
          </div>
        )}
        <div className="dialog-foot">
          <button
            className="btn secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onLogout();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  return (
    <form
      className="dialog-padding"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          const r = await api(mode === 'Sign in' ? 'login' : 'register', { name, password });
          onAuth(r.user, r.state, mode !== 'Sign in');
          setPass('');
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="auth-intro">
        <span>
          <UserRound size={23} />
        </span>
        <p>
          Create a pilot profile to sync your flight setup, statistics, and saved scenarios across
          devices.
        </p>
      </div>
      <div className="segmented auth-tabs">
        {['Sign in', 'Create account'].map((m) => (
          <button
            type="button"
            key={m}
            className={mode === m ? 'active' : ''}
            onClick={() => {
              setMode(m);
              setError('');
            }}
          >
            {m}
          </button>
        ))}
      </div>
      <Field label="Pilot name">
        <input
          autoComplete="username"
          required
          minLength={3}
          maxLength={24}
          pattern="[A-Za-z0-9_\-]+"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your callsign"
        />
      </Field>
      <Field label="Password">
        <input
          type="password"
          autoComplete={mode === 'Sign in' ? 'current-password' : 'new-password'}
          required
          minLength={8}
          maxLength={128}
          value={password}
          onChange={(e) => setPass(e.target.value)}
          placeholder="At least 8 characters"
        />
      </Field>
      {error && (
        <div className="error-text" role="alert">
          {error}
        </div>
      )}
      <button type="submit" disabled={busy} className="btn orange wide-btn">
        {busy ? (
          <LoaderCircle className="spin" size={15} />
        ) : mode === 'Sign in' ? (
          <LogIn size={15} />
        ) : (
          <UserPlus size={15} />
        )}{' '}
        {mode}
      </button>
      <p className="auth-note">
        <ShieldCheck size={13} />
        Guest flight is always available without an account.
      </p>
    </form>
  );
}
