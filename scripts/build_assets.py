"""Original parametric assets. Run with Blender 4.2+ --background --python scripts/build_assets.py,
or with a Python installation of bpy. Dimensions are fictional game units. No external models."""

import bpy, math, os
from pathlib import Path
from mathutils import Vector
from math import sin, cos, pi

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/models"
SRC = ROOT / "assets/blender"
OUT.mkdir(exist_ok=True, parents=True)
SRC.mkdir(exist_ok=True, parents=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    global mats, parts
    mats = {}
    parts = {}


def cov(p):
    return (p[0], -p[2], p[1])


def mat(n, c, metal=0, rough=0.45):
    m = bpy.data.materials.new(n)
    m.diffuse_color = (*c, 1)
    m.use_nodes = True
    m.use_backface_culling = n not in ("glass", "accent", "rim")
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*c, 1)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    mats[n] = m


class Part:
    def __init__(self, n):
        self.n = n
        self.v = []
        self.f = []
        self.m = []
        self.s = []

    def shape(self, verts, faces, material, smooth=False):
        i = len(self.v)
        self.v.extend(verts)
        self.f.extend([tuple(i + j for j in f) for f in faces])
        self.m.extend([material] * len(faces) if isinstance(material, str) else material)
        self.s.extend([smooth] * len(faces))

    def make(self):
        if not self.v:
            return
        ctr = [(min(v[k] for v in self.v) + max(v[k] for v in self.v)) / 2 for k in range(3)]
        mesh = bpy.data.meshes.new(self.n + " mesh")
        mesh.from_pydata([cov(tuple(v[k] - ctr[k] for k in range(3))) for v in self.v], [], self.f)
        mesh.update()
        ob = bpy.data.objects.new(self.n, mesh)
        bpy.context.collection.objects.link(ob)
        ob.location = cov(ctr)
        unique = list(dict.fromkeys(self.m))
        [mesh.materials.append(mats[m]) for m in unique]
        uv = mesh.uv_layers.new(name="Panel UV")
        for i, f in enumerate(mesh.polygons):
            f.material_index = unique.index(self.m[i])
            f.use_smooth = self.s[i]
            for l in f.loop_indices:
                v = mesh.vertices[mesh.loops[l].vertex_index].co
                uv.data[l].uv = (v.x * 0.12 + v.y * 0.08, v.z * 0.14 + v.y * 0.04)
        ob["ndx_component"] = self.n
        return ob


def part(n):
    if n not in parts:
        parts[n] = Part(n)
    return parts[n]


def cube(p, c, size, m):
    x, y, z = c
    w, h, d = [i / 2 for i in size]
    vs = [
        (x + a * w, y + b * h, z + k * d)
        for a, b, k in [
            (-1, -1, -1),
            (1, -1, -1),
            (1, 1, -1),
            (-1, 1, -1),
            (-1, -1, 1),
            (1, -1, 1),
            (1, 1, 1),
            (-1, 1, 1),
        ]
    ]
    p.shape(
        vs, [(3, 2, 1, 0), (4, 5, 6, 7), (0, 4, 7, 3), (1, 2, 6, 5), (3, 7, 6, 2), (0, 1, 5, 4)], m
    )


def loft(p, rings, m, n=32, stripe=False):
    vs = []
    fs = []
    ms = []
    for z, cx, cy, rx, ry in rings:
        for j in range(n):
            a = j * 2 * pi / n
            vs.append((cx + rx * cos(a), cy + ry * sin(a), z))
    for i in range(len(rings) - 1):
        for j in range(n):
            fs.append((i * n + j, i * n + (j + 1) % n, (i + 1) * n + (j + 1) % n, (i + 1) * n + j))
            h = sin((j + 0.5) * 2 * pi / n)
            ms.append(
                ("graphite" if -0.53 < h < -0.29 else "belly" if h <= -0.53 else m) if stripe else m
            )
    fs.extend([tuple(reversed(range(n))), tuple(range((len(rings) - 1) * n, len(rings) * n))])
    ms.extend([m, m])
    p.shape(vs, fs, ms, True)
    p.s[-2:] = [False, False]


def poly(p, coords, thickness, m):
    # Closed airfoils, with a slightly cambered upper surface.
    a = list(coords)
    b = [(x, y - thickness, z) for x, y, z in a]
    n = len(a)
    vs = a + b
    fs = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))] + [
        (i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)
    ]
    # Correct winding, even for mirrored wings.
    u = Vector(a[1]) - Vector(a[0])
    v = Vector(a[2]) - Vector(a[0])
    if u.cross(v).y < 0:
        fs = [tuple(reversed(f)) for f in fs]
    p.shape(vs, fs, m)


