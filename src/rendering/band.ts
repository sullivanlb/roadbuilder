import { RULES } from '../core/project/rules';
import type { BankZone, BarrierType, EarthworkType, Project } from '../core/project/schema';
import { startLine } from '../core/scene/road';
import { controlPointSample, trackLength, trackStats } from '../core/track/centerline';
import type { Sample } from '../core/track/centerline';
import type { Corner } from '../core/track/corners';
import { pitLaneLayout } from '../core/track/pitLane';
import { positionRange } from '../core/track/ranges';
import type { TrackRange } from '../core/track/ranges';
import { bankZoneRanges } from '../core/track/bank';
import { earthworkRanges } from '../core/track/earthworks';
import { widthZoneRanges } from '../core/track/width';
import type { LayerId } from './layers';
import { BARRIER_STYLE, COLORS } from './theme';

/**
 * The track band: the track unrolled along its distance, with one row per subject
 * of the active layer. Everything laid along the track shows as a block that can
 * be selected and stretched.
 */

/** Margins of the band, in pixels: row labels on the left, distances at the bottom. */
export const BAND = { left: 84, right: 12, top: 18, bottom: 18, rowGap: 4, edge: 5 } as const;

export interface BandSize {
  width: number;
  height: number;
}

/** The track distances shown, from `start` to `end`. */
export interface BandView {
  start: number;
  end: number;
}

export type BandRowId =
  'altitude' | 'width' | 'zones' | 'bank' | 'bankZones' | 'left' | 'right' | 'lane' | 'start';

export interface BandRow {
  id: BandRowId;
  y: number;
  height: number;
}

export type BandBlockKind =
  'widthZone' | 'bankZone' | 'barrier' | 'earthwork' | 'pitLane' | 'startLine';

/** Something laid along the track, as drawn in the band. A start line is a block of no length. */
export interface BandBlock {
  kind: BandBlockKind;
  id: string;
  row: BandRowId;
  range: TrackRange;
  color: string;
  label: string;
}

/** Texts drawn in the band, given by the caller in the interface language. */
export interface BandLabels {
  rows: Record<BandRowId, string>;
  barrier: Record<BarrierType, string>;
  earthwork: Record<EarthworkType, string>;
  width: (width: number) => string;
  bank: (zone: Pick<BankZone, 'angle' | 'high'>) => string;
  lane: string;
  start: string;
  distance: (metres: number) => string;
  corner: (corner: Corner) => string;
}

const ROWS: Record<LayerId, [BandRowId, number][]> = {
  track: [['altitude', 1]],
  road: [
    ['width', 0.3],
    ['zones', 0.2],
    ['bank', 0.3],
    ['bankZones', 0.2],
  ],
  edges: [
    ['left', 1],
    ['right', 1],
  ],
  pits: [
    ['lane', 1],
    ['start', 1],
  ],
  terrain: [
    ['left', 1],
    ['right', 1],
  ],
  // Scenery stands free of the track: nothing to unroll along it.
  scenery: [],
};

/** Whether a layer shows the track band: the scenery layer does not. */
export const hasBand = (layer: LayerId) => ROWS[layer].length > 0;

/** The rows of a layer, stacked in the band. */
export function bandRows(layer: LayerId, size: BandSize): BandRow[] {
  const rows = ROWS[layer];
  const total = rows.reduce((sum, [, weight]) => sum + weight, 0);
  const room = size.height - BAND.top - BAND.bottom - BAND.rowGap * (rows.length - 1);
  let y = BAND.top;
  return rows.map(([id, weight]) => {
    const row = { id, y, height: (room * weight) / total };
    y += row.height + BAND.rowGap;
    return row;
  });
}

