"""The conifer: whorls of drooping branch cards around a tapered trunk, the
cards showing sprays of a real fir's twigs seen from above.

blender --background --factory-startup --python conifer.py -- <fir_tree_01.gltf> <assets dir> <preview dir>
"""
import math
import os
import random
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(__file__))
import common  # noqa: E402

SOURCE, ASSETS, PREVIEWS = common.script_args()
TEXTURES = os.path.join(os.path.dirname(SOURCE), 'textures')
rng = random.Random(11)
np.random.seed(11)

HEIGHT = 16.0
CROWN_BASE = 0.12  # share of the height where the lowest branches grow
BASE_RADIUS = 3.4
WHORL_STEP = 0.34
TILE = 512

# ---- Sprays of real twigs, seen from above, for the atlas.
scene = common.reset()
parts = common.import_reference(SOURCE)
twigs = parts.pop('fir_tree_01_twig')
for o in parts.values():
    bpy.data.objects.remove(o)
common.restore_alpha(twigs.active_material, os.path.join(TEXTURES, 'fir_tree_01_twig_alpha_1k.png'))
centres = np.zeros(len(twigs.data.polygons) * 3)
twigs.data.polygons.foreach_get('center', centres)
sample = centres.reshape(-1, 3)
sample = sample[np.random.choice(len(sample), 40000, replace=False)]
K = 40
means = sample[np.random.choice(len(sample), K, replace=False)]
for _ in range(20):
    labels = np.argmin(((sample[:, None] - means[None]) ** 2).sum(-1), axis=1)
    for k in range(K):
        if (labels == k).any():
            means[k] = sample[labels == k].mean(0)
counts = np.bincount(labels, minlength=K)

common.daylight(scene)
cam = common.ortho_camera(scene)
scene.render.film_transparent = True
scene.render.resolution_x = scene.render.resolution_y = TILE
twigs.hide_render = True
tiles = []
for n, k in enumerate(np.argsort(-counts)[:4]):
    centre = Vector(means[k])
    piece = twigs.copy()
    piece.data = twigs.data.copy()
    piece.hide_render = False
    scene.collection.objects.link(piece)
    bm = bmesh.new()
    bm.from_mesh(piece.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if (f.calc_center_median() - centre).length > 1.0],
                     context='FACES')
    bm.to_mesh(piece.data)
    bm.free()
    cam.location = centre + Vector((0, 0, 10))
    cam.rotation_euler = (0, 0, rng.uniform(0, math.pi))
    cam.data.ortho_scale = 2.0
    scene.render.filepath = os.path.join(PREVIEWS, f'needles_{n}.png')
    bpy.ops.render.render(write_still=True)
    tiles.append(scene.render.filepath)
    bpy.data.objects.remove(piece)
bpy.data.objects.remove(twigs)
atlas = common.save_atlas(tiles, TILE, os.path.join(ASSETS, 'textures', 'needles.png'))
common.save_texture(os.path.join(TEXTURES, 'fir_tree_01_trunk_a_diff_1k.jpg'),
                    os.path.join(ASSETS, 'textures', 'fir_bark.png'), 512)

# ---- Trunk: a tapered cylinder.
bm = bmesh.new()
uv = bm.loops.layers.uv.new()
SIDES, RINGS = 9, 8
rings = []
for r in range(RINGS + 1):
    radius = 0.32 * (1 - r / RINGS) + 0.03
    rings.append([bm.verts.new((radius * math.cos(2 * math.pi * k / SIDES), radius * math.sin(2 * math.pi * k / SIDES),
                                HEIGHT * r / RINGS - 0.3)) for k in range(SIDES)])
for r in range(RINGS):
    for k in range(SIDES):
        n = (k + 1) % SIDES
        f = bm.faces.new((rings[r][k], rings[r][n], rings[r + 1][n], rings[r + 1][k]))
        f.smooth = True
        for loop, (s, t) in zip(f.loops, ((k, r), (k + 1, r), (k + 1, r + 1), (k, r + 1))):
            loop[uv].uv = (s / SIDES, t * HEIGHT / RINGS / 2.5)
