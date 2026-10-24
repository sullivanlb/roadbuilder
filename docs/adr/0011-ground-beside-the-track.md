# The ground carries the shoulders on flat before joining the far terrain

The terrain took its height, outside the surfaces, from an average of the track altitudes weighted by distance. Close to a climbing road this average still mixed in parts of the track at other heights, and the terrain grid is coarse (18 m or more), so the first terrain vertex beyond a shoulder often sat a metre below or above it: a narrow ditch or bank along the road.

The ground beside the track now has two parts (`src/core/scene/ground.ts`):

- **Near the track**, every centerline segment within reach pulls the ground to the height of the outer edge of its shoulders, extended flat sideways (bank included). The pull grows as the distance beyond the shoulders shrinks and fades out to nothing at the edge of the reach, so the height is exact along the shoulders and continuous everywhere, including between two passes of a hairpin.
- **Far from it**, the distance-weighted average of the track altitudes, as before.

The near height is kept for 8 m beyond the shoulders, then eases into the far one over 40 m (`LAYOUT.terrain`).

## Consequences

- Climbs and descents get a flat strip of grass beside the shoulders and a gentle slope beyond, instead of a ditch.
- The surfaces keep their exact heights: the terrain still takes them wherever it meets them.
- The terrain grid is unchanged; between the shoulder and the next grid vertex, the ground is a straight slope.
