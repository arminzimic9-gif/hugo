import math
import os
import sys

import bpy
from mathutils import Vector


SOURCE_PATH = sys.argv[sys.argv.index("--") + 1]
OUTPUT_PATH = sys.argv[sys.argv.index("--") + 2]
PREVIEW_PATH = sys.argv[sys.argv.index("--") + 3]
TARGET_TRIANGLES = 90_000


def mesh_objects():
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def scene_bounds(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    minimum = Vector((min(point.x for point in corners), min(point.y for point in corners), min(point.z for point in corners)))
    maximum = Vector((max(point.x for point in corners), max(point.y for point in corners), max(point.z for point in corners)))
    return minimum, maximum


bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.wm.stl_import(filepath=SOURCE_PATH)

objects = mesh_objects()
if not objects:
    raise RuntimeError("STL import produced no mesh")

bpy.ops.object.select_all(action="DESELECT")
for item in objects:
    item.select_set(True)
bpy.context.view_layer.objects.active = objects[0]
if len(objects) > 1:
    bpy.ops.object.join()

model = bpy.context.view_layer.objects.active
model.name = "SPECTRE_CYBERNETIC_SENTINEL"

triangle_count = len(model.data.loop_triangles)
if triangle_count == 0:
    model.data.calc_loop_triangles()
    triangle_count = len(model.data.loop_triangles)

ratio = min(1.0, TARGET_TRIANGLES / max(1, triangle_count))
if ratio < 0.999:
    decimate = model.modifiers.new(name="WEB_DECIMATE", type="DECIMATE")
    decimate.decimate_type = "COLLAPSE"
    decimate.ratio = ratio
    decimate.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = model
    bpy.ops.object.modifier_apply(modifier=decimate.name)

minimum, maximum = scene_bounds(model)
center = (minimum + maximum) * 0.5
model.location -= center
bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
bpy.context.view_layer.update()

minimum, maximum = scene_bounds(model)
height = max(0.001, maximum.z - minimum.z)
model.scale *= 3.2 / height
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

minimum, maximum = scene_bounds(model)
model.location.z -= minimum.z
bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)

for polygon in model.data.polygons:
    polygon.use_smooth = True

# STL carries geometry only. Keep the export material-free so the viewer uses
# the neutral glTF default instead of inventing a texture or surface finish.
model.data.materials.clear()

os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
bpy.ops.object.select_all(action="DESELECT")
model.select_set(True)
bpy.context.view_layer.objects.active = model
bpy.ops.export_scene.gltf(
    filepath=OUTPUT_PATH,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_materials="EXPORT",
)

world = bpy.context.scene.world
world.color = (0.004, 0.006, 0.01)
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.002, 0.004, 0.008, 1.0)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.18

camera_data = bpy.data.cameras.new("PreviewCamera")
camera = bpy.data.objects.new("PreviewCamera", camera_data)
bpy.context.scene.collection.objects.link(camera)
bpy.context.scene.camera = camera
camera.location = (4.2, -6.2, 3.0)
camera_data.lens = 58

direction = Vector((0.0, 0.0, 1.55)) - camera.location
camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

for name, location, color, energy, size in [
    ("Key", (-3.5, -3.0, 5.5), (0.7, 0.9, 1.0), 1100, 4.0),
    ("Rim", (3.4, 1.8, 4.0), (1.0, 0.025, 0.055), 1400, 3.0),
    ("Fill", (0.0, -1.0, 1.2), (0.08, 0.45, 0.65), 650, 2.5),
]:
    light_data = bpy.data.lights.new(name=name, type="AREA")
    light_data.energy = energy
    light_data.color = color
    light_data.shape = "DISK"
    light_data.size = size
    light = bpy.data.objects.new(name=name, object_data=light_data)
    light.location = location
    bpy.context.scene.collection.objects.link(light)
    light.rotation_euler = (Vector((0.0, 0.0, 1.5)) - light.location).to_track_quat("-Z", "Y").to_euler()

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 720
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = True
scene.render.filepath = PREVIEW_PATH
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.look = "AgX - Medium High Contrast"
bpy.ops.render.render(write_still=True)

model.data.calc_loop_triangles()
print(
    f"SPECTRE_EXPORT source_triangles={triangle_count} "
    f"web_triangles={len(model.data.loop_triangles)} "
    f"glb_bytes={os.path.getsize(OUTPUT_PATH)}"
)
