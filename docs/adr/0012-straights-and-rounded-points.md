# Straights and rounded points are stored on the control points

A track drawn only from Catmull–Rom curves has no true straight and no bend of a known radius: stacking points only approaches them, and spends points out of the 160 a track may have. Precise drawing could have placed many points along a line or an arc, but the shape would then be lost and the radius could not be changed afterwards. The shape is stored instead, on the control points, the way roads are designed: corners and radii.

- `straight: true` on a point makes the segment leaving it a straight line.
- `radius` makes a point a rounded point: the track runs along the straight side from the previous point, turns on an arc of that radius tangent to both sides, and leaves along the side to the next point. It does not go through the point itself.

## Consequences

- Both fields are optional and the format stays at version 2. A project without them lays out exactly the same centerline: curved segments not touching a straight keep the plain Catmull–Rom curve. A curve meeting a straight becomes a cubic leaving or joining it along its direction, so the track has no kink there.
- A rounded point sits on the track at the middle of its arc: its sample keeps `t = 0` in its segment, and track positions anchored on it need no special case.
- Every segment touching a rounded point is straight. When the sides are too short for the tangents, two arcs share the side in proportion to what they ask for, and the radius is reduced: a warning says so rather than blocking the export. The first and last points of a road have a single side and are never rounded.
- Two straights meeting on a plain point make a sharp corner, reported as a warning on that point.
- The arc tool draws arcs as rounded points, a quarter turn at most each, whose sides are exactly the length of their tangents, so the arc starts on the point it is drawn from and they follow on from one another. The radius stays editable on each of them.
- A straight is marked on the point it leaves from. Inserting a point on a straight splits it into two straights; deleting a point keeps the merged segment straight only if both were; reversing the track moves each mark to the other end of its segment.
