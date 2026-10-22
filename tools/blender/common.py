"""Shared helpers of the scenery asset scripts, run inside Blender."""
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector


def script_args():
    """The arguments given after `--` on Blender's command line."""
    return sys.argv[sys.argv.index('--') + 1:]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.view_settings.view_transform = 'Standard'
    return scene


def import_reference(path):
    """Imports a glTF model and keeps its object standing nearest the origin,
    split into one object per material, keyed by material name."""
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    keep = min(meshes, key=lambda o: o.matrix_world.translation.length)
    for o in meshes:
        if o is not keep:
            bpy.data.objects.remove(o)
    bpy.context.view_layer.objects.active = keep
    keep.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.separate(type='MATERIAL')
    bpy.ops.object.mode_set(mode='OBJECT')
    return {o.active_material.name: o for o in bpy.context.scene.objects if o.type == 'MESH'}


def restore_alpha(material, alpha_path):
    """Feeds a separate alpha map into a material whose JPEG colour lost its cut-out."""
    nt = material.node_tree
    bsdf = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled')
    colour = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeTexImage' and n.outputs['Color'].links
                  and 'diff' in n.image.name)
    alpha = nt.nodes.new('ShaderNodeTexImage')
    alpha.image = bpy.data.images.load(alpha_path)
    alpha.image.colorspace_settings.name = 'Non-Color'
    if colour.inputs['Vector'].links:
        nt.links.new(colour.inputs['Vector'].links[0].from_socket, alpha.inputs['Vector'])
    nt.links.new(alpha.outputs['Color'], bsdf.inputs['Alpha'])
    material.surface_render_method = 'DITHERED'


def daylight(scene, strength=0.9):
    world = bpy.data.worlds.new('sky')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.58, 0.7, 0.86, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = strength
    scene.world = world
    bpy.ops.object.light_add(type='SUN', rotation=(0.8, 0.2, 0.9))
    bpy.context.object.data.energy = 4


def ortho_camera(scene):
    bpy.ops.object.camera_add()
    cam = bpy.context.object
    cam.data.type = 'ORTHO'
    scene.camera = cam
    return cam


