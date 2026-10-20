import type { Id } from '../../core/ids';
import type { Project } from '../../core/project/schema';
import type { MeshKind } from '../../core/scene/mesh';
import { barrierLateral, barrierSamples } from '../../core/scene/barriers';
import { offsetPoint } from '../../core/scene/mesh';
import { sampleAt } from '../../core/track/centerline';
import type { Sample } from '../../core/track/centerline';
import { kerbWidth } from '../../core/track/layout';
import { pitLaneLayout } from '../../core/track/pitLane';
import { positionRange, rangeSamples } from '../../core/track/ranges';
import type { TrackRange } from '../../core/track/ranges';
import type { LayerId } from '../layers';
import { COLORS } from '../theme';

/** The layer a mesh of the scene belongs to, or null for the roadway, shown on every layer. */
export function meshLayer(name: string, kind: MeshKind): LayerId | null {
  if (name.startsWith('1PIT') || name.startsWith('divider')) return 'pits';
  if (kind === 'terrain') return 'terrain';
  if (kind === 'barrier') return 'edges';
  return null;
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
    | null;
  range: TrackRange | null;
  /** The stretch being laid with a two-click tool. */
  draft: TrackRange | null;
  hoverS: number | null;
}

const LIFT = 0.12;

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

export function buildOverlay(
  project: Project,
  samples: readonly Sample[],
  state: OverlayState,
): PreviewOverlay {
  const overlay: PreviewOverlay = { strips: [], posts: [], cursor: null };
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
