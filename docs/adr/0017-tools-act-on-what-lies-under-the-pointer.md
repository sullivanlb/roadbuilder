# Tools act on what lies under the pointer, in every view

Docs/adr/0009 resolves a click into a `TrackHit` before the active layer picks from it, the same way on the plan and in the 3D preview. Only selection followed it: the tools took screen pixels and looked up the road themselves, so the preview had a second copy of every tool and a third for the brush, and the two copies drifted apart. A pit lane being laid showed the shorter way round the circuit in 3D, the way a barrier goes, while the plan showed it forward from its entry.

Tools now act on the pointer resolved into a `TrackHit`, in whatever view it is. Each view only resolves it, with its own reach: pixels on the plan, metres on the ground in the preview, and only the parts a tool reads are worked out. What a tool does with it is the same everywhere.

## Consequences

- One tool lays every kind of range (docs/adr/0008), from one state of what is being laid and one rule for how far it runs between two clicks; the plan, the band and the preview draw that stretch as it is given to them.
- In the preview a press is made when the button is released without moving, so a press that moves still turns the camera. A tool that holds, like the brush (docs/adr/0016), acts as soon as the button goes down, and the camera stays still while it does.
- Some tools need the plan: straights and arcs are drawn there, the hand moves it and the selection rectangle is dragged over it. In the preview they say so, or do what the ground allows: the point tool inserts a point where the road is clicked.
- What the editing shows, the selection, what is being laid, the stretch picked in the band, the pointer and the brush, is resolved once by the editor and drawn by the three views from the same value.