trunk_mesh = bpy.data.meshes.new('trunk')
bm.to_mesh(trunk_mesh)
bm.free()
trunk = bpy.data.objects.new('trunk', trunk_mesh)
scene.collection.objects.link(trunk)
bark = bpy.data.materials.new('fir_bark')
trunk.data.materials.append(bark)

# ---- Crown: whorls of branches, two crossed cards each, drooping towards their tips.
bm = bmesh.new()
uv = bm.loops.layers.uv.new()


def card(root, tip, width, roll, tile):
    along = tip - root
    side = Matrix.Rotation(roll, 3, along.normalized()) @ along.cross(Vector((0, 0, 1))).normalized()
    corners = [root - side * width * 0.25, tip - side * width / 2, tip + side * width / 2, root + side * width * 0.25]
    face = bm.faces.new([bm.verts.new(c) for c in corners])
    u0, v0 = (tile % 2) * 0.5, (tile // 2) * 0.5
    for loop, (s, t) in zip(face.loops, ((0, 0.1), (1, 0), (1, 1), (0, 0.9))):
        loop[uv].uv = (u0 + t * 0.5, v0 + s * 0.5)


base = HEIGHT * CROWN_BASE
z = base
while z < HEIGHT - 0.3:
    share = (z - base) / (HEIGHT - base)
    reach = BASE_RADIUS * (1 - share) ** 1.05 + 0.25
    branches = max(4, round(7 - share * 3))
    turn = rng.uniform(0, 2 * math.pi)
    for b in range(branches):
        angle = turn + 2 * math.pi * b / branches + rng.uniform(-0.25, 0.25)
        length = reach * rng.uniform(0.85, 1.12)
        root = Vector((0, 0, z))
        tip = root + Vector((math.cos(angle), math.sin(angle), 0)) * length + Vector((0, 0, -length * rng.uniform(0.18, 0.32)))
        width = max(0.7, length * 0.75)
        tile = rng.randrange(4)
        card(root, tip, width, rng.uniform(-0.2, 0.2), tile)
        card(root, tip, width * 0.8, math.pi / 2 + rng.uniform(-0.3, 0.3), tile)
    z += WHORL_STEP * rng.uniform(0.8, 1.2)
for a in range(3):  # the leader
    out = Vector((math.cos(a * math.pi / 3), math.sin(a * math.pi / 3), 0)) * 0.45
    face = bm.faces.new([bm.verts.new(c) for c in (
        Vector((0, 0, HEIGHT - 1.6)) - out, Vector((0, 0, HEIGHT - 1.6)) + out,
        Vector((0, 0, HEIGHT + 0.2)) + out * 0.2, Vector((0, 0, HEIGHT + 0.2)) - out * 0.2)])
    for loop, (s, t) in zip(face.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop[uv].uv = (s * 0.5, t * 0.5)
crown_mesh = bpy.data.meshes.new('needles')
bm.to_mesh(crown_mesh)
bm.free()
crown = bpy.data.objects.new('needles', crown_mesh)
scene.collection.objects.link(crown)
needles = bpy.data.materials.new('needles')
needles.use_nodes = True
needles.surface_render_method = 'DITHERED'
tex = needles.node_tree.nodes.new('ShaderNodeTexImage')
tex.image = atlas
bsdf = needles.node_tree.nodes['Principled BSDF']
needles.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
needles.node_tree.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
crown.data.materials.append(needles)

common.export_mesh([trunk, crown], os.path.join(ASSETS, 'trees', 'conifer.json'),
                   {'fir_bark': 'firBark', 'needles': 'needles'}, foliage=('needles',),
                   crown=Vector((0, 0, HEIGHT * 0.4)))
common.preview(scene, [trunk, crown], os.path.join(PREVIEWS, 'conifer.png'))
