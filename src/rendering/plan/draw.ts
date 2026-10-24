import type { Id } from '../../core/ids';
import type { PlanPoint, Vec3 } from '../../core/math';
import { DEFAULTS } from '../../core/project/rules';
import type { Earthwork, Hill, Project, SceneryItem } from '../../core/project/schema';
import { EARTHWORK_DEFAULTS, hillOutline } from '../../core/project/terrain';
import { SCULPT } from '../../core/project/sculpt';
import type { SculptField } from '../../core/project/sculpt';
import { barrierLine, barrierPath } from '../../core/scene/barriers';
import { gridPlaces, pitBoxPlaces } from '../../core/scene/markers';
import type { Place } from '../../core/scene/markers';
import { startLine } from '../../core/scene/road';
import { headingVector, sceneryFootprint } from '../../core/project/scenery';
import { groveTrees } from '../../core/scene/scenery/grove';
import { sampleAt, trackLength } from '../../core/track/centerline';
import type { Sample } from '../../core/track/centerline';
import { arcLayout, corners } from '../../core/track/geometry';
import type { ArcShape } from '../../core/track/geometry';
import type { TightTurn } from '../../core/track/issues';
import { kerbWidth, LAYOUT, roadEdge, terrainBounds } from '../../core/track/layout';
import {
  earthworkOutline,
  earthworkRanges,
  pointBesideShoulders,
} from '../../core/track/earthworks';
import type { EarthworkRange } from '../../core/track/earthworks';
import { pitLaneLayout } from '../../core/track/pitLane';
import type { PitLaneLayout } from '../../core/track/pitLane';
import { rangeSamples } from '../../core/track/ranges';
import { bankZoneRanges } from '../../core/track/bank';
import { widthZoneRanges } from '../../core/track/width';
import type { LaidKind, TrackRange } from '../../core/track/ranges';
import { arcDegrees } from '../../core/track/drawing';
import type { DrawDraft } from '../../core/track/drawing';
import { selectedIds } from '../editing';
import type { Editing, SelectionKind } from '../editing';
import { INACTIVE_LAYER_ALPHA } from '../layers';
import type { LayerId } from '../layers';
import { BARRIER_STYLE, COLORS } from '../theme';
import type { PlanProjection, ScreenPoint } from './projection';

/** Everything the plan shows, read from the stores by the plan canvas. */
export interface PlanScene {
  project: Project;
  samples: readonly Sample[];
  /** The editing under way, as every view shows it. */
  editing: Editing;
  tightTurns: readonly TightTurn[];
  /** Rectangle being dragged to select points, in screen pixels. */
  marquee: { x0: number; y0: number; x1: number; y1: number } | null;
  hoveredPointId: Id | null;
  /** The straight or the arc the next click would draw. */
  drawDraft: DrawDraft | null;
  hoveredSceneryId: Id | null;
  /** The item the active scenery tool would place under the pointer. */
  sceneryGhost: SceneryItem | null;
  /** The hill the hill tool would raise under the pointer. */
  hillGhost: Hill | null;
  /** The painted relief, as the stroke under way leaves it. */
  sculpt: SculptField;
  labels: {
    start: string;
    finish: string;
    distance: (metres: number) => string;
    /** Label of a straight being drawn: its length and its turn from the track. */
    straight: (length: number, turn: number) => string;
    /** Label of an arc being drawn: its radius and its turn, in degrees. */
    arc: (radius: number, degrees: number) => string;
    radius: (radius: number) => string;
  };
}

type Context = CanvasRenderingContext2D;

/** Whether the selection holds an item of a kind. */
const isSelected = (scene: PlanScene, kind: SelectionKind, id: Id) =>
  selectedIds(scene.editing.selection, kind).includes(id);

/** What is being laid, when it is of a kind. */
const layingOf = (scene: PlanScene, kind: LaidKind) => {
  const laying = scene.editing.laying;
  return laying?.kind === kind ? laying : null;
};

