"""The broadleaf tree: the wood of a high-poly reference, simplified, and a
crown of alpha-tested cards showing sprays of the reference's own leaves.

blender --background --factory-startup --python leafy_tree.py -- <tree_small_02.gltf> <assets dir> <preview dir>
"""
import math
import os
import random
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
import common  # noqa: E402

SOURCE, ASSETS, PREVIEWS = common.script_args()
TEXTURES = os.path.join(os.path.dirname(SOURCE), 'textures')
rng = random.Random(7)
np.random.seed(7)

WOOD_TRIS = 2500
CLUSTERS = 220
FILLERS = 90  # cards filling the inside of the crown, so the sky does not show through
TILE = 512

scene = common.reset()
parts = common.import_reference(SOURCE)
leaves = parts.pop('tree_small_02_leaves')
wood = list(parts.values())

# ---- Clusters of leaves: where the cards go.
centres = np.zeros(len(leaves.data.polygons) * 3)
leaves.data.polygons.foreach_get('center', centres)
sample = centres.reshape(-1, 3)
sample = sample[np.random.choice(len(sample), min(60000, len(sample)), replace=False)]
means = sample[np.random.choice(len(sample), CLUSTERS, replace=False)]
for _ in range(25):
    labels = np.argmin(((sample[:, None, :] - means[None]) ** 2).sum(-1), axis=1)
    for k in range(CLUSTERS):
        if (labels == k).any():
            means[k] = sample[labels == k].mean(0)
spreads = np.array([np.sqrt(((sample[labels == k] - means[k]) ** 2).sum(-1)).mean() if (labels == k).any() else 0
                    for k in range(CLUSTERS)])
counts = np.bincount(labels, minlength=CLUSTERS)

# ---- Atlas: four sprays of real leaves, seen from the side.
common.daylight(scene)
cam = common.ortho_camera(scene)
scene.render.film_transparent = True
scene.render.resolution_x = scene.render.resolution_y = TILE
for o in wood:
    o.hide_render = True
leaves.hide_render = True
tiles = []
for n, k in enumerate(rng.sample(list(np.argsort(-counts)[:12]), 4)):
    centre = Vector(means[k])
    radius = max(0.6, float(spreads[k]) * 3)
    piece = leaves.copy()
    piece.data = leaves.data.copy()
    piece.hide_render = False
    scene.collection.objects.link(piece)
    bm = bmesh.new()
    bm.from_mesh(piece.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if (f.calc_center_median() - centre).length > radius],
                     context='FACES')
    bm.to_mesh(piece.data)
    bm.free()
    angle = rng.uniform(0, 2 * math.pi)
    cam.location = centre + Vector((math.cos(angle), math.sin(angle), 0.15)) * 6
    common.look(cam, centre)
    cam.data.ortho_scale = radius * 2
    scene.render.filepath = os.path.join(PREVIEWS, f'leaves_{n}.png')
    bpy.ops.render.render(write_still=True)
    tiles.append(scene.render.filepath)
    bpy.data.objects.remove(piece)
atlas = common.save_atlas(tiles, TILE, os.path.join(ASSETS, 'textures', 'leaves.png'))
for o in wood:
    o.hide_render = False

# ---- Wood, simplified; its two materials keep their textures.
bpy.ops.object.select_all(action='DESELECT')
for o in wood:
    o.select_set(True)
bpy.context.view_layer.objects.active = wood[0]
bpy.ops.object.join()
trunk = bpy.context.object
decimate = trunk.modifiers.new('decimate', 'DECIMATE')
decimate.ratio = min(1, WOOD_TRIS / sum(len(p.vertices) - 2 for p in trunk.data.polygons))
bpy.ops.object.modifier_apply(modifier='decimate')
for polygon in trunk.data.polygons:
    polygon.use_smooth = True
common.save_texture(os.path.join(TEXTURES, 'tree_small_02_diff_1k.jpg'), os.path.join(ASSETS, 'textures', 'bark.png'), 512)
common.save_texture(os.path.join(TEXTURES, 'tree_small_02_branch_diff_1k.jpg'),
                    os.path.join(ASSETS, 'textures', 'branches.png'), 512)

# ---- Crown: stars of tilted cards on the clusters, and more filling its core.
mesh = bpy.data.meshes.new('leaves')
bm = bmesh.new()
uv = bm.loops.layers.uv.new()
used = [k for k in range(CLUSTERS) if counts[k] >= 20]
for k in used:
    common.cards_star(bm, uv, Vector(means[k]), max(0.4, float(spreads[k]) * 2.4), 3, 0.7, rng)
crown = Vector(means[used].mean(0))
for _ in range(FILLERS):
    common.cards_star(bm, uv, crown.lerp(Vector(means[rng.choice(used)]), rng.uniform(0.35, 0.8)),
                      rng.uniform(0.6, 0.9), 2, 0.5, rng)
bm.to_mesh(mesh)
bm.free()
cards = bpy.data.objects.new('leaves', mesh)
scene.collection.objects.link(cards)
material = bpy.data.materials.new('leaves')
material.use_nodes = True
material.surface_render_method = 'DITHERED'
tex = material.node_tree.nodes.new('ShaderNodeTexImage')
tex.image = atlas
bsdf = material.node_tree.nodes['Principled BSDF']
material.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
material.node_tree.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
cards.data.materials.append(material)

bpy.data.objects.remove(leaves)
common.export_mesh(
    [trunk, cards], os.path.join(ASSETS, 'trees', 'leafy.json'),
    {'tree_small_02_trunk': 'bark', 'tree_small_02_branches': 'branches', 'leaves': 'leaves'},
    foliage=('leaves',), crown=crown,
)
common.preview(scene, [trunk, cards], os.path.join(PREVIEWS, 'leafy.png'))
