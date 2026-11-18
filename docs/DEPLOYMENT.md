# Deploy the website and account service

## Public play site: GitHub Pages

1. In repository **Settings → Pages**, set **Source** to **GitHub Actions**. This is a one-time administrator setting.
2. Merge the website PR into `main`. `.github/workflows/website.yml` installs the locked dependencies, runs API/asset tests, builds the Pages edition and launches a real WebGL flight against its static output. A PR only builds/tests; only a successful run on `main` may deploy.
3. Open the deployment URL shown by the **Publish to GitHub Pages** job. The default project URL here is `https://robloxgamee1231-ctrl.github.io/Plane/`. To publish again after enabling Pages, use **Actions → Website → Run workflow**, branch `main`.

Only `out/site/` is uploaded. No accounts, SQLite databases, credentials, Blender sources, or server files go into the artifact. A static guest-profile panel shows local statistics instead of a nonfunctional login form. Settings and scenarios use localStorage; recordings use IndexedDB. The public edition makes no account API requests. Use the Node deployment below for registration and cloud saves.

### Other static hosts

```sh
npm ci
npm run build:site
npm run test:site
```

Publish directory: **`out/site/`**. The relative asset base and hash-based navigation work on a domain root or a project subpath, without SPA rewrite rules. Serve over HTTP(S), not `file://`. `test:site` mounts this exact build at `/Plane/` without any fallback or backend, checks a flight and a replay, and verifies that no requests escape the mount path.

## Development preview

```sh
npm ci
npm run dev
```

Visit port **5173**. Vite serves the app and the same-origin API, binds `0.0.0.0` and accepts proxied Arena hosts. The client uses relative `/api`, `/models`, `/textures` and `/art` URLs. Use the **NDX Flight Disaster** live preview in Arena. Do not deploy the Vite development server as a public production service.

## Production Node service

```sh
npm ci
npm run build
# Supply the initial owner password using your deployment platform's secret manager.
NODE_ENV=production NDX_OWNER_PASSWORD_FILE=/run/secrets/ndx-owner \
  NDX_DATA_DIR=/var/lib/ndx PORT=4173 npm start
```

The secret file must contain a unique password of at least 16 characters. `NDX_OWNER_PASSWORD` is an alternative environment-secret input. Never paste credentials into source, chat, or a public deployment URL. The first production boot refuses to silently create an insecure default owner. Once the database contains NDX, bootstrap values do **not** reset its password.

The service needs Node **22.13+**, read access to `dist/` and write access to the data directory. The production runtime has no third-party server dependency: `server/start.mjs` uses Node HTTP and `node:sqlite`. Only built files inside `dist/` are served. Missing asset URLs return 404 rather than the app shell. SQLite creates the database and schema at first boot; no user database or secrets are committed.

Mount a **persistent volume** at `NDX_DATA_DIR`. Use a single process with this SQLite database. Put the service behind a TLS-terminating reverse proxy and forward the original HTTPS protocol; strip untrusted incoming forwarding headers at the proxy. Same-origin API requests avoid a separate browser-visible backend URL. Use a hostname such as your own simulator subdomain at its root, not a nested URL prefix.

## Container

```sh
docker build -t ndx-flight-disaster .
docker volume create ndx-pilot-data
docker run --rm -p 4173:4173 \
  --mount type=volume,src=ndx-pilot-data,dst=/var/lib/ndx \
  --mount type=bind,src=/absolute/private/ndx-owner,dst=/run/secrets/ndx-owner,readonly \
  -e NDX_OWNER_PASSWORD_FILE=/run/secrets/ndx-owner ndx-flight-disaster
```

The owner secret and volume must be readable/writable as appropriate by the non-root `node` user. The image includes the built website, GLBs, compressed textures and backend. The Dockerfile is supplied; the native production Node serving path is the deployment path exercised in this sandbox.

## Accounts, storage and operations

- The username **NDX** is reserved case-insensitively. Passwords have a unique salt and scrypt hash. Session tokens are cryptographically random, hashed server-side, expire after seven days and are invalidated on logout.
- Cookies are HttpOnly, SameSite=Lax and Secure on HTTPS. Mutations require JSON and reject cross-site fetches. Credential endpoints have a per-window attempt budget. Put production rate limiting at your edge as well.
- The development bootstrap credential lives in the private, gitignored data directory, mode `0600`. Move it into a password manager and remove the bootstrap file once stored. Never expose `.data/` through a static host.
- `GET /api/health` is the liveness endpoint. `GET /api/me` exposes only the current user's public identity and their save. `GET /api/admin` and `POST /api/admin/revoke` enforce the owner role server-side.
- Back up SQLite using its online backup facilities, or shut down cleanly before copying the database and WAL files together. Preserve filesystem permissions. Treat backups as private user data.
- Replays are local to the browser/device. Clearing IndexedDB removes replays; a server backup cannot restore them. Guest profiles use localStorage and need no account.
- A purely static host can display assets but does not provide the complete registration/cloud-save service. Deploy the included Node service for the full website.

The Arena URL is a workspace preview. GitHub Pages publication depends on enabling Pages and a successful deployment from `main`. No paid services, custom domain, public account server or multiplayer relay are provisioned by this workflow.