function trace(ctx: Context, view: PlanProjection, points: readonly PlanPoint[]) {
  ctx.beginPath();
  points.forEach((point, i) => {
    const p = view.toScreen(point);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
}

function dashed(ctx: Context, dash: number[], draw: () => void) {
  ctx.setLineDash(dash);
  draw();
  ctx.setLineDash([]);
}

/** Background gradient and a faint grid anchored in world space. */
function drawBackground(ctx: Context, view: PlanProjection) {
  const { width, height } = view.size;
  const gradient = ctx.createRadialGradient(
    width * 0.55,
    height * 0.3,
    10,
    width * 0.5,
    height * 0.5,
    width * 0.8,
  );
  gradient.addColorStop(0, COLORS.background.center);
  gradient.addColorStop(1, COLORS.background.edge);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  const scale = view.camera.scale;
  const step = scale < 0.3 ? 100 : scale < 1.5 ? 50 : 10;
  const topLeft = view.toWorld({ x: 0, y: 0 }),
    bottomRight = view.toWorld({ x: width, y: height });
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = COLORS.grid.line;
  ctx.beginPath();
  for (let x = Math.floor(topLeft.x / step) * step; x <= bottomRight.x; x += step) {
    const sx = view.toScreen({ x, z: 0 }).x;
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, height);
  }
  for (let z = Math.floor(topLeft.z / step) * step; z <= bottomRight.z; z += step) {
    const sy = view.toScreen({ x: 0, z }).y;
    ctx.moveTo(0, sy);
    ctx.lineTo(width, sy);
  }
  ctx.stroke();
  ctx.fillStyle = COLORS.grid.dot;
  const dot = step * 2;
  for (let x = Math.floor(topLeft.x / dot) * dot; x <= bottomRight.x; x += dot)
    for (let z = Math.floor(topLeft.z / dot) * dot; z <= bottomRight.z; z += dot) {
      const p = view.toScreen({ x, z });
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
}

/**
 * Strokes the centerline with a width in pixels that follows the roadway width,
 * one path per run of samples where that width does not change. Dashes carry on
 * from one run to the next.
 */
function strokeAlong(
  ctx: Context,
  view: PlanProjection,
  samples: readonly Sample[],
  color: string,
  width: (half: number) => number,
  dash: number[] = [],
) {
  ctx.strokeStyle = color;
  ctx.setLineDash(dash);
  let run = NaN;
  const flush = () => {
    if (Number.isNaN(run)) return;
    ctx.lineWidth = width(run);
    ctx.stroke();
  };
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1],
      b = samples[i];
    const half = (a.half + b.half) / 2;
    if (half !== run) {
      flush();
      run = half;
      ctx.beginPath();
      if (dash.length) ctx.lineDashOffset = a.s * view.camera.scale;
      const p = view.toScreen(a);
      ctx.moveTo(p.x, p.y);
    }
    const q = view.toScreen(b);
    ctx.lineTo(q.x, q.y);
  }
  flush();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
}

/** Terrain outline, then the road drawn as stacked strokes from the widest to the narrowest. */
function drawTrack(ctx: Context, view: PlanProjection, scene: PlanScene) {
  const { project, samples } = scene,
    road = project.road,
    scale = view.camera.scale;
  const terrain = terrainBounds(project, samples);
  const corner = view.toScreen({ x: terrain.minX, z: terrain.minZ });
  const width = (terrain.maxX - terrain.minX) * scale,
    height = (terrain.maxZ - terrain.minZ) * scale;
  inLayer(ctx, scene, 'terrain', () => {
    ctx.fillStyle = COLORS.terrain.fill;
    ctx.fillRect(corner.x, corner.y, width, height);
    ctx.strokeStyle = COLORS.terrain.outline;
    ctx.lineWidth = 1;
    dashed(ctx, [6, 5], () => ctx.strokeRect(corner.x, corner.y, width, height));
    drawTerrainShapes(ctx, view, scene);
  });

  const kerbs = 2 * kerbWidth(road);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const stroke = (color: string, width: (half: number) => number, dash?: number[]) =>
    strokeAlong(ctx, view, samples, color, width, dash);
  stroke(COLORS.road.shadow, (half) => (2 * half + road.shoulder * 2 + 5) * scale + 4);
  stroke(COLORS.road.shoulder, (half) => (2 * half + road.shoulder * 2 + kerbs) * scale);
  if (road.kerbs) {
    stroke(COLORS.road.kerbWhite, (half) => (2 * half + kerbs) * scale);
    stroke(COLORS.road.kerbRed, (half) => (2 * half + kerbs) * scale, [5 * scale, 5 * scale]);
  }
  stroke(COLORS.road.edge, (half) => Math.max(2 * half * scale, 2));
  stroke(COLORS.road.asphalt, (half) => Math.max((2 * half - 0.6) * scale, 1.5));
  trace(ctx, view, samples);
  ctx.strokeStyle = COLORS.road.centerLine;
  ctx.lineWidth = 0.75;
  dashed(ctx, [3, 7], () => ctx.stroke());

  // Direction arrows, evenly spread along the track.
  const length = trackLength(samples);
  ctx.strokeStyle = COLORS.road.arrow;
  ctx.lineWidth = 1.4;
  for (let s = length / 9; s < length; s += length / 6) {
    const sample = sampleAt(samples, s)!,
      p = view.toScreen(sample);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(-sample.nx, sample.nz));
    ctx.beginPath();
    ctx.moveTo(-4, -3);
    ctx.lineTo(1, 0);
    ctx.lineTo(-4, 3);
    ctx.stroke();
    ctx.restore();
  }
}

