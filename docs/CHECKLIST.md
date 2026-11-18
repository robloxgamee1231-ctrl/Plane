# Development checklist

- [x] **1 — Playable world:** browser canvas, WebGL2 scene graph, actual aircraft motion, seeded terrain and scenery.
- [x] **2 — Flight:** fixed-step forces, mass-bearing compound colliders, stability modes, landing/braking, six camera positions and camera controls.
- [x] **3 — Damage:** per-component deformation/separation, full contact processing, support-dependent module release, physical panels/slabs, capped near bodies and distant settling.
- [x] **4 — Asset integration:** seven editable original Blender aircraft, prop library, PBR GLBs, embedded control-surface actions, LOD exports, surface textures and six playable regions.
- [x] **5 — Scenarios/replay:** editable seeded starts, random faults, checkpoint course, damage/destruction labs, compact rolling recorder, stored replays, timeline and camera switching.
- [x] **6 — Website and profiles:** responsive Flight Deck, live model inspection, selection/configuration pages, settings, manual, guest storage, registered pilots, cloud configuration, personal logs and protected owner administration.
- [x] **7a — Deployment:** same-origin server, production build, persistent SQLite, secure bootstrap and container recipe. Tested the actual built website in a fresh production process.
- [x] **7a — Public website packaging:** portable GitHub Pages build, local-only guest profile and a static-subpath browser test. Publish on `main` after Pages is enabled.
- [ ] **7b — Optional multiplayer:** not shipped. Single-player is the supported experience. The future authoritative-room boundary is documented in `ARCHITECTURE.md`; no simulated room count, fake player list or nonfunctional join button is shown.
- [x] **8 — Browser QA:** launch and inspect actual site; exercise every aircraft and region; contact/landing/debris, recorder, account, persistence, controls, mobile layout and production smoke tests. See `TESTING.md`.
- [ ] **External release validation:** real Safari/Firefox, mobile GPU/thermal performance, accessibility audit, public hosting, load testing and long-running operational monitoring remain outside the verified matrix.