def save(name):
    obs = [p.make() for p in parts.values()]
    bpy.context.view_layer.update()
    for o in obs:
        if o and o.name.startswith("aileron"):
            o.rotation_euler.x = -0.16
            o.keyframe_insert(data_path="rotation_euler", frame=1)
            o.rotation_euler.x = 0.16
            o.keyframe_insert(data_path="rotation_euler", frame=25)
            o.rotation_euler.x = 0
            o.keyframe_insert(data_path="rotation_euler", frame=50)
    bpy.context.scene.frame_set(50)
    bpy.context.scene.render.fps = 25
    bpy.ops.wm.save_as_mainfile(filepath=str(SRC / (name + ".blend")), compress=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUT / (name + ".glb")),
        export_format="GLB",
        export_yup=True,
        export_animations=True,
        export_extras=True,
        export_texcoords=True,
        export_normals=True,
        export_cameras=False,
    )
    # A second, merged silhouette mesh is used only for intact, distant aircraft.
    if name != "world-props":
        bpy.ops.object.select_all(action="DESELECT")
        chosen = [
            ob
            for ob in obs
            if ob
            and (
                ob.name.startswith(("body_", "wing_", "engine_"))
                or ob.name in ("tail", "elevator", "windshield")
            )
        ]
        for ob in chosen:
            ob.select_set(True)
        bpy.context.view_layer.objects.active = chosen[0]
        bpy.ops.object.join()
        merged = bpy.context.view_layer.objects.active
        merged.name = "distant_airframe"
        mod = merged.modifiers.new("Distance mesh", "DECIMATE")
        mod.ratio = 0.26
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.ops.export_scene.gltf(
            filepath=str(OUT / (name + "-lod1.glb")),
            export_format="GLB",
            use_selection=True,
            export_yup=True,
            export_animations=False,
            export_texcoords=False,
            export_cameras=False,
        )


