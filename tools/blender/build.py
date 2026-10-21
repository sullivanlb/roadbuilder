"""Builds the scenery assets of Roadbuilder (docs/adr/0014).

Downloads the CC0 sources from Poly Haven into .cache/scenery-sources, then
runs the Blender scripts beside this file, which write the tree meshes and
the textures into src/assets/scenery. Previews go to .cache/scenery-previews.

    npm run assets:scenery
    BLENDER=/path/to/blender npm run assets:scenery

Run it with plain Python 3; it starts Blender itself.
"""
import glob
import json
import os
import subprocess
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SOURCES = os.path.join(ROOT, '.cache', 'scenery-sources')
PREVIEWS = os.path.join(ROOT, '.cache', 'scenery-previews')
ASSETS = os.path.join(ROOT, 'src', 'assets', 'scenery')
API = 'https://api.polyhaven.com/files/'
# Poly Haven's API turns away requests that do not say who sends them.
HEADERS = {'User-Agent': 'Roadbuilder scenery build'}


def open_url(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS))


MODELS = {
    'tree_small_02': [],
    # Its twigs' colour comes as JPEG: the cut-out is a separate map.
    'fir_tree_01': ['twig_alpha'],
}
TEXTURES = ['brick_wall_02', 'concrete_wall_008', 'corrugated_iron_02']


def fetch(url, path):
    if os.path.exists(path):
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    print('download', url)
    with open_url(url) as response, open(path + '.part', 'wb') as out:
        out.write(response.read())
    os.replace(path + '.part', path)


def files(asset):
    with open_url(API + asset) as response:
        return json.load(response)


def download():
    for model, extra_maps in MODELS.items():
        folder = os.path.join(SOURCES, model)
        gltf = files(model)['gltf']['1k']['gltf']
        fetch(gltf['url'], os.path.join(folder, f'{model}.gltf'))
        for name, entry in gltf['include'].items():
            fetch(entry['url'], os.path.join(folder, name))
        listing = files(model)
        for extra in extra_maps:
            fetch(listing[extra]['1k']['png']['url'], os.path.join(folder, 'textures', f'{model}_{extra}_1k.png'))
    for texture in TEXTURES:
        url = files(texture)['Diffuse']['1k']['jpg']['url']
        fetch(url, os.path.join(SOURCES, 'textures', f'{texture}_diff_1k.jpg'))


def blender():
    if os.environ.get('BLENDER'):
        return os.environ['BLENDER']
    found = sorted(glob.glob(r'C:\Program Files\Blender Foundation\Blender *\blender.exe'))
    return found[-1] if found else 'blender'


def run(script, *args):
    print('blender', script)
    subprocess.run([blender(), '--background', '--factory-startup', '--python', os.path.join(HERE, script), '--',
                    *args], check=True)


def main():
    download()
    for folder in ('trees', 'textures'):
        os.makedirs(os.path.join(ASSETS, folder), exist_ok=True)
    os.makedirs(PREVIEWS, exist_ok=True)
    run('leafy_tree.py', os.path.join(SOURCES, 'tree_small_02', 'tree_small_02.gltf'), ASSETS, PREVIEWS)
    run('conifer.py', os.path.join(SOURCES, 'fir_tree_01', 'fir_tree_01.gltf'), ASSETS, PREVIEWS)
    run('surfaces.py', SOURCES, ASSETS)
    print('done: assets in', ASSETS, '- previews in', PREVIEWS)


if __name__ == '__main__':
    sys.exit(main())