/** The blocks of a layer. */
export function bandBlocks(
  project: Project,
  samples: readonly Sample[],
  layer: LayerId,
  labels: BandLabels,
): BandBlock[] {
  if (samples.length < 2) return [];
  if (layer === 'road')
    return [
      ...widthZoneRanges(project, samples).map(({ zone, start, length }) => ({
        kind: 'widthZone' as const,
        id: zone.id,
        row: 'zones' as const,
        range: { start, length },
        color: COLORS.widthZone,
        label: labels.width(zone.width),
      })),
      ...bankZoneRanges(project, samples).map(({ zone, start, length }) => ({
        kind: 'bankZone' as const,
        id: zone.id,
        row: 'bankZones' as const,
        range: { start, length },
        color: COLORS.bankZone,
        label: labels.bank(zone),
      })),
    ];
  if (layer === 'edges')
    return project.barriers.flatMap((barrier) => {
      const range = positionRange(project, samples, barrier.from, barrier.to);
      return range
        ? [
            {
              kind: 'barrier' as const,
              id: barrier.id,
              row: barrier.side,
              range,
              color: BARRIER_STYLE[barrier.type].color,
              label: labels.barrier[barrier.type],
            },
          ]
        : [];
    });
  if (layer === 'terrain')
    return earthworkRanges(project, samples).map(({ earthwork, start, length }) => ({
      kind: 'earthwork' as const,
      id: earthwork.id,
      row: earthwork.side,
      range: { start, length },
      color: COLORS.earthwork[earthwork.type],
      label: labels.earthwork[earthwork.type],
    }));
  if (layer === 'pits') {
    const blocks: BandBlock[] = [
      {
        kind: 'startLine',
        id: 'startLine',
        row: 'start',
        range: { start: startLine(project, samples).s, length: 0 },
        color: COLORS.start.light,
        label: labels.start,
      },
    ];
    const lane = pitLaneLayout(project, samples);
    if (lane)
      blocks.push({
        kind: 'pitLane',
        id: 'pitLane',
        row: 'lane',
        range: { start: lane.entry, length: lane.length },
        color: COLORS.pits.lane,
        label: labels.lane,
      });
    return blocks;
  }
  return [];
}

export const bandX = (size: BandSize, view: BandView, s: number) =>
  BAND.left +
  ((s - view.start) / (view.end - view.start || 1)) * (size.width - BAND.left - BAND.right);

export const bandS = (size: BandSize, view: BandView, x: number) =>
  view.start +
  ((x - BAND.left) / (size.width - BAND.left - BAND.right || 1)) * (view.end - view.start);

/** A range as one or two spans of track distance, split where it runs through the start. */
export function rangeSpans(range: TrackRange, total: number): [number, number][] {
  const end = range.start + range.length;
  return end <= total
    ? [[range.start, end]]
    : [
        [range.start, total],
        [0, end - total],
      ];
}

export interface BandHit {
  row: BandRow | null;
  /** Track distance under the pointer, clamped to the track. */
  s: number;
  block: BandBlock | null;
  /** The end of the block being grabbed, when the pointer is on one. */
  edge: 'start' | 'end' | null;
}

/** What lies under the pointer in the band. */
export function bandHit(
  size: BandSize,
  view: BandView,
  total: number,
  rows: readonly BandRow[],
  blocks: readonly BandBlock[],
  x: number,
  y: number,
): BandHit {
  const row =
    rows.find((candidate) => y >= candidate.y && y <= candidate.y + candidate.height) ?? null;
  const s = Math.min(total, Math.max(0, bandS(size, view, x)));
  if (!row) return { row, s, block: null, edge: null };
  // Later blocks are drawn on top: they answer first.
  for (const block of [...blocks].reverse()) {
    if (block.row !== row.id) continue;
    const ends = [block.range.start, (block.range.start + block.range.length) % (total || 1)];
    const near = (end: number) => Math.abs(bandX(size, view, end) - x) <= BAND.edge;
    if (near(ends[0])) return { row, s, block, edge: 'start' };
    if (block.range.length > 0 && near(ends[1])) return { row, s, block, edge: 'end' };
    for (const [a, b] of rangeSpans(block.range, total))
      if (s >= a && s <= b && block.range.length > 0) return { row, s, block, edge: null };
  }
  return { row, s, block: null, edge: null };
}

/** The corner named in the strip along the top of the band under the pointer, if any. */
export function bandCornerAt(
  size: BandSize,
  view: BandView,
  total: number,
  corners: readonly Corner[],
  x: number,
  y: number,
): Corner | null {
  if (y >= BAND.top) return null;
  const s = bandS(size, view, x);
  return (
    corners.find((corner) => rangeSpans(corner, total).some(([a, b]) => s >= a && s <= b)) ?? null
  );
}

