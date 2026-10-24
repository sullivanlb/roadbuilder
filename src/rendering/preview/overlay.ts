import type { Id } from '../../core/ids';
import type { PlanPoint } from '../../core/math';
import type { Project, SceneryItem } from '../../core/project/schema';
import type { MeshKind } from '../../core/scene/mesh';
import { barrierLateral, barrierSamples } from '../../core/scene/barriers';
import { offsetPoint } from '../../core/scene/mesh';
import { sceneryFootprint } from '../../core/project/scenery';
import { hillOutline } from '../../core/project/terrain';
import { groundHeight } from '../../core/scene/ground';
import { sampleAt } from '../../core/track/centerline';
import type { Sample } from '../../core/track/centerline';
import { kerbWidth } from '../../core/track/layout';
import { earthworkOutline, earthworkRanges } from '../../core/track/earthworks';
import { pitLaneLayout } from '../../core/track/pitLane';
import { positionRange, rangeSamples } from '../../core/track/ranges';
import type { TrackRange } from '../../core/track/ranges';
import type { LayerId } from '../layers';
import { COLORS } from '../theme';

/** The layer a mesh of the scene belongs to, or null for the roadway, shown on every layer. */
export function meshLayer(name: string, kind: MeshKind): LayerId | null {
  if (name.startsWith('1PIT') || name.startsWith('divider')) return 'pits';
  if (kind === 'scenery') return 'scenery';
  if (kind === 'terrain') return 'terrain';
  if (kind === 'barrier') return 'edges';
  return null;
}

/** The edges of a box around a scenery item standing at height `y`, as line segments. */
function sceneryBox(item: SceneryItem, y: number): number[] {
  const ring =
    item.kind === 'tree'
      ? Array.from({ length: 12 }, (_, k) => ({
          x: item.x + (Math.cos((k * Math.PI) / 6) * item.width) / 2,
          z: item.z + (Math.sin((k * Math.PI) / 6) * item.width) / 2,
        }))
      : sceneryFootprint(item);
  const lines: number[] = [];
  const top = y + item.height;
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length];
    lines.push(p.x, y, p.z, q.x, y, q.z, p.x, top, p.z, q.x, top, q.z);
    if (item.kind !== 'tree' || i % 3 === 0) lines.push(p.x, y, p.z, p.x, top, p.z);
  });
  return lines;
}

/** A flat strip laid just above the ground, as triangles. */
export interface OverlayStrip {
  positions: number[];
  color: string;
  opacity: number;
}

/** A post standing on a control point, on the track layer. */
export interface OverlayPost {
  id: Id;
  x: number;
  y: number;
  z: number;
  selected: boolean;
}

/** Everything drawn over the scene to show what is being edited. */
export interface PreviewOverlay {
  strips: OverlayStrip[];
  /**
   * Line segments drawn over everything, two points each: the boxes around
   * selected scenery, the outline of a selected earthwork or hill.
   */
  outlines: number[];
  posts: OverlayPost[];
  /** Where the pointer is along the track: a bar across the road, tilted with its bank. */
  cursor: {
    x: number;
    y: number;
    z: number;
    nx: number;
    nz: number;
    bank: number;
    reach: number;
  } | null;
}

/** What the overlay shows, read from the editor. */
export interface OverlayState {
  layer: LayerId;
  selection:
    | { kind: 'points'; ids: readonly Id[] }
    | { kind: 'barrier'; id: Id }
    | { kind: 'widthZone'; id: Id }
    | { kind: 'bankZone'; id: Id }
    | { kind: 'pitLane' }
    | { kind: 'scenery'; ids: readonly Id[] }
    | { kind: 'earthwork'; id: Id }
    | { kind: 'hill'; id: Id }
    | null;
  range: TrackRange | null;
  /** The stretch being laid with a two-click tool. */
  draft: TrackRange | null;
  /** Height of each scenery item's floor in the scene, by ID. */
  sceneryFloors: Readonly<Record<Id, number>>;
  hoverS: number | null;
  /** The brush on the ground under the pointer, while the brush tool is on. */
  brush?: { x: number; y: number; z: number; radius: number } | null;
}

const LIFT = 0.12;
/** Height of the outlines of terrain shapes above the ground, clear of its coarse mesh. */
const OUTLINE_LIFT = 0.4;

/** A closed ring of places on the ground, as line segments just above it. */
function groundRing(ring: readonly PlanPoint[], height: (p: PlanPoint) => number): number[] {
  const lines: number[] = [];
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length];
    lines.push(p.x, height(p) + OUTLINE_LIFT, p.z, q.x, height(q) + OUTLINE_LIFT, q.z);
  });
  return lines;
}

/** A strip between two signed lateral offsets along samples. */
function strip(
  along: readonly Sample[],
  left: (sample: Sample) => number,
  right: (sample: Sample) => number,
  color: string,
  opacity: number,
): OverlayStrip {
  const positions: number[] = [];
  const at = (sample: Sample, lateral: number) => offsetPoint(sample, lateral, LIFT);
  for (let i = 1; i < along.length; i++) {
    const a = along[i - 1],
      b = along[i];
    const a0 = at(a, left(a)),
      a1 = at(a, right(a)),
      b0 = at(b, left(b)),
      b1 = at(b, right(b));
    positions.push(...a0, ...a1, ...b1, ...a0, ...b1, ...b0);
  }
  return { positions, color, opacity };
}

