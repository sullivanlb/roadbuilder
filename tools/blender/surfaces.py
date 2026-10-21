"""Tiling surfaces of buildings and grandstands, the glazing gradient and the
advertising boards of fictional brands.

blender --background --factory-startup --python surfaces.py -- <sources dir> <assets dir>
"""
import math
import os
import sys

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import common  # noqa: E402

SOURCES, ASSETS = common.script_args()
TEXTURES = os.path.join(ASSETS, 'textures')
source = lambda name: os.path.join(SOURCES, 'textures', f'{name}_diff_1k.jpg')

# Name in Roadbuilder (file name), Poly Haven source, tint.
SURFACES = [
    ('brick', 'brick_wall_02', (1, 1, 1)),
    ('stone', 'concrete_wall_008', (1.15, 1.12, 1.05)),
    ('roofing', 'concrete_wall_008', (0.55, 0.55, 0.55)),
    ('cladding', 'corrugated_iron_02', (0.75, 0.8, 0.85)),
    ('sheet', 'corrugated_iron_02', (0.85, 0.87, 0.9)),
]
common.reset()
for name, poly_haven, tint in SURFACES:
    common.save_texture(source(poly_haven), os.path.join(TEXTURES, f'{name}.png'), 512, tint)
    print('SURFACE', name)

# Glazing: dark inside towards the bottom, the sky reflected towards the top.
height = 256
v = np.linspace(0, 1, height)[:, None]
fade = np.clip((v - 0.2) / 0.7, 0, 1) ** 1.4
low, high = np.array([0.04, 0.05, 0.06]), np.array([0.5, 0.6, 0.7])
rows = low + (high - low) * fade
pixels = np.concatenate([np.repeat(rows[:, None, :], 16, axis=1), np.ones((height, 16, 1))], axis=2)
glass = bpy.data.images.new('glass', 16, height, alpha=False)
glass.pixels = pixels.astype(np.float32).ravel()
glass.filepath_raw = os.path.join(TEXTURES, 'glass.png')
glass.file_format = 'PNG'
glass.save()

# Advertising: name, tagline, background, ink, accent. Fictional brands only.
ADS = [
    ('APEX OIL', 'MOTOR LUBRICANTS', (0.02, 0.06, 0.2), (1.0, 0.78, 0.05), (0.95, 0.95, 0.95)),
    ('KERBSTONE', 'PERFORMANCE TYRES', (0.02, 0.02, 0.02), (0.95, 0.95, 0.95), (0.85, 0.05, 0.04)),
    ('VELOCE', 'ENERGY DRINK', (0.75, 0.03, 0.03), (1.0, 1.0, 1.0), (0.05, 0.05, 0.05)),
    ('ROADBUILDER', 'TRACK DESIGN', (0.04, 0.3, 0.12), (0.95, 0.98, 0.9), (0.85, 0.95, 0.3)),
]
WIDTH, HEIGHT = 4.0, 1.0


def flat(name, colour):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    emission = nt.nodes.new('ShaderNodeEmission')
    emission.inputs['Color'].default_value = (*colour, 1)
    nt.links.new(emission.outputs['Emission'], nt.nodes['Material Output'].inputs['Surface'])
    return m


def plane(material, location, scale, rotation=0.0):
    bpy.ops.mesh.primitive_plane_add(size=1, location=location)
    o = bpy.context.object
    o.scale = (*scale, 1)
    o.rotation_euler = (0, 0, rotation)
    o.data.materials.append(material)


def text(body, size, colour, location):
    bpy.ops.object.text_add(location=location)
    t = bpy.context.object
    t.data.body = body
    t.data.size = size
    t.data.align_x = 'CENTER'
    t.data.align_y = 'CENTER'
    t.data.space_character = 1.05
    t.data.materials.append(flat(f'ink_{body}', colour))


for n, (brand, tagline, background, ink, accent) in enumerate(ADS):
    scene = common.reset()
    plane(flat('background', background), (0, 0, 0), (WIDTH, HEIGHT))
    plane(flat('band', accent), (0, -HEIGHT * 0.36, 0.001), (WIDTH, HEIGHT * 0.1))
    for k in range(3):
        plane(flat('chevron', accent if k % 2 else ink), (-WIDTH * 0.42 + k * 0.16, 0.05, 0.002), (0.08, HEIGHT * 0.5),
              math.radians(-20))
    text(brand, HEIGHT * 0.42, ink, (0.25, 0.1, 0.003))
    text(tagline, HEIGHT * 0.13, ink, (0.25, -0.2, 0.003))
    cam = common.ortho_camera(scene)
    cam.location = (0, 0, 5)
    cam.data.ortho_scale = WIDTH
    scene.render.resolution_x, scene.render.resolution_y = 1024, 256
    scene.render.filepath = os.path.join(TEXTURES, f'ad_{n}.png')
    bpy.ops.render.render(write_still=True)
    print('AD', brand)
