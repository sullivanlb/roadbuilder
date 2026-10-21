# Scenery items stand free on the plan

Everything laid so far follows the track: barriers, zones and the pit lane sit between track positions and move with their control points. Scenery could have done the same, a track position plus a side and a distance from the edge. It is placed freely instead, by its plan position and heading, because what stands around a track is laid out by the ground, not by the road: a building behind a corner, a grove filling the inside of a loop, a grandstand facing two passes of a hairpin. Tied to one point of the track, such objects would drift when an unrelated point moved.

## Consequences

- An item stores `x`, `z`, its `heading`, its size and a `solid` switch, in a `scenery` list that defaults to empty: the format stays at version 2.
- Editing the track leaves scenery in place. An item whose footprint reaches the roadway, the kerbs, the shoulders or the pit lane is reported by a warning, not moved and not refused.
- Items stand on the terrain as it is meshed, not on the smooth ground height: their base sits at the lowest point of the terrain under their footprint and their foundations go a little below it, so nothing floats on the coarse terrain grid.
- A grove scatters its trees from the item's ID, so a project always produces the same trees.
- A solid item gets an invisible `1WALL_scenery` collider of vertical faces around its footprint, like the barrier colliders. Buildings and grandstands are solid by default; trees, signs and lights are not, and each item can be switched.
- Lights glow through an emissive material, and the Assetto Corsa archive gets an `extension/ext_config.ini` declaring one Custom Shaders Patch light per lamp. The game without the patch ignores the file and shows the lamps by day only.
- Scenery is generated as low-poly geometry grouped by material, so a few hundred items stay a few meshes in the KN5.
