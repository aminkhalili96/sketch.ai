#!/usr/bin/env python3
import argparse
import json
import math
import os
import sys

import bpy
from mathutils import Vector


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []

    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--resolution", type=int, default=1600)
    parser.add_argument("--samples", type=int, default=128)
    return parser.parse_args(argv)


def hex_to_rgba(value):
    if not value:
        return (0.8, 0.8, 0.8, 1.0)
    value = value.strip().lstrip("#")
    if len(value) != 6:
        return (0.8, 0.8, 0.8, 1.0)
    r = int(value[0:2], 16) / 255.0
    g = int(value[2:4], 16) / 255.0
    b = int(value[4:6], 16) / 255.0
    return (r, g, b, 1.0)


def create_material(name, color, material_type):
    material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf is None:
        return material

    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = 0.35
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Clearcoat"].default_value = 0.0
    bsdf.inputs["Clearcoat Roughness"].default_value = 0.2

    if material_type == "metal":
        bsdf.inputs["Metallic"].default_value = 1.0
        bsdf.inputs["Roughness"].default_value = 0.2
    elif material_type == "rubber":
        bsdf.inputs["Roughness"].default_value = 0.75
    elif material_type == "glass":
        bsdf.inputs["Transmission"].default_value = 0.9
        bsdf.inputs["Roughness"].default_value = 0.08
        bsdf.inputs["IOR"].default_value = 1.45
    else:
        bsdf.inputs["Clearcoat"].default_value = 0.25
        bsdf.inputs["Clearcoat Roughness"].default_value = 0.4

    return material


def ensure_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 128
    scene.cycles.device = "CPU"
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "High Contrast"
    return scene


def import_parts(manifest_path):
    with open(manifest_path, "r", encoding="utf-8") as handle:
        manifest = json.load(handle)

    base_dir = os.path.dirname(manifest_path)
    objects = []

    for part in manifest.get("parts", []):
        part_path = os.path.join(base_dir, part["file"])
        if not os.path.exists(part_path):
            continue
        bpy.ops.import_mesh.stl(filepath=part_path)
        obj = bpy.context.selected_objects[0]
        obj.name = part["name"]
        obj.scale = (0.001, 0.001, 0.001)
        objects.append((obj, part))

    bpy.context.view_layer.update()
    return objects


def compute_bounds(objects):
    min_v = Vector((1e9, 1e9, 1e9))
    max_v = Vector((-1e9, -1e9, -1e9))
    for obj, _part in objects:
        for corner in obj.bound_box:
            world_corner = obj.matrix_world @ Vector(corner)
            min_v.x = min(min_v.x, world_corner.x)
            min_v.y = min(min_v.y, world_corner.y)
            min_v.z = min(min_v.z, world_corner.z)
            max_v.x = max(max_v.x, world_corner.x)
            max_v.y = max(max_v.y, world_corner.y)
            max_v.z = max(max_v.z, world_corner.z)
    return min_v, max_v


def add_lights(center, size):
    key = bpy.data.lights.new(name="KeyLight", type="AREA")
    key.energy = 1200
    key.size = size * 1.2
    key_obj = bpy.data.objects.new("KeyLight", key)
    key_obj.location = (center.x + size * 1.4, center.y - size * 1.1, center.z + size * 1.2)
    bpy.context.collection.objects.link(key_obj)

    fill = bpy.data.lights.new(name="FillLight", type="AREA")
    fill.energy = 500
    fill.size = size * 1.6
    fill_obj = bpy.data.objects.new("FillLight", fill)
    fill_obj.location = (center.x - size * 1.2, center.y - size * 1.0, center.z + size * 0.6)
    bpy.context.collection.objects.link(fill_obj)

    rim = bpy.data.lights.new(name="RimLight", type="AREA")
    rim.energy = 800
    rim.size = size * 1.4
    rim_obj = bpy.data.objects.new("RimLight", rim)
    rim_obj.location = (center.x + size * 0.8, center.y + size * 1.6, center.z + size * 1.0)
    bpy.context.collection.objects.link(rim_obj)


def add_floor(center, size):
    bpy.ops.mesh.primitive_plane_add(size=size * 6, location=(center.x, center.y, center.z - size * 0.6))
    floor = bpy.context.active_object
    mat = create_material("Floor", (0.95, 0.95, 0.95, 1.0), "plastic")
    floor.data.materials.append(mat)


def add_camera(center, size):
    camera_data = bpy.data.cameras.new(name="Camera")
    camera = bpy.data.objects.new("Camera", camera_data)
    distance = size * 2.4
    camera.location = (center.x + distance, center.y - distance, center.z + distance * 0.8)
    bpy.context.collection.objects.link(camera)

    direction = center - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = camera


def main():
    args = parse_args()
    scene = ensure_scene()
    scene.render.resolution_x = args.resolution
    scene.render.resolution_y = int(args.resolution * 0.75)
    scene.cycles.samples = args.samples

    objects = import_parts(args.manifest)
    if not objects:
        raise RuntimeError("No parts imported for rendering.")

    materials = {}
    for obj, part in objects:
        color = hex_to_rgba(part.get("color"))
        material_type = part.get("material", "plastic")
        key = f"{material_type}-{part.get('color', '')}"
        if key not in materials:
            materials[key] = create_material(key, color, material_type)
        obj.data.materials.clear()
        obj.data.materials.append(materials[key])

    min_v, max_v = compute_bounds(objects)
    center = (min_v + max_v) * 0.5
    size = max(max_v.x - min_v.x, max_v.y - min_v.y, max_v.z - min_v.z)
    size = max(size, 0.2)

    add_floor(center, size)
    add_lights(center, size)
    add_camera(center, size)

    scene.world.use_nodes = True
    nodes = scene.world.node_tree.nodes
    bg = nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.97, 0.97, 0.98, 1.0)
        bg.inputs["Strength"].default_value = 1.0

    scene.render.filepath = args.output
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
