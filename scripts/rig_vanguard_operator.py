"""Create a lightweight humanoid rig and gameplay animation clips for HUGO pilots.

The Meshy master stays untouched. This script writes a separate editable .blend
master plus a browser-ready animated GLB.
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector


FPS = 24


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--blend-output", required=True)
    parser.add_argument("--glb-output", required=True)
    script_args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    args = parser.parse_args(script_args)
    return args


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def import_mesh(source: Path) -> bpy.types.Object:
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"Expected exactly one Vanguard mesh, found {len(meshes)}")
    mesh = meshes[0]
    mesh.name = "Vanguard_Mesh"
    mesh.data.name = "Vanguard_Mesh"
    bpy.context.view_layer.objects.active = mesh
    mesh.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return mesh


def add_bone(
    armature: bpy.types.Armature,
    name: str,
    head: tuple[float, float, float],
    tail: tuple[float, float, float],
    parent: bpy.types.EditBone | None = None,
    connected: bool = False,
) -> bpy.types.EditBone:
    bone = armature.edit_bones.new(name)
    bone.head = head
    bone.tail = tail
    bone.parent = parent
    bone.use_connect = connected
    return bone


def create_armature() -> bpy.types.Object:
    armature_data = bpy.data.armatures.new("Vanguard_Rig")
    armature = bpy.data.objects.new("Vanguard_Rig", armature_data)
    bpy.context.collection.objects.link(armature)
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")

    root = add_bone(armature_data, "root", (0, 0, 0.02), (0, 0, 0.22))
    root.use_deform = False
    hips = add_bone(armature_data, "hips", (0, 0, 0.82), (0, 0, 1.04), root)
    spine = add_bone(armature_data, "spine", (0, 0, 1.04), (0, 0, 1.34), hips, True)
    chest = add_bone(armature_data, "chest", (0, 0, 1.34), (0, 0, 1.57), spine, True)
    neck = add_bone(armature_data, "neck", (0, 0, 1.57), (0, 0, 1.72), chest, True)
    add_bone(armature_data, "head", (0, 0, 1.72), (0, 0, 1.98), neck, True)

    for side, sign in (("L", 1), ("R", -1)):
        clavicle = add_bone(
            armature_data,
            f"clavicle.{side}",
            (0.02 * sign, 0, 1.53),
            (0.29 * sign, 0, 1.51),
            chest,
        )
        upper_arm = add_bone(
            armature_data,
            f"upper_arm.{side}",
            (0.29 * sign, 0, 1.51),
            (0.43 * sign, 0, 1.22),
            clavicle,
            True,
        )
        lower_arm = add_bone(
            armature_data,
            f"lower_arm.{side}",
            (0.43 * sign, 0, 1.22),
            (0.50 * sign, 0, 0.96),
            upper_arm,
            True,
        )
        hand = add_bone(
            armature_data,
            f"hand.{side}",
            (0.50 * sign, 0, 0.96),
            (0.51 * sign, -0.015, 0.82),
            lower_arm,
            True,
        )
        socket = add_bone(
            armature_data,
            f"weapon_socket.{side}",
            (0.51 * sign, -0.015, 0.82),
            (0.51 * sign, -0.03, 0.68),
            hand,
            True,
        )
        socket.use_deform = False

        thigh = add_bone(
            armature_data,
            f"thigh.{side}",
            (0.14 * sign, 0, 0.91),
            (0.14 * sign, 0, 0.53),
            hips,
        )
        shin = add_bone(
            armature_data,
            f"shin.{side}",
            (0.14 * sign, 0, 0.53),
            (0.14 * sign, 0, 0.15),
            thigh,
            True,
        )
        add_bone(
            armature_data,
            f"foot.{side}",
            (0.14 * sign, 0, 0.15),
            (0.14 * sign, -0.24, 0.07),
            shin,
            True,
        )

    bpy.ops.object.mode_set(mode="OBJECT")
    armature.show_in_front = True
    return armature


def bind_mesh(mesh: bpy.types.Object, armature: bpy.types.Object) -> None:
    mesh.parent = armature
    mesh.matrix_parent_inverse = armature.matrix_world.inverted()
    modifier = mesh.modifiers.new(name="Vanguard_Rig", type="ARMATURE")
    modifier.object = armature

    deform_bones = [bone for bone in armature.data.bones if bone.use_deform]
    groups = {bone.name: mesh.vertex_groups.new(name=bone.name) for bone in deform_bones}

    def distance_to_segment(point: Vector, bone: bpy.types.Bone) -> float:
        start = bone.head_local
        end = bone.tail_local
        segment = end - start
        length_sq = segment.length_squared
        if length_sq <= 1e-8:
            return (point - start).length
        amount = max(0.0, min(1.0, (point - start).dot(segment) / length_sq))
        return (point - (start + segment * amount)).length

    core = ["hips", "spine", "chest", "neck", "head"]
    legs = {
        "L": ["hips", "thigh.L", "shin.L", "foot.L"],
        "R": ["hips", "thigh.R", "shin.R", "foot.R"],
    }
    arms = {
        "L": ["chest", "clavicle.L", "upper_arm.L", "lower_arm.L", "hand.L"],
        "R": ["chest", "clavicle.R", "upper_arm.R", "lower_arm.R", "hand.R"],
    }

    for vertex in mesh.data.vertices:
        point = vertex.co
        side = "L" if point.x >= 0 else "R"
        abs_x = abs(point.x)
        arm_threshold = 0.255 if point.z >= 1.34 else 0.335 if point.z >= 1.04 else 0.39
        if point.z < 0.93:
            candidates = legs[side]
        elif abs_x > arm_threshold and point.z < 1.64:
            candidates = arms[side]
        else:
            candidates = core

        scored: list[tuple[str, float]] = []
        for name in candidates:
            distance = distance_to_segment(point, armature.data.bones[name])
            score = math.exp(-((distance / 0.19) ** 2)) + 1e-6
            scored.append((name, score))
        scored.sort(key=lambda item: item[1], reverse=True)
        selected = scored[:4]
        total = sum(score for _, score in selected)
        for name, score in selected:
            groups[name].add([vertex.index], score / total, "REPLACE")


def key_rotation(pose_bone: bpy.types.PoseBone, frame: int, xyz: tuple[float, float, float]) -> None:
    pose_bone.rotation_mode = "XYZ"
    pose_bone.rotation_euler = xyz
    pose_bone.keyframe_insert(data_path="rotation_euler", frame=frame, group=pose_bone.name)


def key_location(pose_bone: bpy.types.PoseBone, frame: int, xyz: tuple[float, float, float]) -> None:
    pose_bone.location = xyz
    pose_bone.keyframe_insert(data_path="location", frame=frame, group=pose_bone.name)


def create_idle(armature: bpy.types.Object) -> bpy.types.Action:
    action = bpy.data.actions.new("Idle")
    armature.animation_data_create()
    armature.animation_data.action = action

    for frame, breath in ((1, 0.0), (31, 1.0), (61, 0.0)):
        key_location(armature.pose.bones["hips"], frame, (0, 0.0, breath * 0.012))
        key_rotation(armature.pose.bones["chest"], frame, (breath * -0.025, 0, 0.0))
        key_rotation(armature.pose.bones["head"], frame, (breath * 0.018, 0, 0.0))
        key_rotation(armature.pose.bones["upper_arm.L"], frame, (breath * 0.025, 0, breath * -0.012))
        key_rotation(armature.pose.bones["upper_arm.R"], frame, (breath * -0.025, 0, breath * 0.012))

    action.frame_start = 1
    action.frame_end = 61
    armature.animation_data.action = None
    return action


def create_walk(armature: bpy.types.Object) -> bpy.types.Action:
    action = bpy.data.actions.new("Walk")
    armature.animation_data_create()
    armature.animation_data.action = action

    cycle = (
        (1, 1.0, 0.0),
        (7, 0.0, 1.0),
        (13, -1.0, 0.0),
        (19, 0.0, 1.0),
        (25, 1.0, 0.0),
    )
    for frame, stride, lift in cycle:
        key_location(armature.pose.bones["hips"], frame, (0, 0.0, 0.018 * lift))
        key_rotation(armature.pose.bones["hips"], frame, (0, 0.04 * stride, 0.0))
        key_rotation(armature.pose.bones["chest"], frame, (0, -0.055 * stride, 0.0))

        key_rotation(armature.pose.bones["thigh.L"], frame, (0.55 * stride, 0, 0))
        key_rotation(armature.pose.bones["thigh.R"], frame, (-0.55 * stride, 0, 0))
        key_rotation(armature.pose.bones["shin.L"], frame, (0.42 * max(0.0, -stride) + 0.22 * lift, 0, 0))
        key_rotation(armature.pose.bones["shin.R"], frame, (0.42 * max(0.0, stride) + 0.22 * lift, 0, 0))
        key_rotation(armature.pose.bones["foot.L"], frame, (-0.16 * stride, 0, 0))
        key_rotation(armature.pose.bones["foot.R"], frame, (0.16 * stride, 0, 0))

        key_rotation(armature.pose.bones["upper_arm.L"], frame, (-0.38 * stride, 0, 0))
        key_rotation(armature.pose.bones["upper_arm.R"], frame, (0.38 * stride, 0, 0))
        key_rotation(armature.pose.bones["lower_arm.L"], frame, (-0.12 - 0.10 * max(0.0, stride), 0, 0))
        key_rotation(armature.pose.bones["lower_arm.R"], frame, (-0.12 - 0.10 * max(0.0, -stride), 0, 0))

    action.frame_start = 1
    action.frame_end = 25
    armature.animation_data.action = None
    return action


def key_weapon_guard(armature: bpy.types.Object, frame: int, breath: float = 0.0) -> None:
    """Compact two-hand ready pose that also works for dual blades."""

    key_rotation(armature.pose.bones["chest"], frame, (-0.035 + breath * -0.018, 0, 0.0))
    key_rotation(armature.pose.bones["head"], frame, (0.02 + breath * 0.012, 0, 0.0))
    key_rotation(armature.pose.bones["clavicle.L"], frame, (0.0, 0.0, -0.08))
    key_rotation(armature.pose.bones["clavicle.R"], frame, (0.0, 0.0, 0.08))
    key_rotation(armature.pose.bones["upper_arm.L"], frame, (-0.62, -0.10, -0.20))
    key_rotation(armature.pose.bones["upper_arm.R"], frame, (-0.74, 0.12, 0.18))
    key_rotation(armature.pose.bones["lower_arm.L"], frame, (-0.58, 0.04, 0.10))
    key_rotation(armature.pose.bones["lower_arm.R"], frame, (-0.66, -0.03, -0.08))
    key_rotation(armature.pose.bones["hand.L"], frame, (0.08, 0.0, -0.12))
    key_rotation(armature.pose.bones["hand.R"], frame, (-0.05, 0.0, 0.10))


def create_weapon_idle(armature: bpy.types.Object) -> bpy.types.Action:
    action = bpy.data.actions.new("WeaponIdle")
    armature.animation_data_create()
    armature.animation_data.action = action

    for frame, breath in ((1, 0.0), (31, 1.0), (61, 0.0)):
        key_location(armature.pose.bones["hips"], frame, (0, 0.0, breath * 0.01))
        key_weapon_guard(armature, frame, breath)

    action.frame_start = 1
    action.frame_end = 61
    armature.animation_data.action = None
    return action


def create_weapon_walk(armature: bpy.types.Object) -> bpy.types.Action:
    action = bpy.data.actions.new("WeaponWalk")
    armature.animation_data_create()
    armature.animation_data.action = action

    cycle = (
        (1, 1.0, 0.0),
        (7, 0.0, 1.0),
        (13, -1.0, 0.0),
        (19, 0.0, 1.0),
        (25, 1.0, 0.0),
    )
    for frame, stride, lift in cycle:
        key_location(armature.pose.bones["hips"], frame, (0, 0.0, 0.016 * lift))
        key_rotation(armature.pose.bones["hips"], frame, (0, 0.035 * stride, 0.0))
        key_rotation(armature.pose.bones["thigh.L"], frame, (0.48 * stride, 0, 0))
        key_rotation(armature.pose.bones["thigh.R"], frame, (-0.48 * stride, 0, 0))
        key_rotation(armature.pose.bones["shin.L"], frame, (0.38 * max(0.0, -stride) + 0.18 * lift, 0, 0))
        key_rotation(armature.pose.bones["shin.R"], frame, (0.38 * max(0.0, stride) + 0.18 * lift, 0, 0))
        key_rotation(armature.pose.bones["foot.L"], frame, (-0.14 * stride, 0, 0))
        key_rotation(armature.pose.bones["foot.R"], frame, (0.14 * stride, 0, 0))
        key_weapon_guard(armature, frame, 0.35 * lift)
        key_rotation(armature.pose.bones["chest"], frame, (-0.04, -0.035 * stride, 0.0))

    action.frame_start = 1
    action.frame_end = 25
    armature.animation_data.action = None
    return action


def create_melee_attack(armature: bpy.types.Object) -> bpy.types.Action:
    """Fast diagonal full-body cut; runtime retimes it for each relic class."""

    action = bpy.data.actions.new("MeleeAttack")
    armature.animation_data_create()
    armature.animation_data.action = action

    key_weapon_guard(armature, 1)
    key_location(armature.pose.bones["hips"], 1, (0, 0, 0))
    key_rotation(armature.pose.bones["hips"], 1, (0, 0, 0))

    # Anticipation: turn the torso and raise the weapon shoulder.
    key_location(armature.pose.bones["hips"], 5, (0, 0.015, 0.01))
    key_rotation(armature.pose.bones["hips"], 5, (0, -0.18, 0))
    key_rotation(armature.pose.bones["chest"], 5, (-0.08, -0.38, -0.08))
    key_rotation(armature.pose.bones["head"], 5, (0.03, 0.22, 0.0))
    key_rotation(armature.pose.bones["upper_arm.R"], 5, (-0.36, -0.58, 0.42))
    key_rotation(armature.pose.bones["lower_arm.R"], 5, (-0.74, 0.18, -0.12))
    key_rotation(armature.pose.bones["hand.R"], 5, (-0.14, 0.18, 0.28))
    key_rotation(armature.pose.bones["upper_arm.L"], 5, (-0.52, -0.18, -0.34))
    key_rotation(armature.pose.bones["lower_arm.L"], 5, (-0.48, -0.12, 0.08))

    # Contact: weight shifts forward and both shoulders follow the cut.
    key_location(armature.pose.bones["hips"], 10, (0, -0.035, 0.018))
    key_rotation(armature.pose.bones["hips"], 10, (0.10, 0.24, 0))
    key_rotation(armature.pose.bones["chest"], 10, (-0.12, 0.48, 0.12))
    key_rotation(armature.pose.bones["head"], 10, (0.02, -0.18, 0.0))
    key_rotation(armature.pose.bones["upper_arm.R"], 10, (-1.02, 0.52, -0.28))
    key_rotation(armature.pose.bones["lower_arm.R"], 10, (-0.22, -0.16, 0.14))
    key_rotation(armature.pose.bones["hand.R"], 10, (0.18, -0.22, -0.38))
    key_rotation(armature.pose.bones["upper_arm.L"], 10, (-0.82, 0.16, 0.18))
    key_rotation(armature.pose.bones["lower_arm.L"], 10, (-0.32, 0.12, -0.10))

    key_weapon_guard(armature, 18)
    key_location(armature.pose.bones["hips"], 18, (0, 0, 0))
    key_rotation(armature.pose.bones["hips"], 18, (0, 0, 0))

    action.frame_start = 1
    action.frame_end = 18
    armature.animation_data.action = None
    return action


def create_nla_tracks(armature: bpy.types.Object, actions: list[bpy.types.Action]) -> None:
    animation_data = armature.animation_data_create()
    for action in actions:
        track = animation_data.nla_tracks.new()
        track.name = action.name
        strip = track.strips.new(action.name, int(action.frame_start), action)
        strip.action_frame_start = action.frame_start
        strip.action_frame_end = action.frame_end
        track.mute = True


def validate(mesh: bpy.types.Object, actions: list[bpy.types.Action]) -> None:
    required_groups = {
        "hips",
        "spine",
        "chest",
        "head",
        "upper_arm.L",
        "upper_arm.R",
        "thigh.L",
        "thigh.R",
        "shin.L",
        "shin.R",
    }
    groups = {group.name for group in mesh.vertex_groups}
    missing = sorted(required_groups - groups)
    if missing:
        raise RuntimeError(f"Missing vertex groups after bind: {missing}")
    unweighted = [vertex.index for vertex in mesh.data.vertices if not vertex.groups]
    if unweighted:
        raise RuntimeError(f"Found {len(unweighted)} unweighted vertices")
    expected_actions = {"Idle", "Walk", "WeaponIdle", "WeaponWalk", "MeleeAttack"}
    if {action.name for action in actions} != expected_actions:
        raise RuntimeError(f"Expected actions {sorted(expected_actions)}")


def main() -> None:
    args = parse_args()
    source = Path(args.source).resolve()
    blend_output = Path(args.blend_output).resolve()
    glb_output = Path(args.glb_output).resolve()
    blend_output.parent.mkdir(parents=True, exist_ok=True)
    glb_output.parent.mkdir(parents=True, exist_ok=True)

    reset_scene()
    mesh = import_mesh(source)
    armature = create_armature()
    bind_mesh(mesh, armature)
    actions = [
        create_idle(armature),
        create_walk(armature),
        create_weapon_idle(armature),
        create_weapon_walk(armature),
        create_melee_attack(armature),
    ]
    create_nla_tracks(armature, actions)
    validate(mesh, actions)

    bpy.context.scene.render.fps = FPS
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 61
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_output))

    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.export_scene.gltf(
        filepath=str(glb_output),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_nla_strips=True,
        export_optimize_animation_size=True,
        export_optimize_animation_keep_anim_armature=True,
    )

    print(
        f"RIG_OK mesh={mesh.name} vertices={len(mesh.data.vertices)} "
        f"bones={len(armature.data.bones)} clips={[action.name for action in actions]} "
        f"glb={glb_output}"
    )


if __name__ == "__main__":
    main()