def aircraft(key, L, S, R, kind, accent):
    reset()
    for a in [
        ("ivory", (0.89, 0.91, 0.94), 0.36, 0.31),
        ("belly", (0.27, 0.32, 0.38), 0.60, 0.37),
        ("graphite", (0.042, 0.065, 0.085), 0.42, 0.36),
        ("glass", (0.045, 0.105, 0.145), 0.76, 0.18),
        ("rim", (0.56, 0.63, 0.66), 0.78, 0.26),
        ("accent", accent, 0.30, 0.3),
        ("rubber", (0.019, 0.024, 0.03), 0.02, 0.85),
        ("seat", (0.09, 0.145, 0.17), 0.05, 0.75),
        ("screen", (0.045, 0.55, 0.56), 0.2, 0.2),
        ("red", (0.8, 0.05, 0.025), 0.08, 0.35),
        ("green", (0.035, 0.75, 0.2), 0.08, 0.35),
    ]:
        mat(*a)
    # Fuselage composed of three independently solid breakaway hull sections.
    profiles = [
        (-0.5, 0.035, -0.20),
        (-0.483, 0.34, -0.09),
        (-0.445, 0.65, -0.02),
        (-0.397, 0.88, 0),
        (-0.327, 1, 0),
        (-0.16, 1, 0),
        (0.16, 1, 0),
        (0.31, 0.85, 0.08),
        (0.44, 0.37, 0.26),
        (0.5, 0.045, 0.35),
    ]

    def ring(p):
        return (p[0] * L, 0, p[2] * R, p[1] * R, p[1] * R * 1.01)

    for name, pro in [
        ("body_front", profiles[:6]),
        ("body_mid", profiles[5:7]),
        ("body_aft", profiles[6:]),
    ]:
        loft(part(name), list(map(ring, pro)), "ivory", 40, True)

    def radial(t):
        for (z, r, y), (zz, rr, yy) in zip(profiles, profiles[1:]):
            if t <= zz:
                f = (t - z) / (zz - z)
                return r + (rr - r) * f, y + (yy - y) * f
        return 0.04, 0.35

    for side in [-1, 1]:
        for t in [-0.444, -0.418, -0.392]:
            vs = []
            for z, a in [(t, 20), (t + 0.024, 18), (t + 0.024, 59), (t, 62)]:
                r, y = radial(z)
                aa = a * pi / 180
                vs.append((side * (r * R + 0.092) * cos(aa), (y + sin(aa) * r) * R + 0.11, z * L))
            part("windshield").shape(vs, [(0, 1, 2, 3) if side == -1 else (3, 2, 1, 0)], "glass")
        # Slightly rounded glazed cabin windows, in an inset aluminium bezel.
        count = round(L * 0.72) if kind != "cargo" else 5
        for i in range(count):
            t = -0.30 + i / max(count - 1, 1) * 0.56
            r, cy = radial(t)
            z = t * L
            angle = 0.18
            ww = min(0.34, L * 0.42 / count)
            hh = R * 0.28
            for name, scale, off in [("rim", 1.17, 0.012), ("glass", 1, 0.027)]:
                vs = []
                for j in range(12):
                    a = 2 * pi * j / 12
                    y = R * 0.26 + sin(a) * hh * 0.5 * scale
                    xx = (max(0, (r * R) ** 2 - (y - cy * R) ** 2)) ** 0.5
                    vs.append((side * (xx + off), y, z + cos(a) * ww * 0.5 * scale))
                part("cabin_windows").shape(
                    vs, [tuple(reversed(range(12))) if side > 0 else tuple(range(12))], name
                )
        # Swept wing and independent animated trailing-edge surface.
        wing_y = R * (0.45 if kind == "cargo" else -0.38)
        start = -0.14 if kind == "delta" else -0.13
        tip = 0.27 if kind in ("delta", "future") else 0.17
        sfx = "l" if side < 0 else "r"
        xs = S / 2 * side
        poly(
            part("wing_" + sfx),
            [
                (0.56 * R * side, wing_y, start * L),
                (xs, wing_y + S * 0.036, tip * L),
                (xs * 0.985, wing_y + S * 0.036, (tip + 0.038) * L),
                (0.55 * xs, wing_y + S * 0.014, 0.172 * L),
                (0.5 * R * side, wing_y, 0.145 * L),
            ],
            R * 0.175,
            "ivory",
        )
        poly(
            part("aileron_" + sfx),
            [
                (0.54 * xs, wing_y + S * 0.013, 0.172 * L),
                (0.96 * xs, wing_y + S * 0.032, (tip + 0.038) * L),
                (0.94 * xs, wing_y + S * 0.031, (tip + 0.058) * L),
                (0.53 * xs, wing_y + S * 0.012, 0.197 * L),
            ],
            R * 0.065,
            "belly",
        )
        poly(
            part("wing_" + sfx),
            [
                (xs * 0.985, wing_y + S * 0.03, tip * L),
                (xs * 1.02, wing_y + S * 0.09, (tip + 0.033) * L),
                (xs * 1.018, wing_y + S * 0.091, (tip + 0.061) * L),
                (xs * 0.985, wing_y + S * 0.03, (tip + 0.038) * L),
            ],
            R * 0.08,
            "accent",
        )
        cube(
            part("wing_" + sfx),
            (xs, wing_y + S * 0.036, tip * L),
            (0.16, 0.13, 0.22),
            "red" if side < 0 else "green",
        )
        for idx, frac in enumerate([0.36, 0.63] if kind in ("heavy", "cargo") else [0.39]):
            x = side * S * 0.5 * frac
            z = L * (-0.054 + idx * 0.072)
            y = wing_y - R * 0.89
            er = R * 0.58
            if kind == "private":
                x = side * R * 1.35
                z = L * 0.26
                y = R * 0.24
            p = part("engine_" + sfx)
            cube(
                p,
                (x, (y + wing_y) / 2, z + 0.6),
                (er * 0.28, abs(y - wing_y) + 0.1, er * 2.3),
                "rim",
            )
            loft(
                p,
                [
                    (z + zz * er, x, y, er * r, er * r)
                    for zz, r in [(-1.7, 0.87), (-1.5, 1), (-1.15, 1.03), (0.8, 0.97), (1.6, 0.77)]
                ],
                "ivory",
                32,
            )
            loft(
                p,
                [
                    (z - 1.74 * er, x, y, 0.88 * er, 0.88 * er),
                    (z - 1.61 * er, x, y, 0.93 * er, 0.93 * er),
                ],
                "rim",
            )
            loft(
                p,
                [
                    (z - 1.75 * er, x, y, er * 0.78, er * 0.78),
                    (z - 1.7 * er, x, y, er * 0.78, er * 0.78),
                ],
                "rubber",
                28,
            )
            for j in range(16):
                a = j * 2 * pi / 16
                rr = er * 0.74
                vs = [
                    (x + cos(a) * er * 0.16, y + sin(a) * er * 0.16, z - 1.77 * er),
                    (x + cos(a + 0.43) * rr, y + sin(a + 0.43) * rr, z - 1.77 * er),
                    (x + cos(a + 0.6) * rr, y + sin(a + 0.6) * rr, z - 1.77 * er),
                ]
                p.shape(vs, [(0, 2, 1)], "rim")
            loft(
                p,
                [
                    (z - 1.93 * er, x, y, 0.02 * er, 0.02 * er),
                    (z - 1.79 * er, x, y, 0.17 * er, 0.17 * er),
                ],
                "belly",
                16,
            )
            if kind == "prop":
                for j in range(3):
                    a = j * 2 * pi / 3
                    poly(
                        part("prop_" + sfx),
                        [
                            (x, y, z - 2 * er),
                            (x + cos(a) * er * 2.1, y + sin(a) * er * 2.1, z - 2 * er),
                            (
                                x + cos(a + 0.15) * er * 2.15,
                                y + sin(a + 0.15) * er * 2.15,
                                z - 1.95 * er,
                            ),
                        ],
                        0.05,
                        "graphite",
                    )
        # Tailplane, undercarriage, passenger seats, cockpit details.
        poly(
            part("elevator"),
            [
                (0, R * 0.32, L * 0.32),
                (xs * 0.39, R * 0.58, L * 0.43),
                (xs * 0.38, R * 0.58, L * 0.47),
                (0, R * 0.34, L * 0.433),
            ],
            R * 0.105,
            "ivory",
        )
        for gz, gx in [(L * 0.075, R * 0.92), (-L * 0.34, 0.25 * R)]:
            cube(part("gear"), (side * gx, -R * 1.24, gz), (0.12, R * 0.89, 0.13), "rim")
            cube(part("gear"), (side * gx, -R * 1.67, gz), (0.24, R * 0.50, R * 0.51), "rubber")
        rows, per_side = {
            "airliner": (13, 3),
            "heavy": (23, 4),
            "cargo": (3, 2),
            "private": (4, 1),
            "delta": (2, 1),
            "prop": (3, 1),
            "future": (6, 2),
        }[kind]
        for j in range(rows):
            z = L * (-0.28 + 0.54 * j / max(1, rows - 1))
            for column in range(per_side):
                x = side * R * (0.24 + (column + 0.5) * 0.64 / per_side)
                width = R * 0.58 / per_side
                cube(part("interior"), (x, -R * 0.4, z), (width, 0.13, 0.49), "seat")
                cube(part("interior"), (x, -R * 0.2, z + 0.23), (width, R * 0.5, 0.12), "graphite")
        for t in [-0.31, 0.273]:
            r, _ = radial(t)
            x = side * (r * R * 0.98)
            cube(part("doors"), (x, -R * 0.14, t * L), (0.09, R * 1.13, 0.78), "rim")
            cube(
                part("doors"), (x + side * 0.04, -R * 0.14, t * L), (0.04, R * 1.07, 0.70), "ivory"
            )
            cube(
                part("doors"), (x + side * 0.065, R * 0.12, t * L), (0.03, R * 0.26, 0.31), "glass"
            )
        cube(
            part("cockpit"),
            (side * 0.44 * R, -0.18 * R, -0.42 * L),
            (R * 0.79, R * 0.27, 0.44),
            "graphite",
        )
        cube(
            part("cockpit"),
            (side * 0.44 * R, -0.13 * R, -0.42 * L + 0.24),
            (R * 0.5, R * 0.16, 0.02),
            "screen",
        )
    cube(part("interior"), (0, -R * 0.54, 0), (R * 1.67, 0.08, L * 0.71), "belly")
    # Fin is a tapered solid, not a flat sprite. Contrasting rudder and fin stripes.
    x = R * 0.11
    cross = [
        (R * 0.1, L * 0.25),
        (R * 3.43, L * 0.431),
        (R * 3.41, L * 0.493),
        (R * 0.3, L * 0.465),
    ]
    for side in [-1, 1]:
        vs = [(side * x, y, z) for y, z in cross]
        part("tail").shape(vs, [tuple(range(4)) if side < 0 else (3, 2, 1, 0)], "accent")
        for k in [0, 0.29]:
            vs = [
                (side * (x + 0.008), (1.38 + k) * R, 0.355 * L),
                (side * (x + 0.008), (1.71 + k) * R, 0.368 * L),
                (side * (x + 0.008), (2.59 + k) * R, 0.459 * L),
                (side * (x + 0.008), (2.31 + k) * R, 0.455 * L),
            ]
            part("tail").shape(vs, [(0, 1, 2, 3), (3, 2, 1, 0)], "ivory")
    for j in range(4):
        y, z = cross[j]
        yy, zz = cross[(j + 1) % 4]
        part("tail").shape(
            [(-x, y, z), (x, y, z), (x, yy, zz), (-x, yy, zz)],
            [(0, 1, 2, 3), (3, 2, 1, 0)],
            "accent",
        )
    cube(part("rudder"), (0, R * 1.70, L * 0.461), (R * 0.105, R * 2.55, L * 0.025), "accent")
    save(key)


