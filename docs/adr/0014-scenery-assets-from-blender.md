# Scenery is detailed from Blender assets and generated to size in code

The first scenery was low-poly geometry in flat colours, built in code: boxes, prisms and cones. In game it looked crude. Realistic scenery needs real textures and, for trees, shapes nobody would write by hand; but most items are sized by the user (a building's width, depth and height, a grandstand's length, a light's height and arm), so a fixed model per item would stretch.

The work is split by what can be known in advance:

- **Blender prepares what is fixed**: the two trees and every texture. `tools/blender/build.py` downloads CC0 sources from Poly Haven, runs Blender scripts that turn a reference tree of millions of triangles into a game tree of a few thousand (simplified wood, alpha-tested cards showing sprays of the reference's own leaves), and writes tiling surfaces (brick, stone, roofing, cladding), a glazing gradient and advertising boards for fictional brands. The output is committed under `src/assets/scenery`, so building the app never needs Blender.
- **Code builds what is sized**: buildings repeat a modelled bay along each wall and stack storeys, grandstands step their rows up their depth, lights stretch their post and arm, signs their frame. Surfaces that tile take their texture coordinates from the position on the item, so bays line up whatever the size.

## Consequences

- `npm run assets:scenery` rebuilds the assets; it needs Python 3 and Blender. Sources stay in `.cache`, out of the repository. Credits are in `src/assets/scenery/CREDITS.md`.
- A material either takes a generated texture (a colour and a grain, as before) or an image from the assets. Exports and the preview receive the images, loaded once; the scene itself stays pure and testable.
- Foliage is alpha-tested: `ksPerPixelAT` in the KN5, an alpha test in the preview. Texture coordinates follow Blender and the preview (origin at the bottom); the KN5 writer flips them for the game.
- Scenery meshes are triangle lists, split for 16-bit indices by triangles rather than by quads.
- A tree is scaled uniformly to its height; a grove scales each tree.
- The roadway asphalt takes an image too, made from a CC0 track asphalt at twice the resolution of the scenery, since the driver sees it from up close; it repeats every 2 m. Every export therefore loads the images, scenery or not.
