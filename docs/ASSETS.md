# Original asset pipeline

The game can be installed, tested, built and played **without Blender**. Original binary sources and optimized runtime exports are included.

## Editable sources

`assets/blender/{stratus,meridian,atlas,vela,kestrel,solace,aether}.blend` contain the seven airframes. `world-props.blend` contains a service vehicle, cargo crate, pine, wall panel, vent, barricade and bench. Each aircraft uses real named meshes for three fuselage sections, wings, tail, engines, windows, seats, cockpit, doors and gear.

The source generator creates closed ring-loft hull sections, tapered airfoils, nacelles, fan blades, UV coordinates, material groups, cabin seating, cockpit panels, glazed windows and control surfaces. glTF PBR material parameters travel with the mesh. Named pivots provide rigid-part animation; aileron preview actions are embedded in each full GLB. Live control animation is driven by input and flight state, not by a canned flight clip.

## Rebuild

From the repository root, using Blender 4.2 or later:

```sh
blender --background --python scripts/build_assets.py
blender --background --python scripts/render_fleet.py
```

Alternatively run the scripts with the Blender `bpy` Python wheel in a compatible environment. The checked-in exports were made with bpy/Blender 4.2.0. Scripts resolve output paths relative to themselves.

The model builder saves the full editable scene **before** producing a silhouette LOD. The LOD export merges major exterior components, removes interiors and small detail, and applies mesh decimation. Exact triangle counts are checked relative to the full model in `tests/assets.test.mjs`.

`scripts/render_fleet.py` uses Cycles to photograph the original airframes in a neutral studio. These actual model renders appear in aircraft lists. The hangar's large turntable is an interactive WebGL model, not a picture.

`scripts/build_textures.py` (Pillow + NumPy) generates original seeded grass, sand, tarmac, and cloud textures in compact WebP format. Facades are small procedurally painted CanvasTextures. Region architecture and collision masses are assembled at runtime from reusable modules to support different seeds and destruction states.

## Art and libraries

The scenic launcher banners and three configuration cover illustrations are original generated promotional artwork, not gameplay captures. Actual runtime screenshots are explicitly labeled in the QA report. No commercial aircraft meshes, airline trademarks, borrowed city datasets or prerecorded crash footage are used.

React, Three.js, Rapier, Lucide, Inter and IBM Plex Mono retain their respective upstream licenses. Fonts are bundled locally with their Fontsource packages; their license notices are included in `public/licenses/`.
