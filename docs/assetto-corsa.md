# Assetto Corsa: what the game expects

Facts about how Assetto Corsa reads an exported track that cannot be guessed from the code. Each one says how we know it:

- **Confirmed in game**: observed in Assetto Corsa with a Roadbuilder export.
- **Documented**: stated by a public source, linked.
- **Assumed**: what the exporter does without proof that it matters; to be confirmed or removed.

Add to this file every time a test in game teaches something, and update the status of what it confirms or contradicts.

## Physical meshes and surfaces

**A mesh is physical when its name starts with a digit followed by a surface key** (`1ROAD_main`, `1GRASS_terrain_0`, `1WALL_divider`). Any other name is decor only: drawn, never touched. _Documented_ ([assettocorsamods.net](https://assettocorsamods.net/threads/assetto-mods-and-track-creation.3349), [GTPlanet](https://www.gtplanet.net/forum/threads/assetto-corsa-pc-mods-general-discussion.307899/post-13154865)).

**A physical mesh name must contain no other surface key, in any case.** `1WALL_pitwall` contains `PIT`, a key of our `surfaces.ini`: cars drove through it both ways, as if it were pit lane floor. Renamed `1WALL_divider`, it blocks. The game seems to look for keys anywhere in the name, ignoring case. _Confirmed in game._ Enforced by the test « name every physical mesh after one surface key only » in `tests/core/scene.test.ts`. Keys to avoid in names today: `ROAD`, `GRASS`, `KERB`, `PIT`, `WALL`.

**`WALL` works without an entry in `surfaces.ini`.** Our `surfaces.ini` only declares `ROAD`, `GRASS`, `KERB` and `PIT`, and `1WALL_*` meshes still stop cars. _Confirmed in game._

**`IS_PITLANE=1` on the `PIT` surface marks the pit lane** (`1PIT_lane`, or `1PIT_spawn` without a lane). _Assumed_ to drive the pit limiter and the pit state; not checked in game yet.

## Colliders

**An invisible collider works**: a `1WALL_*` mesh written with `IsRenderable = 0` in the KN5 keeps its collisions and is not drawn, like the walls of the official tracks. _Confirmed in game_ (guardrail, tyre, TecPro, concrete and pit wall colliders).

**A single vertical ribbon facing the track stops cars.** This is the collider of guardrails, tyres and TecPro blocks. _Confirmed in game._

**Solid walls (concrete barrier, pit wall) use two vertical faces about a metre apart and no top.** Both block cars. _Confirmed in game._ Why this shape is needed is _assumed_: a thin closed slab with a top at body height was suspected of letting cars through, but the pit wall's real problem turned out to be its name. Forum reports describe double-sided barriers making cars stick to walls ([assettocorsamods.net](https://assettocorsamods.net/threads/assetto-mods-and-track-creation.3349)), so faces close together are best avoided.

## KN5 model

**Vertex indices are 16 bits**: a mesh holds at most 65,535 vertices. Larger meshes are split into `name_0`, `name_1`… at 60,000 vertices. _Documented_ (KN5 layout, see below).

**Field layout of KN5 v5** follows the AcTools writer: [Kn5Writer.cs](https://github.com/gro-ove/actools/blob/master/AcTools/Kn5File/Kn5Writer.cs). Our encoder is an independent implementation. _Documented._

**Axes**: Y up, the car's forward is local -Z. Track geometry is written in metres without conversion. _Confirmed in game_ (tracks load upright and to scale).

## Markers

Empty nodes read by the game, each a 4×4 transform with local Y up and local -Z forward:

| Name                          | Role                                   | Status            |
| ----------------------------- | -------------------------------------- | ----------------- |
| `AC_START_0` … `AC_START_n`   | Starting grid, one per car, pole first | Confirmed in game |
| `AC_PIT_0` … `AC_PIT_n`       | Pit boxes, one per car                 | Confirmed in game |
| `AC_HOTLAP_START_0`           | Hotlap start, behind the start line    | Assumed           |
| `AC_TIME_n_L` / `AC_TIME_n_R` | Timing gate `n`, left and right posts  | Assumed           |

**The number of cars must match** `pitboxes` in `ui/ui_track.json`, the `AC_PIT_*` count and the `AC_START_*` count. _Assumed_ from the format; Content Manager reads `pitboxes` to cap the grid.

## Track data files

**`ui_track.json` `run`** is `clockwise` or `counter-clockwise` for circuits. The direction is computed from the sign of the plan area of the centerline; whether the result matches what the game shows is _assumed_, to be checked against a known circuit.

**`map.png` and `data/map.ini`** draw the track map; `SCALE_FACTOR`, `X_OFFSET` and `Z_OFFSET` place the car on it. _Assumed_ correct; not checked in game.

## Still unknown

- Whether the pit limiter engages along `1PIT_lane` and releases at its exit.
- Whether timing works on open roads (point-to-point sessions).
- How the game reads `ai/fast_lane.ai` and `ai/pit_lane.ai` (needed for AI lines).
