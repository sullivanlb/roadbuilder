# Banking is set by zones of its own, flat beyond the kerbs

Corners need a tilted roadway, from a few degrees on a road circuit to the banked turns of an oval. Banking is laid like widths (docs/adr/0007): a bank zone stores two track positions, an angle and the raised edge. It is a list of its own rather than an extra value of width zones, since banking spans a whole corner while a width change usually sits elsewhere.

## Consequences

- Each sample carries its cross slope and the lateral distance of the kerb edge, worked out once when the track is sampled. `offsetPoint` lifts every point beside the centerline by the slope up to the kerb edge and keeps it flat beyond, so roadway, kerbs, shoulders, pit lane, barriers and markers follow without code of their own, and a project without zones builds exactly the same geometry.
- Beyond the kerbs the ground stays at the height of the kerb edge: shoulders do not climb metres up the outside of an oval, and the terrain, which takes its height from the surfaces, joins them as before.
- The roadway pivots about its low edge, which keeps the altitude of the track: only the raised side climbs. Pivoting about the centerline sank the low edge and its shoulder into the ground. Altitudes, grades and track positions still read the centerline as laid out, without the lift.
- The bank eases over the zone's transition at each end (60 m by default, 5 to 200 m), shortened to half the zone when it is shorter, with the same smoothstep as widths. Unlike the fixed width taper, it is set per zone: a raised edge needs a long climb on a fast corner and a short one between close bends. Files saved without it take the default.
- A new zone is raised on the outside of the way the centerline mostly bends along it; the user can swap the edge. Reversing the track swaps the raised edge, so the same ground stays up.
- Angles go up to 35°: surfaces still face up and never fold, since banking only changes heights.
