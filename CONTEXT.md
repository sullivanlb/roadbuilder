# Roadbuilder

An editor for drawing tracks and exporting them as playable content for Assetto Corsa. The interface is in French and English; this glossary uses the English terms, with the French interface word in parentheses where it differs.

## Language

### The project

**Project** (projet):
The document a user edits, saves and exports: one track with its road settings, barriers and terrain.
_Avoid_: save, file, circuit file

**Template** (modèle):
A ready-made project offered when starting a new one.
_Avoid_: preset, example

### The editor

**Layer** (couche):
One of the subjects the editor works on: track, roadway, edges, pits and start, terrain, scenery. The active layer decides what a click picks and which tools are offered; the others stay visible, dimmed, and can be hidden.
_Avoid_: mode, tab, panel

**Track band** (bande de piste):
The track unrolled along its track distance under the plan, with one row per subject of the active layer; ranges show as blocks and new ones are picked by dragging across it.
_Avoid_: timeline, profile (except for the elevation row)

**Corner** (virage):
A bend found from the curvature of the centerline, numbered in track direction. Corners are detected, not stored.
_Avoid_: turn (in French texts), curve

### The track

**Track** (tracé):
The drivable route described by the control points, in the order they are driven.
_Avoid_: path, route, layout

**Circuit** (circuit fermé):
A track whose last control point leads back to the first one.
_Avoid_: loop, closed track

**Road** (route ouverte):
A track that runs from its first control point to its last one without returning.
_Avoid_: open track, point-to-point, hillclimb

**Track direction** (sens du tracé):
The driving direction, which is the order of the control points. Left and right are always relative to it.

**Control point** (point):
A point placed by the user that the track passes through; it has a plan position and an altitude.
_Avoid_: node, vertex, waypoint

**Centerline** (axe):
The smooth curve interpolated through the control points; every surface is laid out from it.
_Avoid_: spline, curve

**Segment**:
The part of the centerline between two consecutive control points, including the closing one of a circuit.
_Avoid_: leg, section

**Range** (plage, or tronçon for a barrier):
A stretch of track between two track positions, following the track direction. It may cover several segments and, on a circuit, run through the start.
_Avoid_: span, region, section

**Track distance**:
Distance travelled along the centerline from the first control point.
_Avoid_: chainage, offset, s

**Track position** (repère de piste):
A precise place on the track: a control point plus a distance in metres along the track after it. It moves with its control point when the track is edited elsewhere.
_Avoid_: anchor, marker, chainage

### Road surfaces

**Roadway** (chaussée):
The paved driving surface. Its width is the base width, except inside width zones.
_Avoid_: asphalt, road surface

**Base width** (largeur de base):
The roadway width wherever no width zone applies.

**Width zone** (portion de largeur):
A stretch of track between two track positions where the roadway takes another width, on both edges alike. The width eases in and out over a fixed length at each end; where zones overlap, the later one wins.
_Avoid_: section, segment, width span

**Banking** (dévers):
The tilt of the roadway across the track, raising one edge while the other keeps the altitude of the track. It covers the roadway and the kerbs; beyond them the ground stays flat at the height of the kerb edge.
_Avoid_: camber, superelevation, cant

**Bank zone** (portion de dévers):
A stretch of track between two track positions where the roadway is banked by an angle, with one edge raised. The bank eases in and out over the zone's transition length at each end; where zones overlap, the later one wins.
_Avoid_: banked section, banking span

**Kerb** (vibreur):
The striped strip running along each edge of the roadway.
_Avoid_: curb, rumble strip

**Shoulder** (accotement):
The grass strip beyond the kerbs on each side.
_Avoid_: verge, run-off

**Terrain** (terrain):
The ground that fills the area around and inside the track, out to the terrain margin.
_Avoid_: ground plane, floor

**Terrain margin** (marge du terrain):
How far the terrain extends beyond the outermost part of the track.

### Barriers

**Barrier** (barrière):
A guardrail, tyre wall, TecPro line or concrete wall laid along a range on one side of the track.
_Avoid_: wall (except for the concrete type), fence

**Barrier offset** (écartement):
The gap between the outer edge of the kerb and the barrier.

**Collider**:
The invisible surface the game uses to stop cars at a barrier.
_Avoid_: hitbox, collision mesh

**Decor** (décor):
The visible geometry of a barrier, drawn in game but not used for collisions.
_Avoid_: scenery (reserved for future free-standing objects), visual

### Checks

**Track issue** (diagnostic):
A problem found in the track. An **error** blocks the export; a **warning** is only reported.
_Avoid_: validation error, problem

**Tight turn** (virage trop serré):
A part of the centerline that bends too sharply for the roadway width.
_Avoid_: hairpin, sharp corner

### Pits and start

**Pit lane** (voie des stands):
The lane beside a circuit, from its entry to its exit, where cars slow down to reach their pit box. A circuit has at most one; a road has none.
_Avoid_: pitlane, pit road, allée des stands

**Pit box** (emplacement de stand):
The spot along the pit lane where one car stops.
_Avoid_: garage, box, pit stall

**Starting grid** (grille de départ):
The staggered places behind the start line where cars line up for a race; on a road, a single start position.
_Avoid_: grid slots, start positions (except on a road)

**Car count** (nombre de voitures):
How many cars the track hosts; it sets the number of pit boxes and of grid places.
_Avoid_: capacity, pitboxes

### Output

**Scene** (scène):
Everything generated from a project to be seen or driven: surfaces, terrain, barriers and markers. The 3D preview and every export show the same scene.
_Avoid_: model, mesh

**Marker**:
A named position and orientation the game reads from the scene, such as the start position, the pit box or a timing gate.
_Avoid_: dummy, empty, node

**Assetto Corsa archive** (archive Assetto Corsa):
The export that installs as a playable track in the game.

**OBJ sources** (sources OBJ):
The export of the scene for further work in a 3D modelling tool.