/** The outline of a hill on the plan, at a share `r` of its size: 1 for its foot. */
function hillRing(ctx: Context, view: PlanProjection, hill: Hill, r = 1) {
  trace(ctx, view, hillOutline(hill, r));
  ctx.closePath();
}

/** A hill as contour lines, a hollow in another colour. */
function drawHill(ctx: Context, view: PlanProjection, hill: Hill) {
  const hollow = hill.height < 0;
  hillRing(ctx, view, hill);
  ctx.fillStyle = hollow ? COLORS.hill.hollowFill : COLORS.hill.fill;
  ctx.fill();
  ctx.strokeStyle = hollow ? COLORS.hill.hollow : COLORS.hill.rise;
  ctx.lineWidth = 1;
  for (const r of [1, 0.66, 0.33]) {
    hillRing(ctx, view, hill, r);
    ctx.stroke();
  }
}

/** The ground an earthwork covers along a range, from the shoulders out to its far edge. */
function earthworkArea(
  ctx: Context,
  view: PlanProjection,
  scene: PlanScene,
  earthwork: Pick<Earthwork, 'side' | 'offset' | 'width'>,
  range: TrackRange,
) {
  trace(ctx, view, earthworkOutline(scene.project, scene.samples, earthwork, range));
  ctx.closePath();
}

/** An earthwork seen from above: slope ticks on an embankment, the bottom line of a ditch. */
function drawEarthwork(
  ctx: Context,
  view: PlanProjection,
  scene: PlanScene,
  lane: PitLaneLayout | null,
  { earthwork, ...range }: EarthworkRange,
) {
  const { project, samples } = scene;
  const { side, offset, width } = earthwork;
  const path = rangeSamples(samples, range);
  const beside = (sample: Sample, beyond: number) =>
    pointBesideShoulders(project, lane, sample, side, beyond);
  const color = COLORS.earthwork[earthwork.type];
  earthworkArea(ctx, view, scene, earthwork, range);
  ctx.save();
  ctx.globalAlpha *= 0.3;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  if (earthwork.type === 'ditch') {
    trace(
      ctx,
      view,
      path.map((sample) => beside(sample, offset + width / 2)),
    );
    ctx.stroke();
  } else if (earthwork.type === 'embankment') {
    // Slope ticks every 4 m along the track, hanging from the top of the slope.
    const [top, foot] = earthwork.height >= 0 ? [offset + width, offset] : [offset, offset + width];
    ctx.beginPath();
    let next = path[0]?.s ?? 0;
    for (const sample of path) {
      if (sample.s < next) continue;
      next = sample.s + 4;
      const a = view.toScreen(beside(sample, top)),
        b = view.toScreen(beside(sample, top + (foot - top) * 0.6));
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }
}

/** Heights of painted relief shaded in steps, each step a little darker. */
const RELIEF_STEP = 2.5;

/** The painted relief as shaded squares, one per node: raised ground and hollows in their colours. */
function drawRelief(ctx: Context, view: PlanProjection, field: SculptField) {
  if (!field.size) return;
  const half = (SCULPT.cell / 2) * view.camera.scale;
  // Squares of one shade are filled together.
  const shades = new Map<string, { hollow: boolean; level: number; squares: ScreenPoint[] }>();
  for (const node of field.nodes()) {
    const depth = Math.abs(node.height);
    if (depth < 0.05) continue;
    const hollow = node.height < 0,
      level = Math.min(4, Math.floor(depth / RELIEF_STEP));
    const key = `${hollow}${level}`;
    if (!shades.has(key)) shades.set(key, { hollow, level, squares: [] });
    shades.get(key)!.squares.push(view.toScreen(node));
  }
  ctx.save();
  for (const { hollow, level, squares } of shades.values()) {
    ctx.beginPath();
    for (const p of squares) ctx.rect(p.x - half, p.y - half, half * 2, half * 2);
    ctx.globalAlpha = 0.12 + level * 0.1;
    ctx.fillStyle = hollow ? COLORS.hill.hollow : COLORS.hill.rise;
    ctx.fill();
  }
  ctx.restore();
}

/** The reach of the brush around the pointer. */
function drawBrush(ctx: Context, view: PlanProjection, brush: NonNullable<Editing['brush']>) {
  const p = view.toScreen(brush),
    radius = brush.radius * view.camera.scale;
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius / 2, 0, Math.PI * 2);
  dashed(ctx, [4, 4], () => ctx.stroke());
}

