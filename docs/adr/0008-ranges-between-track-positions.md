# Everything laid along the track is a range between two track positions

Barriers were spans between two control point IDs (docs/adr/0001), while width zones and the pit lane used track positions (docs/adr/0006). The editor is moving to a track band where stretches are picked and stretched to the metre; snapping barriers to control points there would force users to add points, and would keep two models for the same idea.

Barriers now store two track positions, like width zones. Control points keep their stable IDs: positions are anchored on them.

## Consequences

- Files saved with point IDs as barrier ends still open: such an end becomes the position on that point at distance 0, so the barrier keeps exactly the same geometry. The format stays at version 2.
- Deleting a control point no longer deletes the barriers ending on it: their ends are re-anchored, like every track position.
- Reversing the track and opening a circuit treat barriers and width zones with the same code.
- The core resolves any pair of positions to a `TrackRange` (start and length in metres) and walks the centerline along it with `rangeSamples`, which returns the samples on control points unchanged.
