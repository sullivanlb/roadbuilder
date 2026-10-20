# The roadway width varies by zones between track positions

Tracks need wider straights and narrower passages. A width zone stores two track positions (docs/adr/0006) and a width, rather than a width per control point: the zone sits exactly where the user clicked, without extra control points, and its transitions do not stretch over whole segments.

## Consequences

- The width is symmetric: the centerline stays in the middle of the roadway, so the grid, the timing gates and later the AI line keep their reference.
- Each sample of the centerline carries its half width, worked out once when the track is sampled. Everything built beside the road (kerbs, shoulders, pit lane, barriers, markers) reads it from the sample, so a project without zones builds exactly the same geometry as before.
- The width eases over a fixed 20 m at each end of a zone, shortened to half the zone when it is shorter.
- Laying a zone over another is refused, but moving positions can still make zones overlap: the later zone then wins and a warning is shown, without blocking the export.
- On a circuit, the two clicks give the shorter stretch between them; a longer zone is set from the sidebar positions.
