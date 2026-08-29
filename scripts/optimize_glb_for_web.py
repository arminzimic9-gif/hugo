import os
import sys

import bpy


INPUT_PATH = sys.argv[sys.argv.index("--") + 1]
OUTPUT_PATH = sys.argv[sys.argv.index("--") + 2]
MAX_TEXTURE_SIZE = 1024

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=INPUT_PATH)

for obj in list(bpy.context.scene.objects):
    if obj.type in {"CAMERA", "LIGHT"}:
        bpy.data.objects.remove(obj, do_unlink=True)

for image in bpy.data.images:
    width, height = image.size
    largest = max(width, height)
    if largest <= MAX_TEXTURE_SIZE:
        continue
    scale = MAX_TEXTURE_SIZE / largest
    image.scale(max(1, round(width * scale)), max(1, round(height * scale)))

os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUTPUT_PATH,
    export_format="GLB",
    export_apply=True,
    export_materials="EXPORT",
)

print(
    f"WEB_GLB input_bytes={os.path.getsize(INPUT_PATH)} "
    f"output_bytes={os.path.getsize(OUTPUT_PATH)} max_texture={MAX_TEXTURE_SIZE}"
)
