"""Create a browser-sized animated pilot base while preserving Meshy masters."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import sys

import bpy


MAX_TEXTURE_SIZE = 1024


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--blend-output", required=True)
    parser.add_argument("--glb-output", required=True)
    script_args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(script_args)


def main() -> None:
    args = parse_args()
    source = Path(args.source).resolve()
    blend_output = Path(args.blend_output).resolve()
    glb_output = Path(args.glb_output).resolve()
    blend_output.parent.mkdir(parents=True, exist_ok=True)
    glb_output.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(source))

    for obj in list(bpy.context.scene.objects):
        if obj.type in {"CAMERA", "LIGHT"}:
            bpy.data.objects.remove(obj, do_unlink=True)

    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(armatures) != 1 or not meshes or not bpy.data.actions:
        raise RuntimeError("Expected one animated humanoid armature and at least one mesh")

    action = bpy.data.actions[0]
    action.name = "Idle"
    armatures[0].animation_data_create()
    armatures[0].animation_data.action = action

    for image in bpy.data.images:
        width, height = image.size
        largest = max(width, height)
        if largest <= MAX_TEXTURE_SIZE:
            continue
        scale = MAX_TEXTURE_SIZE / largest
        image.scale(max(1, round(width * scale)), max(1, round(height * scale)))

    bpy.ops.wm.save_as_mainfile(filepath=str(blend_output))
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(glb_output),
        export_format="GLB",
        use_selection=True,
        export_materials="EXPORT",
        export_skins=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
    )
    print(
        f"PILOT_RUNTIME_OK source_bytes={os.path.getsize(source)} "
        f"output_bytes={os.path.getsize(glb_output)} action={action.name}"
    )


if __name__ == "__main__":
    main()
