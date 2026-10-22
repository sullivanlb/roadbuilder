# The terrain can also be painted with a brush

Shapes (docs/adr/0015) cover what follows the track and broad hills, but shaping ground by hand, as in the landscape tools of game engines, was missed: hold the brush and matter piles up where the pointer goes. A brush painting relief is added beside the shapes. It reverses the part of docs/adr/0015 that left the brush out, for free-standing relief only: what follows the track stays an earthwork.

The relief is a grid of heights added to the terrain, one node every 4 m, stored by tiles of 16 × 16 nodes (64 m a side). A tile keeps its heights in centimetres as 16-bit integers in base64, so a tile weighs under 700 characters and only painted tiles are stored. Heights stay between −60 m and +120 m, and a project holds at most 600 tiles, a few square kilometres, within the size of a project file.

## Consequences

- The project keeps format version 2: `sculpt` defaults to an empty list of tiles.
- The relief stands where it was painted when the track is edited, like scenery and hills. It fades out near the track as hills do, so the shoulders keep their heights; flattening leaves the relief alone where it does not show.
- The brush raises, lowers (Shift swaps the two), smooths or flattens to the height under the pointer when the stroke starts. It paints as long as it is held, even still, the most at its centre, over a radius and at a strength set in the inspector, on the plan and in the 3D preview.
- A stroke is one step of the history. Rebuilding the scene takes a few hundred milliseconds, too slow for every frame: during a stroke the preview bends the terrain it shows by what the stroke painted, and the scene is rebuilt, with its fine mesh, when the stroke ends. In 3D the camera does not turn while the brush paints.
- Terrain cells under painted tiles are divided down to the 4 m grid, and the terrain grows to cover every painted tile.
