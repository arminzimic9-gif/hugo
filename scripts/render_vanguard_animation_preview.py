"""Render a transparent preview frame from the editable Vanguard rig."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

import bpy
from mathutils import Vector


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--track", default="Walk")
    parser.add_argument("--frame", type=int, default=7)
    script_args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(script_args)


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def main() -> None:
    args = parse_args()
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    rig = bpy.data.objects.get("Vanguard_Rig")
    if not rig or not rig.animation_data:
        raise RuntimeError("Vanguard_Rig animation data is missing")
    for track in rig.animation_data.nla_tracks:
        track.mute = track.name != args.track

    camera_data = bpy.data.cameras.new("RigPreviewCamera")
    camera = bpy.data.objects.new("RigPreviewCamera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = (3.2, -5.4, 2.65)
    camera_data.lens = 70
    point_at(camera, Vector((0, 0, 1.0)))
    bpy.context.scene.camera = camera

    key_data = bpy.data.lights.new("RigPreviewKey", type="AREA")
    key_data.energy = 1100
    key_data.shape = "DISK"
    key_data.size = 4.5
    key = bpy.data.objects.new("RigPreviewKey", key_data)
    bpy.context.scene.collection.objects.link(key)
    key.location = (2.5, -3.0, 4.0)
    point_at(key, Vector((0, 0, 1.1)))

    fill_data = bpy.data.lights.new("RigPreviewFill", type="AREA")
    fill_data.energy = 750
    fill_data.color = (0.1, 0.7, 1.0)
    fill_data.size = 3.0
    fill = bpy.data.objects.new("RigPreviewFill", fill_data)
    bpy.context.scene.collection.objects.link(fill)
    fill.location = (-2.8, 1.8, 2.3)
    point_at(fill, Vector((0, 0, 1.0)))

    scene = bpy.context.scene
    scene.frame_set(args.frame)
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    print(f"PREVIEW_OK track={args.track} frame={args.frame} output={output}")


if __name__ == "__main__":
    main()
