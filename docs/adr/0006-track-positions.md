# Places along the track are a control point plus a distance

Pit lane entries and exits, the start line and, later, timing sectors must sit anywhere along the track, not only on control points. A track position is stored as a control point ID plus a distance in metres along the centerline after it. It survives edits elsewhere on the track, unlike a distance from the start, and does not force users to add control points just to place something, unlike point-only anchors.

## Consequences

- The distance may run past the next control point; on a road it stops at the end of the track.
- Deleting the anchor point re-anchors the position on the previous point, adding the length of the removed segment.
- Reversing the track keeps every position in the same physical place: it is converted to a track distance and anchored again in the new direction.
