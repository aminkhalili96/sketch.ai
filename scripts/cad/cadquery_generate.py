#!/usr/bin/env python3
import argparse
import json
import math
import os
import sys

try:
    import cadquery as cq
    from cadquery import exporters
except Exception as exc:  # pragma: no cover
    print("CadQuery import failed. Install CadQuery and try again.", file=sys.stderr)
    raise


def clamp(value, min_value, max_value):
    return max(min_value, min(max_value, value))


def rounded_box(width, depth, height, radius):
    solid = cq.Workplane("XY").box(width, depth, height)
    fillet = max(0.0, radius)
    if fillet <= 0.01:
        return solid

    max_radius = min(width, depth) / 2.0 - 0.1
    fillet = min(fillet, max_radius)

    try:
        solid = solid.edges("|Z").fillet(fillet)
        edge_fillet = min(fillet * 0.35, height * 0.25)
        if edge_fillet > 0.01:
            solid = solid.edges(">Z").fillet(edge_fillet)
            solid = solid.edges("<Z").fillet(edge_fillet)
    except Exception:
        return solid

    return solid


def map_spec_to_cq(point):
    x, y, z = point
    return (x, z, y)


def build_shell(shape, width, depth, height, wall, radius, cutouts):
    if shape == "round":
        outer = cq.Workplane("XY").circle(width / 2.0).extrude(height)
        inner = cq.Workplane("XY").circle(max(1.0, width / 2.0 - wall)).extrude(height - wall)
    else:
        outer = rounded_box(width, depth, height, radius)
        inner = rounded_box(width - 2 * wall, depth - 2 * wall, height - wall, max(0.0, radius - wall))

    inner = inner.translate((0, 0, wall))
    shell = outer.cut(inner)

    for cutout in cutouts:
        shell = shell.cut(cutout)

    return shell


def build_port_cutout(port, enclosure):
    width = enclosure["width"]
    depth = enclosure["depth"]
    height = enclosure["height"]
    wall = enclosure["wall"]

    offset = port.get("offset") or [0, 0]
    offset_a = offset[0]
    offset_b = offset[1]
    size = port["size"]
    cut_w, cut_h, cut_d = size[0], size[1], size[2]

    side = port["side"]
    pos = [0, 0, 0]
    if side == "front":
        pos = [offset_a, offset_b, depth / 2.0 - wall / 2.0]
    elif side == "back":
        pos = [offset_a, offset_b, -(depth / 2.0 - wall / 2.0)]
    elif side == "left":
        pos = [-(width / 2.0 - wall / 2.0), offset_b, offset_a]
    elif side == "right":
        pos = [width / 2.0 - wall / 2.0, offset_b, offset_a]
    elif side == "top":
        pos = [offset_a, height / 2.0 - wall / 2.0, offset_b]
    elif side == "bottom":
        pos = [offset_a, -(height / 2.0 - wall / 2.0), offset_b]

    cutout = cq.Workplane("XY").box(cut_w, cut_d, cut_h)
    if side in ("left", "right"):
        cutout = cutout.rotate((0, 0, 0), (0, 0, 1), 90)
    elif side in ("top", "bottom"):
        cutout = cutout.rotate((0, 0, 0), (1, 0, 0), 90)

    cutout = cutout.translate(map_spec_to_cq(pos))
    return cutout


def build_port_connector(port, enclosure):
    width = enclosure["width"]
    depth = enclosure["depth"]
    height = enclosure["height"]
    wall = enclosure["wall"]

    offset = port.get("offset") or [0, 0]
    offset_a = offset[0]
    offset_b = offset[1]
    size = port["size"]
    cut_w, cut_h, cut_d = size[0], size[1], size[2]

    side = port["side"]
    pos = [0, 0, 0]
    normal = [0, 0, 0]
    if side == "front":
        pos = [offset_a, offset_b, depth / 2.0 - wall / 2.0]
        normal = [0, 0, 1]
    elif side == "back":
        pos = [offset_a, offset_b, -(depth / 2.0 - wall / 2.0)]
        normal = [0, 0, -1]
    elif side == "left":
        pos = [-(width / 2.0 - wall / 2.0), offset_b, offset_a]
        normal = [-1, 0, 0]
    elif side == "right":
        pos = [width / 2.0 - wall / 2.0, offset_b, offset_a]
        normal = [1, 0, 0]
    elif side == "top":
        pos = [offset_a, height / 2.0 - wall / 2.0, offset_b]
        normal = [0, 1, 0]
    elif side == "bottom":
        pos = [offset_a, -(height / 2.0 - wall / 2.0), offset_b]
        normal = [0, -1, 0]

    connector = cq.Workplane("XY").box(cut_w * 0.9, cut_d * 0.7, cut_h * 0.85)
    if side in ("left", "right"):
        connector = connector.rotate((0, 0, 0), (0, 0, 1), 90)
    elif side in ("top", "bottom"):
        connector = connector.rotate((0, 0, 0), (1, 0, 0), 90)

    offset_dist = cut_d * 0.35 + wall * 0.4
    pos = [
        pos[0] + normal[0] * offset_dist,
        pos[1] + normal[1] * offset_dist,
        pos[2] + normal[2] * offset_dist,
    ]

    connector = connector.translate(map_spec_to_cq(pos))
    return connector