def look(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def save_atlas(tiles, size, path):
    """Packs four square renders into a 2 x 2 atlas with a hard alpha. Cut texels
    take the mean colour, so mipmaps blend foliage with foliage, never with white."""
    import numpy as np

    atlas = np.zeros((size * 2, size * 2, 4), dtype=np.float32)
    for n, tile in enumerate(tiles):
        pixels = np.array(bpy.data.images.load(tile).pixels[:], dtype=np.float32).reshape(size, size, 4)
        row, col = divmod(n, 2)
        atlas[row * size:(row + 1) * size, col * size:(col + 1) * size] = pixels
    solid = atlas[..., 3:] > 0.5
    mean = atlas[..., :3][solid[..., 0]].mean(0)
    atlas[..., :3] = np.where(solid, atlas[..., :3], mean)
    atlas[..., 3:] = np.where(solid, 1.0, 0.0)
    image = bpy.data.images.new(os.path.basename(path), size * 2, size * 2, alpha=True)
    image.pixels = atlas.ravel()
    image.filepath_raw = path
    image.file_format = 'PNG'
    image.save()
    return image


def save_texture(source, path, size, tint=(1, 1, 1), saturation=1.0, mean=None):
    """A source image resized to a square of `size` and tinted, saved as PNG.
    `saturation` moves its colours towards grey (0) or away from it; `mean`, an
    sRGB colour (0-255), rescales each channel so the image averages to it."""
    import numpy as np

    image = bpy.data.images.load(source)
    image.scale(size, size)
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(-1, 4)
    rgb = pixels[:, :3]
    grey = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    rgb = grey[:, None] + (rgb - grey[:, None]) * saturation
    if mean is not None:
        # The pixels of an 8-bit image come as stored, in sRGB.
        target = np.array(mean, dtype=np.float32) / 255
        rgb = rgb * target / np.maximum(rgb.mean(axis=0), 1e-6)
    pixels[:, :3] = np.clip(rgb * np.array(tint, dtype=np.float32), 0, 1)
    out = bpy.data.images.new(os.path.basename(path), size, size, alpha=False)
    out.pixels = pixels.ravel()
    out.filepath_raw = path
    out.file_format = 'PNG'
    out.save()


def export_mesh(objects, path, materials, foliage=(), crown=None):
    """Writes objects as one indexed triangle mesh per material, in metres with
    z up, for Roadbuilder (src/assets/scenery). `materials` maps each Blender
    material to the name Roadbuilder knows it by. Foliage normals point out of
    the crown centre, so cards shade like a rounded mass of leaves."""
    parts = {}
    top = 0.0
    for obj in objects:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bm.transform(obj.matrix_world)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        bm.normal_update()
        uv_layer = bm.loops.layers.uv.active
        for face in bm.faces:
            name = materials[obj.material_slots[face.material_index].material.name]
            part = parts.setdefault(name, {'material': name, 'positions': [], 'normals': [], 'uvs': [],
                                           'indices': [], 'seen': {}})
            for loop in face.loops:
                p = loop.vert.co
                top = max(top, p.z)
                if name in foliage and crown is not None:
                    n = (p - crown)
                    n.z += n.length * 0.6
                    n = n.normalized()
                elif face.smooth:
                    n = loop.vert.normal
                else:
                    n = face.normal
                uv = loop[uv_layer].uv if uv_layer else (0, 0)
                key = (round(p.x, 3), round(p.y, 3), round(p.z, 3), round(n.x, 2), round(n.y, 2), round(n.z, 2),
                       round(uv[0], 4), round(uv[1], 4))
                index = part['seen'].get(key)
                if index is None:
                    index = len(part['positions']) // 3
                    part['seen'][key] = index
                    part['positions'] += key[:3]
                    part['normals'] += key[3:6]
                    part['uvs'] += key[6:]
                part['indices'].append(index)
        bm.free()
    for part in parts.values():
        del part['seen']
    with open(path, 'w', encoding='utf8') as f:
        json.dump({'height': round(top, 3), 'parts': list(parts.values())}, f, separators=(',', ':'))
    print('MESH', path, {n: len(p['indices']) // 3 for n, p in parts.items()})


def preview(scene, objects, path, distance=1.3):
    """A daylight render of objects, framed from three quarters."""
    lo = Vector((1e9,) * 3)
    hi = -lo
    for o in objects:
        for corner in o.bound_box:
            w = o.matrix_world @ Vector(corner)
            lo, hi = Vector(map(min, lo, w)), Vector(map(max, hi, w))
    centre, size = (lo + hi) / 2, max(hi - lo)
    scene.render.film_transparent = False
    scene.render.resolution_x = scene.render.resolution_y = 900
    bpy.ops.object.camera_add(location=centre + Vector((size * distance, -size * distance, size * 0.4)))
    cam = bpy.context.object
    cam.data.lens = 50
    look(cam, centre)
    scene.camera = cam
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print('PREVIEW', path)


def cards_star(bm, uv, centre, half, count, tilt, rng):
    """`count` quads crossing at `centre`, turned evenly, tilted at random, on a random atlas tile."""
    from mathutils import Matrix

    tile = rng.randrange(4)
    u0, v0 = (tile % 2) * 0.5, (tile // 2) * 0.5  # Blender images start at the bottom row, like UVs.
    turn = rng.uniform(0, math.pi)
    for n in range(count):
        rot = Matrix.Rotation(turn + n * math.pi / count, 3, 'Z') @ Matrix.Rotation(rng.uniform(-tilt, tilt), 3, 'X')
        corners = [centre + rot @ Vector((x * half, 0, z * half)) for x, z in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        face = bm.faces.new([bm.verts.new(c) for c in corners])
        for loop, (s, t) in zip(face.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
            loop[uv].uv = (u0 + s * 0.5, v0 + t * 0.5)