planes = [
    ("stratus", 31, 29, 1.55, "airliner", (0.95, 0.21, 0.045)),
    ("meridian", 47, 43, 2.35, "heavy", (0.88, 0.26, 0.055)),
    ("atlas", 35, 38, 2.15, "cargo", (0.13, 0.31, 0.24)),
    ("vela", 19, 17, 0.96, "private", (0.19, 0.4, 0.65)),
    ("kestrel", 20, 24, 1.12, "delta", (0.82, 0.42, 0.075)),
    ("solace", 14, 16, 0.83, "prop", (0.52, 0.10, 0.055)),
    ("aether", 29, 36, 1.3, "future", (0.04, 0.52, 0.62)),
]
for a in planes:
    aircraft(*a)
# Reusable environmental library. Every prop has an independent origin on its base.
reset()
for n, c in [
    ("concrete", (0.53, 0.57, 0.55)),
    ("steel", (0.215, 0.285, 0.30)),
    ("timber", (0.22, 0.12, 0.06)),
    ("foliage", (0.065, 0.19, 0.10)),
    ("ochre", (0.77, 0.39, 0.11)),
    ("glass", (0.10, 0.24, 0.32)),
    ("white", (0.81, 0.83, 0.78)),
]:
    mat(n, c, 0.15 if n in ("steel", "glass") else 0)
