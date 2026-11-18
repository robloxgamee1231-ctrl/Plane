# Simulation architecture

## Runtime boundary

The dashboard is a small React application. Three.js, GLTFLoader, and Rapier are loaded on demand, not on the landing page. The hangar owns one render-on-demand WebGL context and swaps models without rebuilding the renderer. A flight owns its renderer, physics world, audio graph, input listeners, resize observer, recorder, and instance batches. Returning to the Flight Deck releases these resources.

Meshes use right-handed coordinates, +Y up, aircraft forward along −Z. Blender exports convert +Z-up source coordinates to glTF coordinates. Dimensions, masses and coefficients describe fictional game airframes.

## Flight and contact pipeline

1. Accumulate a bounded real-time delta, multiply by the simulation speed, and step at **1/60 s**. Limit catch-up work after a stalled frame. A hidden tab pauses; key state clears on focus loss.
2. Transform airflow into the airframe's forward/up/right axes. Apply simplified speed-dependent lift, drag, thrust, lateral slip damping, wind and turbulence. Rapier integrates gravity and rigid-body contacts.
3. Flight input requests local angular rates; mass-dependent handling, airspeed, damage, and controller response affect those rates. Arcade mode adds stronger leveling. This is not a blade-element aerodynamic solver.
4. A compound collider set distributes mass across fuselage, engines, wings, tail and gear. Removing a collider changes the remaining body's mass and inertia. Gear colliders only participate when extended. CCD reduces tunneling.
5. Drain contact events into a queue **after** the physics step; then alter colliders/structures. This avoids modifying the world while the solver is borrowing it. Relative motion, airframe strength, and material resistance determine game damage.

## Structural state, not a disappearance trigger

Buildings comprise indexed columns of supported modules. Intact modules share instanced render batches and have individual fixed colliders. A low-energy contact can darken a module without breaking it. A broken module removes its static collider and immediately creates independently simulated floor and wall pieces with mass, angular velocity, contact friction and gravity. Modules supported by the failed section enter a bounded release queue. Only two queued modules are processed per fixed step.

An explicit **Structure stress test** releases a support in a nearby, empty fictional test structure and places the observer camera nearby. Ordinary aircraft contacts also trigger the system, without using the test command. This is a simplified support model, not finite-element structural analysis.

Aircraft components accumulate damage individually. Damaged components can distort slightly before separation. GLB geometry, including engines, tail assemblies, doors, glazing and seats, becomes actual rigid-body debris. Lost wings affect lift and roll asymmetry; lost engines reduce available thrust. Restoring electrical/hydraulic/engine systems does not magically replace missing geometry.

## Performance policy

| Preset | Maximum active debris bodies |
|---|---:|
| Low | 24 |
| Medium | 48 |
| High | 80 |
| Ultra | 120 |

- Keep full simulation near the aircraft. Distance demotion and budget pressure transfer secondary fragments to a cheap ballistic/ground-settling update. Prefer already sleeping or distant fragments for demotion.
- Limit visible debris to 320 objects; preserve resting rubble within that budget rather than dropping every section out of existence.
- Use a fixed-size ring of particle buffers. Particle effects do not become rigid bodies.
- Use Rapier's broad phase, collider-handle maps, and per-column support indexing instead of all-pairs JavaScript contact tests.
- Instance scenery and static structure sections by material. Reuse geometry, use renderer frustum culling, and switch intact distant aircraft to merged low-detail GLBs.
- Tune tree density, shadows and pixel ratio by quality preset. Optional adaptive resolution lowers resolution when measured rendering speed drops. UI text remains at native CSS resolution.

## Replay contract

The recorder stores quantized positions/quaternions, timestamps, integrity, throttle, gear, checkpoint progress and per-fragment poses. Lightweight definitions identify an original model component or a material/size for each debris piece. Timestamped section releases reconstruct destruction visibility.

Playback rebuilds the seeded region and linearly interpolates positions and spherically interpolates rotations. It does not replay a video, depend on bit-exact solver determinism, or re-run a chance event. A binary search locates the active sample interval during scrubbing. World layout randomness is independent of visual terrain detail. Transient particles and exact audio waveforms are not recorded.

## Profile boundary

The server stores only account hashes, session hashes, and pilot state in SQLite. Guest and signed-in local caches have separate keys. Cloud saves cover configuration, settings, presets and recent flight logs; per-device replay payloads use IndexedDB. Statistics are personal records, not trusted competitive scores. The development-only inspection handle used by fixed-step integration fixtures is eliminated from production builds.

## Multiplayer extension point — not shipped

A future implementation should extract the fixed-step flight/contact rules into a headless authoritative worker per room. Clients would transmit input intents, never authoritative transforms, damage, or collapsed-section lists. Room snapshots would carry the existing world seed, aircraft IDs, monotonically sequenced section releases and compact pose data. Late joiners need a full structural snapshot before applying ordered deltas. Replay interpolation can be reused by spectator clients. Add per-room rate limits, authorization, bounds checks and disconnect handling before exposing such a service. The current profile API is **not** a multiplayer server.
