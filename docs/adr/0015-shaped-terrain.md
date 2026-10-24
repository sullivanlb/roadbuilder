# The terrain is shaped by earthworks along the track and free hills

The ground took its whole relief from the track (docs/adr/0011): flat beside the shoulders, then an average of the track heights. Users want to shape it: an embankment along a straight, a ditch beside a road, a flat run-off outside a corner, a hill inside a loop.

A brush painting a height map was the obvious tool. It was not chosen: a height grid fine enough for a ditch would weigh more than the rest of the project, and painted relief stays where it was painted when the track moves. The ground is shaped by editable shapes instead, laid the way the rest of the project is laid:

- **Earthworks** follow the track. An embankment, a ditch or a run-off is stored like a barrier, between two track positions on one side (docs/adr/0008), with an offset beyond the shoulders, a width and a height. It moves with its control points.
- **Hills** stand free on the plan, like scenery (docs/adr/0013): a centre, a heading, a width and depth (an oriented ellipse) and a height, negative for a hollow.

## Consequences

- The project keeps format version 2: `earthworks` and `hills` default to empty lists.
- Earthworks change the ground beside the track profile of their side: an embankment rises (or falls) by its height over its width and holds that level before easing into the far terrain; a ditch digs a hollow of its depth; a run-off stretches the flat strip beside the shoulders to its width. Earthworks on one side add up, so a ditch can run at the foot of an embankment. They ease in and out over 15 m at each end.
- The shoulders keep their exact heights whatever is laid: earthworks start beyond them, and hills fade out as they come within reach of the flat strip beside the track.
- A project without earthworks or hills builds exactly the same ground as before.
- The terrain grid (18 m or more) cannot show a 3 m ditch. Each earthwork is meshed as its own strip of grass, aligned with the track from the outer edge of the shoulders, and the terrain is cut around it like around the surfaces. Hills are broad: the terrain grid is only refined in the cells they cover. The terrain grows to cover every hill.
- An earthwork whose strip reaches another part of the track, across a hairpin or onto the pit lane, is reported by a warning.
- Gravel and other run-off surfaces remain a tool of the edges layer: a run-off only shapes the ground.