/** The control point closest to track distance `s`. */
export function nearestPoint(samples: readonly Sample[], pointCount: number, s: number): number {
  let best = 0,
    bestDistance = Infinity;
  for (let i = 0; i < pointCount; i++) {
    const sample = controlPointSample(samples, i) ?? samples.at(-1);
    if (!sample) break;
    const d = Math.abs(sample.s - s);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}

/** Everything the band shows, read from the stores by the band component. */
export interface BandScene {
  project: Project;
  samples: readonly Sample[];
  view: BandView;
  rows: readonly BandRow[];
  blocks: readonly BandBlock[];
  labels: BandLabels;
  corners: readonly Corner[];
  /** The selected block, if the selection is laid along the track. */
  selectedBlockId: string | null;
  selectedPointIds: readonly string[];
  range: TrackRange | null;
  /** The range being dragged out, before it is let go. */
  pendingRange: TrackRange | null;
  hoverS: number | null;
}

type Context = CanvasRenderingContext2D;

export function drawBand(ctx: Context, size: BandSize, dpr: number, scene: BandScene) {
  const { width: w, height: h } = size;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const total = trackLength(scene.samples);
  const x = (s: number) => bandX(size, scene.view, s);
  ctx.save();
  ctx.beginPath();
  ctx.rect(BAND.left, 0, w - BAND.left, h);
  ctx.clip();
  for (const row of scene.rows) {
    ctx.fillStyle = COLORS.band.row;
    ctx.fillRect(BAND.left, row.y, w, row.height);
  }
  drawCorners(ctx, size, scene, total);
  for (const row of scene.rows) drawRow(ctx, size, scene, row);
  for (const block of scene.blocks) {
    const row = scene.rows.find((candidate) => candidate.id === block.row);
    if (row) drawBlock(ctx, size, scene, row, block, total);
  }
  for (const range of [scene.range, scene.pendingRange])
    if (range && total)
      for (const [a, b] of rangeSpans(range, total)) {
        ctx.fillStyle = COLORS.band.range;
        ctx.fillRect(x(a), BAND.top, x(b) - x(a), h - BAND.top - BAND.bottom);
        ctx.fillStyle = COLORS.accent;
        ctx.fillRect(x(a), BAND.top, 1.5, h - BAND.top - BAND.bottom);
        ctx.fillRect(x(b) - 1.5, BAND.top, 1.5, h - BAND.top - BAND.bottom);
      }
  if (scene.hoverS !== null) {
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(x(scene.hoverS), BAND.top, 1, h - BAND.top - BAND.bottom);
  }
  drawTicks(ctx, size, scene);
  ctx.restore();
  ctx.font = '11px "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.band.label;
  for (const row of scene.rows) ctx.fillText(scene.labels.rows[row.id], 12, row.y + row.height / 2);
}

function drawRow(ctx: Context, size: BandSize, scene: BandScene, row: BandRow) {
  const { samples, view } = scene;
  const x = (s: number) => bandX(size, view, s);
  const visible = samples.filter(
    (sample) => sample.s >= view.start - 10 && sample.s <= view.end + 10,
  );
  if (row.id === 'altitude' && visible.length > 1) {
    const stats = trackStats(samples),
      range = Math.max(10, stats.elevation);
    const y = (altitude: number) =>
      row.y +
      row.height -
      4 -
      ((altitude - stats.min + range * 0.08) / (range * 1.2)) * (row.height - 8);
    ctx.beginPath();
    visible.forEach((sample, i) =>
      i ? ctx.lineTo(x(sample.s), y(sample.y)) : ctx.moveTo(x(sample.s), y(sample.y)),
    );
    ctx.strokeStyle = COLORS.profile.line;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineTo(x(visible.at(-1)!.s), row.y + row.height);
    ctx.lineTo(x(visible[0].s), row.y + row.height);
    ctx.closePath();
    ctx.fillStyle = COLORS.profile.fillTop;
    ctx.fill();
    scene.project.points.forEach((point, i) => {
      const sample = controlPointSample(samples, i);
      if (!sample) return;
      const selected = scene.selectedPointIds.includes(point.id);
      ctx.fillStyle = selected ? COLORS.accent : COLORS.point.outline;
      ctx.beginPath();
      ctx.arc(x(sample.s), y(sample.y), selected ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  if (row.id === 'width' && visible.length > 1) {
    const y = (width: number) => row.y + row.height - 3 - ((width - 2) / 24) * (row.height - 6);
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = COLORS.band.base;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(BAND.left, y(scene.project.road.width));
    ctx.lineTo(size.width, y(scene.project.road.width));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    visible.forEach((sample, i) =>
      i ? ctx.lineTo(x(sample.s), y(2 * sample.half)) : ctx.moveTo(x(sample.s), y(2 * sample.half)),
    );
    ctx.strokeStyle = COLORS.widthZone;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  if (row.id === 'bank' && visible.length > 1) {
    // Bank angle in degrees, right edge raised above the middle line, left below.
    const max = RULES.bankAngle.max;
    const y = (bank: number) =>
      row.y + row.height / 2 - ((Math.atan(bank) * 180) / Math.PI / max) * (row.height / 2 - 3);
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = COLORS.band.base;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(BAND.left, y(0));
    ctx.lineTo(size.width, y(0));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    visible.forEach((sample, i) =>
      i ? ctx.lineTo(x(sample.s), y(sample.bank)) : ctx.moveTo(x(sample.s), y(sample.bank)),
    );
    ctx.strokeStyle = COLORS.bankZone;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawBlock(
  ctx: Context,
  size: BandSize,
  scene: BandScene,
  row: BandRow,
  block: BandBlock,
  total: number,
) {
  const x = (s: number) => bandX(size, scene.view, s);
  const selected = block.id === scene.selectedBlockId;
  ctx.font = '11px "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  if (block.range.length === 0) {
    const at = x(block.range.start);
    ctx.fillStyle = selected ? COLORS.accent : block.color;
    ctx.fillRect(at - 1, row.y, 2, row.height);
    ctx.fillText(block.label, at + 6, row.y + row.height / 2);
    return;
  }
  for (const [a, b] of rangeSpans(block.range, total)) {
    const x0 = x(a),
      x1 = x(b);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = block.color;
    ctx.beginPath();
    ctx.roundRect(x0, row.y + 3, Math.max(2, x1 - x0), row.height - 6, 4);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (selected) {
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = COLORS.accent;
      ctx.fillRect(x0 - 1, row.y + 1, 4, row.height - 2);
      ctx.fillRect(x1 - 3, row.y + 1, 4, row.height - 2);
    }
    if (x1 - x0 > ctx.measureText(block.label).width + 12) {
      ctx.fillStyle = COLORS.band.blockText;
      ctx.fillText(block.label, x0 + 6, row.y + row.height / 2);
    }
  }
}

/** Corners shaded across the rows and named along the top, to find one's way. */
function drawCorners(ctx: Context, size: BandSize, scene: BandScene, total: number) {
  ctx.font = '10px "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  for (const corner of scene.corners)
    for (const [a, b] of rangeSpans(corner, total)) {
      const x0 = bandX(size, scene.view, a),
        x1 = bandX(size, scene.view, b);
      ctx.fillStyle = COLORS.band.corner;
      ctx.fillRect(x0, 0, x1 - x0, size.height - BAND.bottom);
      const label = scene.labels.corner(corner);
      ctx.fillStyle = COLORS.band.label;
      if (x1 - x0 > ctx.measureText(label).width + 6) ctx.fillText(label, x0 + 3, BAND.top / 2);
    }
}

/** Distances along the bottom, at a step that suits the zoom. */
function drawTicks(ctx: Context, size: BandSize, scene: BandScene) {
  const { start, end } = scene.view,
    span = end - start;
  const step = span > 4000 ? 1000 : span > 1500 ? 500 : span > 600 ? 200 : span > 250 ? 50 : 20;
  ctx.font = '10px Consolas, monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.band.tick;
  for (let s = Math.ceil(start / step) * step; s <= end; s += step) {
    const at = bandX(size, scene.view, s);
    ctx.fillRect(at, size.height - BAND.bottom + 2, 1, 4);
    ctx.fillText(scene.labels.distance(s), at + 3, size.height - 4);
  }
}