/** Painted relief, hills and earthworks, the selected ones outlined, and what the active tool would lay. */
function drawTerrainShapes(ctx: Context, view: PlanProjection, scene: PlanScene) {
  const { project, samples } = scene;
  drawRelief(ctx, view, scene.sculpt);
  if (scene.editing.brush) drawBrush(ctx, view, scene.editing.brush);
  for (const hill of project.hills) {
    drawHill(ctx, view, hill);
    if (!isSelected(scene, 'hill', hill.id)) continue;
    hillRing(ctx, view, hill);
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  const lane = pitLaneLayout(project, samples);
  for (const laid of earthworkRanges(project, samples)) {
    drawEarthwork(ctx, view, scene, lane, laid);
    if (!isSelected(scene, 'earthwork', laid.earthwork.id)) continue;
    earthworkArea(ctx, view, scene, laid.earthwork, laid);
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  const ghost = scene.hillGhost;
  if (ghost) {
    hillRing(ctx, view, ghost);
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 1.5;
    dashed(ctx, [5, 4], () => ctx.stroke());
  }
  const laying = layingOf(scene, 'earthwork');
  if (!laying) return;
  const { from } = laying;
  if (laying.range) {
    const shape = { side: from.side, ...EARTHWORK_DEFAULTS[laying.earthworkType] };
    earthworkArea(ctx, view, scene, shape, laying.range);
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 2;
    dashed(ctx, [6, 5], () => ctx.stroke());
  }
  // The first click, on its side of the track.
  const start = sampleAt(samples, from.s)!;
  const p = view.toScreen(pointBesideShoulders(project, lane, start, from.side, 0));
  ctx.beginPath();
  ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** Chequered start line and the start/finish labels. */
function drawStart(ctx: Context, view: PlanProjection, scene: PlanScene) {
  const start = startLine(scene.project, scene.samples);
  const p = view.toScreen(start),
    half = start.half * view.camera.scale;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.atan2(-start.nx, start.nz));
  const block = Math.max(2.5, half / 4);
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? COLORS.start.dark : COLORS.start.light;
      ctx.fillRect((j - 1) * block, -half + (i * half) / 4, block, half / 4);
    }
  ctx.restore();
  ctx.font = '8px "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.start.label;
  ctx.fillText(scene.labels.start, p.x + 13, p.y + half + 24);
  if (!scene.project.road.closed) {
    const end = view.toScreen(scene.samples.at(-1)!);
    ctx.fillText(scene.labels.finish, end.x + 13, end.y + 21);
  }
}

/** Pit lane surface, wall, boxes and starting grid; the lane being laid as a dashed line. */
function drawPits(ctx: Context, view: PlanProjection, scene: PlanScene) {
  const { project, samples } = scene;
  const lane = pitLaneLayout(project, samples);
  const edge = (sample: Sample) => roadEdge(project.road, sample);
  const beside = (sample: Sample, lateral: number) =>
    view.toScreen({ x: sample.x + sample.nx * lateral, z: sample.z + sample.nz * lateral });
  if (lane && scene.editing.selection?.kind === 'pitLane') {
    // A halo along the middle of the lane.
    const middle = samples.filter((sample) => lane.profile(sample.s));
    trace(
      ctx,
      view,
      middle.map((sample) => {
        const lateral = lane.sign * lane.profile(sample.s)!.center;
        return { x: sample.x + sample.nx * lateral, y: 0, z: sample.z + sample.nz * lateral };
      }),
    );
    ctx.strokeStyle = COLORS.selection;
    ctx.lineWidth = Math.max(8, lane.width * view.camera.scale);
    ctx.stroke();
  }
  if (lane) {
    ctx.fillStyle = COLORS.pits.lane;
    ctx.strokeStyle = COLORS.pits.lane;
    ctx.lineWidth = 0.5;
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1],
        b = samples[i];
      const pa = lane.profile(a.s),
        pb = lane.profile(b.s);
      if (!pa || !pb || lane.along(b.s)! < lane.along(a.s)!) continue;
      const corners = [
        beside(a, lane.sign * pa.edge),
        beside(a, lane.sign * pa.outer),
        beside(b, lane.sign * pb.outer),
        beside(b, lane.sign * pb.edge),
      ];
      ctx.beginPath();
      corners.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = COLORS.pits.wall;
    ctx.lineWidth = Math.max(1, LAYOUT.pitLane.wall.thickness * view.camera.scale);
    ctx.beginPath();
    let drawing = false;
    for (const sample of samples) {
      const along = lane.along(sample.s);
      const inWall = along !== null && along >= lane.taper && along <= lane.length - lane.taper;
      const p = beside(sample, lane.sign * (edge(sample) + LAYOUT.pitLane.wallGap / 2));
      if (inWall && drawing) ctx.lineTo(p.x, p.y);
      else if (inWall) ctx.moveTo(p.x, p.y);
      drawing = inWall;
    }
    ctx.stroke();
  }
  const mark = (places: Place[], color: string) => {
    ctx.fillStyle = color;
    const size = Math.max(2, 1.6 * view.camera.scale);
    for (const { sample, lateral } of places) {
      const p = beside(sample, lateral);
      ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    }
  };
  mark(pitBoxPlaces(project, samples), COLORS.pits.box);
  mark(gridPlaces(project, samples), COLORS.pits.grid);

  const laying = layingOf(scene, 'pitLane');
  if (laying?.range) {
    const sign = laying.from.side === 'right' ? 1 : -1;
    const lateral = LAYOUT.pitLane.wallGap + DEFAULTS.pitLaneWidth / 2;
    ctx.beginPath();
    rangeSamples(samples, laying.range).forEach((sample, i) => {
      const p = beside(sample, sign * (edge(sample) + lateral));
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 3;
    dashed(ctx, [6, 5], () => ctx.stroke());
  }
}

/** Starts a path along the roadway edges of a range, on the given sides (-1 left, 1 right). */
function roadwayEdges(
  ctx: Context,
  view: PlanProjection,
  samples: readonly Sample[],
  range: TrackRange,
  sides: readonly number[],
) {
  const path = rangeSamples(samples, range);
  ctx.beginPath();
  for (const side of sides)
    path.forEach((sample, i) => {
      const p = view.toScreen({
        x: sample.x + sample.nx * side * sample.half,
        z: sample.z + sample.nz * side * sample.half,
      });
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
}

/**
 * Zones laid on the roadway: the edges of every width zone and the raised edge of
 * every bank zone, the selected one highlighted, and the zone being laid as dashed
 * edges.
 */
function drawRoadZones(ctx: Context, view: PlanProjection, scene: PlanScene) {
  const { project, samples } = scene;
  const zone = (range: TrackRange, sides: readonly number[], color: string, selected: boolean) => {
    roadwayEdges(ctx, view, samples, range, sides);
    if (selected) {
      ctx.strokeStyle = COLORS.selection;
      ctx.lineWidth = 6;
      ctx.stroke();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };
  ctx.save();
  ctx.lineCap = 'round';
  for (const range of widthZoneRanges(project, samples))
    zone(range, [-1, 1], COLORS.widthZone, isSelected(scene, 'widthZone', range.zone.id));
  for (const range of bankZoneRanges(project, samples))
    zone(
      range,
      [range.zone.high === 'right' ? 1 : -1],
      COLORS.bankZone,
      isSelected(scene, 'bankZone', range.zone.id),
    );
  for (const kind of ['widthZone', 'bankZone'] as const) {
    const laying = layingOf(scene, kind);
    if (!laying?.range) continue;
    roadwayEdges(ctx, view, samples, laying.range, [-1, 1]);
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 2.5;
    dashed(ctx, [6, 5], () => ctx.stroke());
  }
  ctx.restore();
}

/** Highlights the bends that are too tight, with a marker where each is tightest. */
function drawTightTurns(ctx: Context, view: PlanProjection, scene: PlanScene) {
  if (!scene.tightTurns.length) return;
  const segments = new Set(scene.tightTurns.map((turn) => turn.segment));
  ctx.save();
  ctx.strokeStyle = COLORS.danger;
  ctx.lineWidth = 3;
  dashed(ctx, [7, 4], () => {
    ctx.beginPath();
    for (let i = 0; i < scene.samples.length - 1; i++) {
      if (!segments.has(scene.samples[i].segment)) continue;
      const a = view.toScreen(scene.samples[i]),
        b = view.toScreen(scene.samples[i + 1]);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  });
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const turn of scene.tightTurns) {
    const p = view.toScreen(scene.samples[turn.sampleIndex]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.dangerFill;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.danger;
    ctx.fillText('!', p.x, p.y);
  }
  ctx.restore();
}

/** Every barrier, the one being laid and the markers of its endpoints. */
function drawBarriers(ctx: Context, view: PlanProjection, scene: PlanScene) {
  const { project, samples } = scene;
  for (const barrier of project.barriers) {
    const path = barrierPath(project, samples, barrier);
    if (path.length < 2) continue;
    const style = BARRIER_STYLE[barrier.type];
    trace(ctx, view, path);
    if (isSelected(scene, 'barrier', barrier.id)) {
      ctx.strokeStyle = COLORS.selection;
      ctx.lineWidth = style.width + 5;
      ctx.stroke();
    }
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.width;
    dashed(ctx, style.dash, () => ctx.stroke());
  }
  const laying = layingOf(scene, 'barrier');
  if (!laying) return;
  const line = { side: laying.from.side, offset: DEFAULTS.barrierOffset };
  if (laying.range) {
    const path = barrierLine(project, samples, rangeSamples(samples, laying.range), line);
    if (path.length > 1) {
      trace(ctx, view, path);
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = 3;
      dashed(ctx, [6, 5], () => ctx.stroke());
    }
  }
  // The first click, on its side of the road.
  const [start] = barrierLine(project, samples, [sampleAt(samples, laying.from.s)!], line);
  const p = view.toScreen(start);
  ctx.beginPath();
  ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** The outline of a scenery item on the plan: the round of a tree or grove, the rectangle of the others. */
function sceneryOutline(ctx: Context, view: PlanProjection, item: SceneryItem) {
  ctx.beginPath();
  if (item.kind === 'tree') {
    const p = view.toScreen(item);
    ctx.arc(p.x, p.y, Math.max(3, (item.width / 2) * view.camera.scale), 0, Math.PI * 2);
    return;
  }
  sceneryFootprint(item).forEach((corner, i) => {
    const p = view.toScreen(corner);
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  });
  ctx.closePath();
}

/** One scenery item as seen from above, with its front marked when it has one. */
function drawItem(ctx: Context, view: PlanProjection, item: SceneryItem) {
  const scale = view.camera.scale;
  if (item.kind === 'tree') {
    ctx.fillStyle = item.variant === 'conifer' ? COLORS.scenery.conifer : COLORS.scenery.leafy;
    ctx.strokeStyle = COLORS.scenery.outline;
    ctx.lineWidth = 1;
    const front = headingVector(item.heading);
    for (const tree of groveTrees(item)) {
      const p = view.toScreen({
        x: item.x + front.x * tree.v - front.z * tree.u,
        z: item.z + front.z * tree.v + front.x * tree.u,
      });
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(2, (tree.crown / 2) * scale), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    return;
  }
  if (item.kind === 'light') {
    const p = view.toScreen(item);
    ctx.fillStyle = COLORS.scenery.glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(6, item.height * 1.2 * scale), 0, Math.PI * 2);
    ctx.fill();
    const front = headingVector(item.heading);
    ctx.strokeStyle = COLORS.scenery.light;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const sign of item.variant === 'double' ? [1, -1] : [1]) {
      const end = view.toScreen({
        x: item.x + front.x * item.width * sign,
        z: item.z + front.z * item.width * sign,
      });
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(end.x, end.y);
    }
    ctx.stroke();
    ctx.fillStyle = COLORS.scenery.light;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  sceneryOutline(ctx, view, item);
  ctx.fillStyle = COLORS.scenery[item.kind];
  ctx.fill();
  ctx.strokeStyle = COLORS.scenery.outline;
  ctx.lineWidth = item.kind === 'sign' ? 3 : 1;
  ctx.stroke();
  if (item.kind === 'building') return;
  // The front, the side that faces the track.
  const [, , c, d] = sceneryFootprint(item).map((corner) => view.toScreen(corner));
  ctx.strokeStyle = COLORS.scenery.front;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.stroke();
}

/** The scenery items, the selected ones highlighted, and the one the active tool would place. */
function drawScenery(ctx: Context, view: PlanProjection, scene: PlanScene) {
  for (const item of scene.project.scenery) {
    const selected = isSelected(scene, 'scenery', item.id);
    if (selected || item.id === scene.hoveredSceneryId) {
      sceneryOutline(ctx, view, item);
      ctx.strokeStyle = selected ? COLORS.accent : COLORS.point.hover;
      ctx.lineWidth = selected ? 5 : 2;
      ctx.stroke();
    }
    drawItem(ctx, view, item);
    // A solid item stops cars: a dashed line runs round it.
    if (item.solid) {
      sceneryOutline(ctx, view, item);
      ctx.strokeStyle = COLORS.danger;
      ctx.lineWidth = 1;
      dashed(ctx, [3, 3], () => ctx.stroke());
    }
  }
  const ghost = scene.sceneryGhost;
  if (!ghost) return;
  ctx.save();
  ctx.globalAlpha = 0.5;
  drawItem(ctx, view, ghost);
  ctx.restore();
  sceneryOutline(ctx, view, ghost);
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 1.5;
  dashed(ctx, [5, 4], () => ctx.stroke());
}

/** Control points, numbered, with the selected and the problematic ones highlighted. */
function drawPoints(ctx: Context, view: PlanProjection, scene: PlanScene) {
  const affected = new Set(scene.tightTurns.flatMap((turn) => turn.pointIds));
  ctx.font = '9px Consolas, monospace';
  // Off the track layer, points are only landmarks for track positions.
  if (scene.editing.layer !== 'track') {
    ctx.save();
    ctx.globalAlpha = INACTIVE_LAYER_ALPHA;
    ctx.fillStyle = COLORS.point.outline;
    ctx.textBaseline = 'middle';
    scene.project.points.forEach((point, i) => {
      const p = view.toScreen(point);
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      ctx.fillText(String(i + 1).padStart(2, '0'), p.x + 6, p.y - 6);
    });
    ctx.restore();
    return;
  }
  scene.project.points.forEach((point, i) => {
    const p = view.toScreen(point),
      selected = isSelected(scene, 'points', point.id),
      invalid = affected.has(point.id);
    if (selected) {
      ctx.fillStyle = COLORS.point.halo;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.point.haloOutline;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, selected ? 6 : 4.5, 0, Math.PI * 2);
    ctx.fillStyle = selected ? COLORS.accent : COLORS.point.fill;
    ctx.fill();
    ctx.strokeStyle = invalid
      ? COLORS.danger
      : point.id === scene.hoveredPointId
        ? COLORS.point.hover
        : COLORS.point.outline;
    ctx.lineWidth = selected ? 2 : 1.5;
    ctx.stroke();
    // The number sits on the right of the track direction, away from the road.
    const sample = scene.samples.find((candidate) => candidate.segment === i);
    const nx = sample?.nx ?? 0,
      nz = sample?.nz ?? -1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = invalid
      ? COLORS.danger
      : selected
        ? COLORS.point.selectedLabel
        : COLORS.point.label;
    ctx.fillText(
      `${String(i + 1).padStart(2, '0')}${invalid ? ' !' : ''}`,
      p.x + nx * 18 + 9,
      p.y + nz * 18 - 7,
    );
  });
}

/** Rounded points: the sides from the arc to the point, dashed, and the radius. */
function drawCorners(ctx: Context, view: PlanProjection, scene: PlanScene) {
  ctx.font = '10px "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  for (const corner of corners(scene.project).values()) {
    const point = scene.project.points[corner.index];
    const enter = view.toScreen(corner.enter),
      vertex = view.toScreen(point),
      exit = view.toScreen(corner.exit);
    ctx.strokeStyle = COLORS.point.label;
    ctx.lineWidth = 1;
    dashed(ctx, [3, 4], () => {
      ctx.beginPath();
      ctx.moveTo(enter.x, enter.y);
      ctx.lineTo(vertex.x, vertex.y);
      ctx.lineTo(exit.x, exit.y);
      ctx.stroke();
    });
    for (const end of [enter, exit]) ctx.fillRect(end.x - 2, end.y - 2, 4, 4);
    const reduced = corner.radius < corner.requested * (1 - 1e-6);
    ctx.fillStyle = reduced ? COLORS.danger : COLORS.point.label;
    // The radius sits outside the bend, beyond the point.
    const middle = view.toScreen(corner.middle);
    const dx = vertex.x - middle.x,
      dy = vertex.y - middle.y,
      l = Math.hypot(dx, dy) || 1;
    ctx.textAlign = dx >= 0 ? 'left' : 'right';
    ctx.fillText(
      scene.labels.radius(Math.round(corner.radius)),
      vertex.x + (dx / l) * 14,
      vertex.y + (dy / l) * 14,
    );
  }
}

/** The points of an arc drawn from `from`, every few degrees. */
function arcPath(from: Vec3 | { x: number; z: number }, shape: ArcShape) {
  const { heading, radius, angle, sign } = shape;
  const center = { x: from.x - heading.z * radius * sign, z: from.z + heading.x * radius * sign };
  const ex = (from.x - center.x) / radius,
    ez = (from.z - center.z) / radius;
  const steps = Math.max(8, Math.ceil(angle / 0.05));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const turn = (angle * i) / steps;
    return {
      x: center.x + radius * (Math.cos(turn) * ex + Math.sin(turn) * heading.x),
      y: 0,
      z: center.z + radius * (Math.cos(turn) * ez + Math.sin(turn) * heading.z),
    };
  });
}

/** The straight or the arc the next click would draw, with its measures. */
function drawDraft(ctx: Context, view: PlanProjection, scene: PlanScene) {
  const draft = scene.drawDraft;
  if (!draft) return;
  const path =
    draft.kind === 'straight'
      ? [
          { ...draft.from, y: 0 },
          { ...draft.to, y: 0 },
        ]
      : arcPath(draft.from, draft.shape);
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 2;
  dashed(ctx, [7, 5], () => {
    trace(ctx, view, path);
    ctx.stroke();
  });
  if (draft.kind === 'arc') {
    ctx.fillStyle = COLORS.point.outline;
    for (const vertex of arcLayout(draft.from, draft.shape).vertices) {
      const p = view.toScreen(vertex);
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
  }
  const end = view.toScreen(draft.to);
  ctx.beginPath();
  ctx.arc(end.x, end.y, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.accent;
  ctx.fill();
  ctx.font = '11px "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    draft.kind === 'straight'
      ? scene.labels.straight(draft.length, Math.round(draft.turn))
      : scene.labels.arc(Math.round(draft.shape.radius), arcDegrees(draft.shape)),
    end.x + 10,
    end.y - 10,
  );
}

/** The stretch picked in the band, its roadway edges dashed. */
function drawRange(ctx: Context, view: PlanProjection, scene: PlanScene) {
  if (!scene.editing.range) return;
  const path = rangeSamples(scene.samples, scene.editing.range);
  ctx.beginPath();
  for (const side of [-1, 1])
    path.forEach((sample, i) => {
      const lateral = side * (sample.half + 1);
      const p = view.toScreen({
        x: sample.x + sample.nx * lateral,
        z: sample.z + sample.nz * lateral,
      });
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 2.5;
  dashed(ctx, [7, 5], () => ctx.stroke());
}

/** A line across the road where the pointer is, here or in the band, with its track distance. */
function drawCursor(ctx: Context, view: PlanProjection, scene: PlanScene) {
  const { hoverS } = scene.editing;
  if (hoverS === null) return;
  const sample = sampleAt(scene.samples, hoverS)!;
  const reach = sample.half + 6;
  const a = view.toScreen({ x: sample.x - sample.nx * reach, z: sample.z - sample.nz * reach });
  const b = view.toScreen({ x: sample.x + sample.nx * reach, z: sample.z + sample.nz * reach });
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.font = '10px "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.accent;
  ctx.fillText(scene.labels.distance(hoverS), b.x + 6, b.y);
}

/** Draws what belongs to a layer: in full on the active layer, dimmed otherwise, not at all when hidden. */
function inLayer(ctx: Context, scene: PlanScene, layer: LayerId, draw: () => void) {
  if (scene.editing.hiddenLayers.includes(layer)) return;
  ctx.save();
  if (layer !== scene.editing.layer) ctx.globalAlpha = INACTIVE_LAYER_ALPHA;
  draw();
  ctx.restore();
}

/** Draws the whole plan. `dpr` is the canvas pixel ratio. */
export function drawPlan(ctx: Context, view: PlanProjection, scene: PlanScene, dpr: number) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBackground(ctx, view);
  if (scene.samples.length > 1) {
    drawTrack(ctx, view, scene);
    inLayer(ctx, scene, 'pits', () => drawPits(ctx, view, scene));
    inLayer(ctx, scene, 'road', () => drawRoadZones(ctx, view, scene));
    drawStart(ctx, view, scene);
    drawTightTurns(ctx, view, scene);
    inLayer(ctx, scene, 'edges', () => drawBarriers(ctx, view, scene));
    drawRange(ctx, view, scene);
  }
  inLayer(ctx, scene, 'scenery', () => drawScenery(ctx, view, scene));
  if (scene.editing.layer === 'track') drawCorners(ctx, view, scene);
  drawPoints(ctx, view, scene);
  drawDraft(ctx, view, scene);
  if (scene.samples.length > 1) drawCursor(ctx, view, scene);
  const box = scene.marquee;
  if (box) {
    const x = Math.min(box.x0, box.x1),
      y = Math.min(box.y0, box.y1);
    ctx.fillStyle = COLORS.band.range;
    ctx.fillRect(x, y, Math.abs(box.x1 - box.x0), Math.abs(box.y1 - box.y0));
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, Math.abs(box.x1 - box.x0), Math.abs(box.y1 - box.y0));
  }
}
