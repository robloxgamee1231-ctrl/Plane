import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scrypt as scryptCb, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const scrypt = promisify(scryptCb),
  hash = (t) => createHash('sha256').update(t).digest('hex');
export function createApi(directory = process.env.NDX_DATA_DIR || '.data') {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(resolve(directory, 'flight.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL;PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS pilots(id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE COLLATE NOCASE,salt TEXT NOT NULL,pass TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'pilot',state TEXT NOT NULL DEFAULT '{}',created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,pilot INTEGER NOT NULL REFERENCES pilots(id),expires INTEGER NOT NULL);`);
  if (!db.prepare('SELECT id FROM pilots WHERE name=?').get('NDX')) {
    let pass = process.env.NDX_OWNER_PASSWORD_FILE
      ? readFileSync(process.env.NDX_OWNER_PASSWORD_FILE, 'utf8').trim()
      : process.env.NDX_OWNER_PASSWORD;
    if (!pass) {
      if (process.env.NODE_ENV === 'production')
        throw Error('Set NDX_OWNER_PASSWORD (at least 16 characters) for the first production boot.');
      pass = randomBytes(24).toString('base64url');
      writeFileSync(resolve(directory, 'owner-bootstrap.txt'), pass + '\n', { mode: 0o600 });
    }
    if (pass.length < 16) throw Error('Owner bootstrap password must contain at least 16 characters.');
    const salt = randomBytes(16).toString('hex');
    db.prepare('INSERT INTO pilots(name,salt,pass,role)VALUES(?,?,?,?)').run(
      'NDX',
      salt,
      scryptSync(pass, salt, 64).toString('hex'),
      'owner',
    );
  }
  db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
  const attempts = new Map();
  const api = async (req, res, next) => {
    const path = (req.url || '').split('?')[0];
    if (!path.startsWith('/api/')) return next?.();
    const json = (code, data) => {
      res.writeHead(code, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(JSON.stringify(data));
    };
    try {
      const token = (req.headers.cookie || '').match(/(?:^|;\s*)ndx_session=([a-f0-9]{64})(?:;|$)/)?.[1];
      const user =
        token &&
        db
          .prepare(
            'SELECT p.* FROM sessions s JOIN pilots p ON p.id=s.pilot WHERE token=? AND expires>?',
          )
          .get(hash(token), Date.now());
      const view = (u) => (u ? { name: u.name, role: u.role } : null);
      if (req.method === 'GET') {
        if (path === '/api/health') return json(200, { status: 'online', version: '1.0.0' });
        if (path === '/api/me')
          return json(200, { user: view(user), state: user ? JSON.parse(user.state) : null });
        if (path === '/api/admin') {
          if (user?.role !== 'owner') return json(403, { error: 'Owner access required.' });
          return json(200, {
            pilots: db.prepare('SELECT name,role,created FROM pilots ORDER BY id DESC LIMIT 100').all(),
            sessions: db.prepare('SELECT count(*) AS n FROM sessions WHERE expires>?').get(Date.now()).n,
          });
        }
        return json(404, { error: 'Endpoint not found.' });
      }
      if (req.method !== 'POST') return json(405, { error: 'Method not supported.' });
      if (!req.headers['content-type']?.startsWith('application/json'))
        return json(415, { error: 'JSON required.' });
      if (req.headers['sec-fetch-site'] === 'cross-site')
        return json(403, { error: 'Same-site requests only.' });
      let input = '';
      for await (const chunk of req) {
        input += chunk;
        if (Buffer.byteLength(input) > 400000) return json(413, { error: 'Save file is too large.' });
      }
      let b;
      try {
        b = JSON.parse(input || '{}');
      } catch {
        return json(400, { error: 'Invalid JSON.' });
      }
      if (!b || typeof b !== 'object' || Array.isArray(b))
        return json(400, { error: 'Invalid payload.' });
      const secure = !!req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
      const cookie = (t, age) =>
        `ndx_session=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${secure ? '; Secure' : ''}`;
      if (path === '/api/register' || path === '/api/login') {
        const ip = req.socket.remoteAddress || 'local';
        let rat = attempts.get(ip);
        if (!rat || rat.expires < Date.now()) {
          rat = { n: 0, expires: Date.now() + 60000 };
          attempts.set(ip, rat);
        }
        if (++rat.n > 35) return json(429, { error: 'Too many attempts. Try again in one minute.' });
        const name = String(b.name || '').trim(),
          pass = typeof b.password === 'string' ? b.password : '';
        if (!/^[a-zA-Z0-9_-]{3,24}$/.test(name) || pass.length < 8 || pass.length > 128)
          return json(400, {
            error: 'Use a 3–24 character pilot name and an 8–128 character password.',
          });
        let found = db.prepare('SELECT * FROM pilots WHERE name=?').get(name);
        if (path === '/api/register') {
          if (found) return json(409, { error: 'That pilot name is already registered.' });
          const salt = randomBytes(16).toString('hex'),
            p = (await scrypt(pass, salt, 64)).toString('hex');
          try {
            db.prepare('INSERT INTO pilots(name,salt,pass) VALUES(?,?,?)').run(name, salt, p);
          } catch {
            return json(409, { error: 'That pilot name is already registered.' });
          }
          found = db.prepare('SELECT * FROM pilots WHERE name=?').get(name);
        } else {
          const computed = await scrypt(pass, found?.salt || 'ndx-unknown-salt', 64);
          if (!found || !timingSafeEqual(computed, Buffer.from(found.pass, 'hex')))
            return json(401, { error: 'Pilot name or password is incorrect.' });
        }
        const t = randomBytes(32).toString('hex');
        db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(
          hash(t),
          found.id,
          Date.now() + 7 * 86400000,
        );
        res.setHeader('Set-Cookie', cookie(t, 604800));
        return json(200, { user: view(found), state: JSON.parse(found.state) });
      }
      if (path === '/api/logout') {
        if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token));
        res.setHeader('Set-Cookie', cookie('', 0));
        return json(200, { ok: true });
      }
      if (!user) return json(401, { error: 'Sign in to sync your profile.' });
      if (path === '/api/admin/revoke') {
        if (user.role !== 'owner') return json(403, { error: 'Owner access required.' });
        if (typeof b.pilot !== 'string') return json(400, { error: 'Choose a pilot.' });
        const target = db.prepare('SELECT id,role FROM pilots WHERE name=?').get(b.pilot);
        if (!target || target.role === 'owner') return json(400, { error: 'Select a non-owner pilot.' });
        const r = db.prepare('DELETE FROM sessions WHERE pilot=?').run(target.id);
        return json(200, { ok: true, revoked: r.changes });
      }
      if (path === '/api/save') {
        if (
          !b.config ||
          !b.settings ||
          !Array.isArray(b.scenarios) ||
          !Array.isArray(b.log) ||
          b.scenarios.length > 32 ||
          b.log.length > 64
        )
          return json(400, { error: 'Invalid pilot save.' });
        if (
          !['stratus', 'meridian', 'atlas', 'vela', 'kestrel', 'solace', 'aether'].includes(
            b.config.aircraft,
          ) ||
          !['airport', 'metro', 'coast', 'desert', 'alpine', 'future'].includes(b.config.map)
        )
          return json(400, { error: 'Unknown flight configuration.' });
        const saved = { config: b.config, settings: b.settings, scenarios: b.scenarios, log: b.log };
        db.prepare('UPDATE pilots SET state=? WHERE id=?').run(JSON.stringify(saved), user.id);
        return json(200, { ok: true });
      }
      return json(404, { error: 'Endpoint not found.' });
    } catch (error) {
      console.error('Request failed:', error.message);
      if (!res.headersSent) json(500, { error: 'Unable to complete request.' });
    }
  };
  api.close = () => db.close();
  return api;
}