cube(part("service_cart"), (0, 0.55, 0), (2.4, 0.65, 4.6), "white")
cube(part("service_cart"), (0, 1.25, -0.65), (2.16, 0.85, 1.7), "glass")
cube(part("service_cart"), (0, 1.74, -0.6), (2.3, 0.13, 1.85), "ochre")
for x in [-1.18, 1.18]:
    for z in [-1.35, 1.35]:
        cube(part("service_cart"), (x, 0.31, z), (0.25, 0.64, 0.68), "steel")
cube(part("cargo_crate"), (0, 1, 0), (2.4, 2, 2.4), "timber")
cube(part("cargo_crate"), (0, 1, 0), (0.21, 2.05, 2.46), "steel")
cube(part("cargo_crate"), (0, 1, 0), (2.46, 2.05, 0.21), "steel")
cube(part("industrial_vent"), (0, 0.68, 0), (2.9, 1.28, 2.1), "steel")
for i in range(9):
    cube(part("industrial_vent"), (-1.22 + i * 0.3, 1.35, 0), (0.16, 0.1, 1.85), "concrete")
for i in range(5):
    cube(part("barricade"), (i * 1.05, 0.6, 0), (1.02, 1.18, 1.04), "ochre" if i % 2 else "white")
cube(part("hangar_wall"), (0, 3, 0), (12, 6, 0.55), "concrete")
cube(part("hangar_wall"), (0, 4.95, -0.33), (11.4, 0.85, 0.18), "glass")
cube(part("bench"), (0, 0.61, 0), (2.9, 0.21, 0.8), "timber")
cube(part("bench"), (0, 1.06, 0.4), (2.9, 0.7, 0.14), "timber")
for x in [-1, 1]:
    cube(part("bench"), (x, 0.29, 0), (0.25, 0.5, 0.74), "steel")
for i, (h, r) in enumerate([(3, 2.5), (5, 2), (7, 1.2)]):
    v = [(r * cos(j * pi / 4), h - 2, r * sin(j * pi / 4)) for j in range(8)] + [(0, h + 2, 0)]
    part("pine").shape(v, [(j, 8, (j + 1) % 8) for j in range(8)] + [tuple(range(8))], "foliage")
cube(part("pine"), (0, 1, 0), (0.5, 2, 0.5), "timber")
save("world-props")
print("Generated 7 original aircraft and the world component library.", flush=True)
# The optional standalone bpy wheel can unload native X11 libraries out of order at interpreter exit.
if __name__ == "__main__" and not bpy.app.binary_path:
    os._exit(0)
