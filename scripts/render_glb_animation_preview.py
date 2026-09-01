"""Render a transparent review frame from an animated GLB master."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

import bpy
from mathutils import Vector


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--frame", type=int, default=10)
    script_args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(script_args)


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def main() -> None:
    args = parse_args()
    source = Path(args.source).resolve()
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(source))

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if not meshes or not armatures or not bpy.data.actions:
        raise RuntimeError("Animated GLB is missing mesh, armature, or action")

    for mesh in meshes:
        mesh.select_set(True)

    camera_data = bpy.data.cameras.new("AnimationReviewCamera")
    camera = bpy.data.objects.new("AnimationReviewCamera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = (3.1, -5.2, 2.55)
    camera_data.lens = 68
    point_at(camera, Vector((0, 0, 1.0)))
    bpy.context.scene.camera = camera

    key_data = bpy.data.lights.new("AnimationReviewKey", type="AREA")
    key_data.energy = 1200
    key_data.size = 4.5
    key = bpy.data.objects.new("AnimationReviewKey", key_data)
    bpy.context.scene.collection.objects.link(key)
    key.location = (2.4, -3.2, 4.0)
    point_at(key, Vector((0, 0, 1.0)))

    fill_data = bpy.data.lights.new("AnimationReviewFill", type="AREA")
    fill_data.energy = 700
    fill_data.color = (0.08, 0.65, 1.0)
    fill_data.size = 3.0
    fill = bpy.data.objects.new("AnimationReviewFill", fill_data)
    bpy.context.scene.collection.objects.link(fill)
    fill.location = (-2.8, 1.8, 2.5)
    point_at(fill, Vector((0, 0, 1.0)))

    scene = bpy.context.scene
    action = bpy.data.actions[0]
    scene.frame_start = int(action.frame_range[0])
    scene.frame_end = int(action.frame_range[1])
    scene.frame_set(max(scene.frame_start, min(args.frame, scene.frame_end)))
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    print(f"PREVIEW_OK action={action.name} frame={scene.frame_current} output={output}")


if __name__ == "__main__":
    main()
