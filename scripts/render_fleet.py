"""Render the real Blender aircraft library as locally hosted hangar thumbnails."""

import bpy, math, sys, os
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
for key, L in [
    ("stratus", 31),
    ("meridian", 47),
    ("atlas", 35),
    ("vela", 19),
    ("kestrel", 20),
    ("solace", 14),
    ("aether", 29),
]:
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / "assets/blender" / (key + ".blend")))
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = 8
    s.cycles.use_denoising = True
    s.render.threads_mode = "FIXED"
    s.render.threads = 3
    s.world = bpy.data.worlds.new("Studio")
    s.world.use_nodes = True
    s.world.node_tree.nodes["Background"].inputs[0].default_value = (0.78, 0.83, 0.89, 1)
    s.world.node_tree.nodes["Background"].inputs[1].default_value = 0.8
    bpy.data.objects["gear"].hide_render = True
    bpy.ops.mesh.primitive_plane_add(size=2000, location=(0, 0, -L * 0.090))
    floor = bpy.context.object
    m = bpy.data.materials.new("Studio floor")
    m.diffuse_color = (0.64, 0.68, 0.67, 1)
    floor.data.materials.append(m)
    bpy.ops.object.camera_add()
    cam = bpy.context.object
    cam.location = (-L * 0.95, L * 1.22, L * 0.78)
    cam.rotation_euler = (Vector((0, 0, 0)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = L * 1.38
    s.camera = cam
    bpy.ops.object.light_add(type="AREA", location=(-L, L * 0.4, L * 1.5))
    lamp = bpy.context.object
    lamp.data.energy = L * L * 27
    lamp.data.shape = "DISK"
    lamp.data.size = L * 0.76
    lamp.rotation_euler = (-lamp.location).to_track_quat("-Z", "Y").to_euler()
    s.render.resolution_x = 720
    s.render.resolution_y = 340
    s.render.resolution_percentage = 100
    s.render.image_settings.file_format = "JPEG"
    s.render.image_settings.quality = 88
    s.render.filepath = str(ROOT / "public/art/fleet" / (key + ".jpg"))
    bpy.ops.render.render(write_still=True)
sys.stdout.flush()
os._exit(0)