def build_pcb(spec):
    pcb = spec["pcb"]
    thickness = pcb["thickness"]

    if pcb["shape"] == "round":
        board = cq.Workplane("XY").circle(pcb["width"] / 2.0).extrude(thickness)
    else:
        radius = clamp(min(pcb["width"], pcb["depth"]) * 0.08, 2, 8)
        board = rounded_box(pcb["width"], pcb["depth"], thickness, radius)

    board = board.translate(map_spec_to_cq([0, pcb["offsetY"], 0]))
    return board


def build_components(spec):
    components = []
    pcb = spec["pcb"]
    board_top_y = pcb["offsetY"] + pcb["thickness"] / 2.0

    for idx, comp in enumerate(spec["components"]):
        size = comp["size"]
        position = comp["position"]
        height_offset = board_top_y + size[1] / 2.0 + 0.4 + position[1]
        pos = [position[0], height_offset, position[2]]

        if comp.get("role") == "led":
            solid = cq.Workplane("XY").sphere(max(0.6, size[0] / 2.0))
        else:
            solid = cq.Workplane("XY").box(size[0], size[2], size[1])

        solid = solid.translate(map_spec_to_cq(pos))
        components.append((f"component_{idx + 1}", solid))

    return components


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--mode", choices=["assembled", "exploded"], default="exploded")
    args = parser.parse_args()

    with open(args.spec, "r", encoding="utf-8") as handle:
        spec = json.load(handle)

    os.makedirs(args.out_dir, exist_ok=True)
    parts_dir = os.path.join(args.out_dir, "parts")
    os.makedirs(parts_dir, exist_ok=True)

    enclosure = spec["enclosure"]
    pcb = spec["pcb"]
    exploded_gap = spec.get("view", {}).get("explodedGap", 0) if args.mode == "exploded" else 0

    board_thickness = pcb["thickness"]
    top_y = board_thickness / 2.0 + enclosure["gap"] + enclosure["topHeight"] / 2.0 + exploded_gap
    bottom_y = -(board_thickness / 2.0 + enclosure["gap"] + enclosure["bottomHeight"] / 2.0 + exploded_gap)

    cutouts = [build_port_cutout(port, enclosure) for port in spec.get("ports", [])]
    shell_top = build_shell(
        enclosure["shape"],
        enclosure["width"],
        enclosure["depth"],
        enclosure["topHeight"],
        enclosure["wall"],
        enclosure["cornerRadius"],
        cutouts,
    ).translate(map_spec_to_cq([0, top_y, 0]))

    shell_bottom = build_shell(
        enclosure["shape"],
        enclosure["width"] * 0.96,
        enclosure["depth"] * 0.96,
        enclosure["bottomHeight"],
        enclosure["wall"],
        max(2.0, enclosure["cornerRadius"] * 0.9),
        cutouts,
    ).translate(map_spec_to_cq([0, bottom_y, 0]))

    board = build_pcb(spec)
    components = build_components(spec)

    port_connectors = []
    for idx, port in enumerate(spec.get("ports", [])):
        connector = build_port_connector(port, enclosure)
        port_connectors.append((f"port_{idx + 1}", connector))

    parts = [
        ("shell_top", shell_top),
        ("shell_bottom", shell_bottom),
        ("pcb", board),
    ] + components + port_connectors

    manifest = {
        "version": 1,
        "parts": []
    }

    assembly = cq.Assembly()
    solids_for_mesh = []

    for name, solid in parts:
        file_path = os.path.join(parts_dir, f"{name}.stl")
        exporters.export(solid, file_path)
        solids_for_mesh.append(solid.val())
        assembly.add(solid, name=name)

        material = "plastic"
        color = "#D4D4D4"
        if name == "shell_top":
            color = enclosure.get("colorTop", "#B9B2A8")
        elif name == "shell_bottom":
            color = enclosure.get("colorBottom", "#8F8983")
        elif name == "pcb":
            color = pcb.get("color", "#2F7D4E")
        elif name.startswith("port_"):
            material = "metal"
            color = "#B7BCC2"
        elif name.startswith("component_"):
            comp_index = int(name.split("_")[1]) - 1
            comp = spec["components"][comp_index]
            material = comp.get("material", "plastic")
            color = comp.get("color", "#403B35")

        manifest["parts"].append({
            "name": name,
            "file": f"parts/{name}.stl",
            "material": material,
            "color": color,
        })

    step_path = os.path.join(args.out_dir, "assembly.step")
    try:
        exporters.export(assembly, step_path)
    except Exception:
        compound = cq.Compound.makeCompound(solids_for_mesh)
        exporters.export(compound, step_path)

    compound = cq.Compound.makeCompound(solids_for_mesh)
    exporters.export(compound, os.path.join(args.out_dir, "assembly.stl"))

    manifest_path = os.path.join(args.out_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)


if __name__ == "__main__":
    main()