/** The outline on the plan of the selected earthwork or hill, or nothing when it is gone. */
function terrainOutline(
  project: Project,
  samples: readonly Sample[],
  selection: { kind: 'earthwork' | 'hill'; id: Id },
): PlanPoint[] {
  if (selection.kind === 'hill') {
    const hill = project.hills.find((candidate) => candidate.id === selection.id);
    return hill ? hillOutline(hill) : [];
  }
  const found = earthworkRanges(project, samples).find(
    (range) => range.earthwork.id === selection.id,
  );
  return found ? earthworkOutline(project, samples, found.earthwork, found) : [];
}

export function buildOverlay(
  project: Project,
  samples: readonly Sample[],
  state: OverlayState,
): PreviewOverlay {
  const overlay: PreviewOverlay = { strips: [], posts: [], outlines: [], cursor: null };
  if (samples.length < 2) return overlay;
  const kerb = kerbWidth(project.road);
  const across = (along: readonly Sample[], color: string, opacity: number, extra = 1) =>
    overlay.strips.push(
      strip(
        along,
        (sample) => -(sample.half + kerb + extra),
        (sample) => sample.half + kerb + extra,
        color,
        opacity,
      ),
    );
  const selection = state.selection;
  if (selection?.kind === 'widthZone' || selection?.kind === 'bankZone') {
    const zones = selection.kind === 'widthZone' ? project.widthZones : project.bankZones;
    const zone = zones.find((candidate) => candidate.id === selection.id);
    const range = zone && positionRange(project, samples, zone.from, zone.to);
    if (range) across(rangeSamples(samples, range), COLORS.accent, 0.35, 0);
  }
  if (selection?.kind === 'barrier') {
    const barrier = project.barriers.find((candidate) => candidate.id === selection.id);
    if (barrier) {
      const lane = pitLaneLayout(project, samples);
      const lateral = (sample: Sample) =>
        barrierLateral(project, lane, sample, barrier.side, barrier.offset);
      overlay.strips.push(
        strip(
          barrierSamples(project, samples, barrier),
          (sample) => lateral(sample) - 0.9,
          (sample) => lateral(sample) + 0.9,
          COLORS.accent,
          0.6,
        ),
      );
    }
  }
  if (selection?.kind === 'pitLane') {
    const lane = pitLaneLayout(project, samples);
    if (lane) {
      const along = rangeSamples(samples, { start: lane.entry, length: lane.length });
      const edge = (sample: Sample) => lane.profile(sample.s)?.edge ?? sample.half + kerb;
      const outer = (sample: Sample) => lane.profile(sample.s)?.outer ?? edge(sample);
      overlay.strips.push(
        strip(
          along,
          (sample) => lane.sign * (lane.sign > 0 ? edge(sample) : outer(sample)),
          (sample) => lane.sign * (lane.sign > 0 ? outer(sample) : edge(sample)),
          COLORS.accent,
          0.35,
        ),
      );
    }
  }
  if (selection?.kind === 'earthwork' || selection?.kind === 'hill') {
    const height = groundHeight(project, samples);
    overlay.outlines.push(...groundRing(terrainOutline(project, samples, selection), height));
  }
  if (selection?.kind === 'scenery')
    for (const item of project.scenery)
      if (selection.ids.includes(item.id))
        overlay.outlines.push(...sceneryBox(item, state.sceneryFloors[item.id] ?? 0));
  if (state.brush) {
    // A ring level with the place under the pointer, drawn over the ground.
    const { x, y, z, radius } = state.brush;
    for (const reach of [radius, radius / 2])
      for (let k = 0; k < 48; k++) {
        const a = (k * Math.PI) / 24,
          b = ((k + 1) * Math.PI) / 24;
        overlay.outlines.push(
          x + Math.cos(a) * reach,
          y + OUTLINE_LIFT,
          z + Math.sin(a) * reach,
          x + Math.cos(b) * reach,
          y + OUTLINE_LIFT,
          z + Math.sin(b) * reach,
        );
      }
  }
  if (state.range) across(rangeSamples(samples, state.range), COLORS.accent, 0.3);
  if (state.draft) across(rangeSamples(samples, state.draft), COLORS.accent, 0.45);
  if (state.layer === 'track') {
    const selected = selection?.kind === 'points' ? selection.ids : [];
    overlay.posts = project.points.map((point) => ({
      id: point.id,
      x: point.x,
      y: point.y,
      z: point.z,
      selected: selected.includes(point.id),
    }));
  }
  if (state.hoverS !== null) {
    const sample = sampleAt(samples, state.hoverS)!;
    overlay.cursor = { ...sample, y: offsetPoint(sample, 0)[1], reach: sample.half + kerb + 4 };
  }
  return overlay;
}
