# The editor works on one layer at a time

Each new tool brought its own selection rule: a click picked a point, a barrier or a width zone depending on what lay closest, and the same spot often held all three. Large tracks made it worse. The editor now has layers (track, road, edges, pits and start, terrain, decor). The active layer decides what a click picks and which tools are offered; the other layers stay visible, dimmed, and can be hidden.

## Consequences

- There is a single selection, of one kind at a time. Selecting something, or picking a tool, moves to its layer. Each layer keeps its own selection while another one is edited, so going back to a layer finds it as it was left.
- A click is first resolved into what lies under it (a `TrackHit`: the road position, the point, the barrier), the same way in every view; the active layer then picks from it. The 3D preview uses the same rule.
- New features join a layer instead of adding their own selection rule. Features not built yet are shown dashed in their layer, so the place of each future tool is visible.
