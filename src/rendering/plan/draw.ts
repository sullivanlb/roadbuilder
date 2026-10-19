import type { Id } from '../../core/ids';
import type { Vec3 } from '../../core/math';
import { DEFAULTS } from '../../core/project/rules';
import { isCircuit } from '../../core/project/schema';
import type { Project, Side } from '../../core/project/schema';
import { barrierPath } from '../../core/scene/barriers';
import { gridPlaces, pitBoxPlaces } from '../../core/scene/markers';
import type { Place } from '../../core/scene/markers';
import { startLine } from '../../core/scene/road';
import { sampleAt, trackLength } from '../../core/track/centerline';
import type { Sample } from '../../core/track/centerline';
import type { TightTurn } from '../../core/track/issues';
import { kerbWidth, LAYOUT, roadEdge, terrainBounds } from '../../core/track/layout';
import { pitLaneLayout } from '../../core/track/pitLane';
import { BARRIER_STYLE, COLORS } from '../theme';
import type { PlanProjection } from './projection';

/** Everything the plan shows, read from the stores by the plan canvas. */
export interface PlanScene {
  project: Project;
  samples: readonly Sample[];
  tightTurns: readonly TightTurn[];
  selectedPointId: Id | null;
  hoveredPointId: Id | null;
  selectedBarrierId: Id | null;
  /** First click of the barrier being laid. */
  barrierDraft: { from: Id; side: Side } | null;
  /** Where the next barrier click would land. */
  roadTarget: { pointId: Id; side: Side } | null;
  /** Entry of the pit lane being laid, as a track distance. */
  pitDraft: { entry: number; side: Side } | null;
  /** Where the next pit lane click would land. */
  pitTarget: { s: number; side: Side } | null;
  labels: { start: string; finish: string };
}

type Context = CanvasRenderingContext2D;

function trace(ctx: Context, view: PlanProjection, points: readonly Vec3[]) {
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

/** Terrain outline, then the road drawn as stacked strokes from the widest to the narrowest. */
function drawTrack(ctx: Context, view: PlanProjection, scene: PlanScene) {
  const { project, samples } = scene,
    road = project.road,
    scale = view.camera.scale;
  const terrain = terrainBounds(project, samples);
  const corner = view.toScreen({ x: terrain.minX, z: terrain.minZ });
  const width = (terrain.maxX - terrain.minX) * scale,
    height = (terrain.maxZ - terrain.minZ) * scale;
  ctx.fillStyle = COLORS.terrain.fill;
  ctx.fillRect(corner.x, corner.y, width, height);
  ctx.strokeStyle = COLORS.terrain.outline;
  ctx.lineWidth = 1;
  dashed(ctx, [6, 5], () => ctx.strokeRect(corner.x, corner.y, width, height));

  const kerbs = 2 * kerbWidth(road);
  trace(ctx, view, samples);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const stroke = (color: string, lineWidth: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  };
  stroke(COLORS.road.shadow, (road.width + road.shoulder * 2 + 5) * scale + 4);
  stroke(COLORS.road.shoulder, (road.width + road.shoulder * 2 + kerbs) * scale);
  if (road.kerbs) {
    stroke(COLORS.road.kerbWhite, (road.width + kerbs) * scale);
    dashed(ctx, [5 * scale, 5 * scale], () =>
      stroke(COLORS.road.kerbRed, (road.width + kerbs) * scale),
    );
  }
  stroke(COLORS.road.edge, Math.max(road.width * scale, 2));
  stroke(COLORS.road.asphalt, Math.max((road.width - 0.6) * scale, 1.5));
  dashed(ctx, [3, 7], () => stroke(COLORS.road.centerLine, 0.75));

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

/** Chequered start line and the start/finish labels. */
function drawStart(ctx: Context, view: PlanProjection, scene: PlanScene) {
  const start = startLine(scene.project, scene.samples);
  const p = view.toScreen(start),
    half = (scene.project.road.width * view.camera.scale) / 2;
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
  const edge = roadEdge(project.road);
  const beside = (sample: Sample, lateral: number) =>
    view.toScreen({ x: sample.x + sample.nx * lateral, z: sample.z + sample.nz * lateral });
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
        beside(a, lane.sign * edge),
        beside(a, lane.sign * pa.outer),
        beside(b, lane.sign * pb.outer),
        beside(b, lane.sign * edge),
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
      const p = beside(sample, lane.sign * (edge + LAYOUT.pitLane.wallGap / 2));
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

  const draft = scene.pitDraft,
    target = scene.pitTarget;
  if (draft && target) {
    const total = trackLength(samples);
    const span = (((target.s - draft.entry) % total) + total) % total;
    const sign = draft.side === 'right' ? 1 : -1;
    const lateral = sign * (edge + LAYOUT.pitLane.wallGap + DEFAULTS.pitLaneWidth / 2);
    ctx.beginPath();
    for (let d = 0; d <= span; d += 3) {
      const p = beside(sampleAt(samples, (draft.entry + d) % total)!, lateral);
      if (d === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 3;
    dashed(ctx, [6, 5], () => ctx.stroke());
  }
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
    if (barrier.id === scene.selectedBarrierId) {
      ctx.strokeStyle = COLORS.selection;
      ctx.lineWidth = style.width + 5;
      ctx.stroke();
    }
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.width;
    dashed(ctx, style.dash, () => ctx.stroke());
  }
  const draft = scene.barrierDraft,
    target = scene.roadTarget;
  if (draft && target && target.pointId !== draft.from) {
    const index = (id: Id) => project.points.findIndex((point) => point.id === id);
    const forward = isCircuit(project) || index(draft.from) < index(target.pointId);
    const [from, to] = forward ? [draft.from, target.pointId] : [target.pointId, draft.from];
    const path = barrierPath(project, samples, {
      from,
      to,
      side: draft.side,
      offset: DEFAULTS.barrierOffset,
    });
    if (path.length > 1) {
      trace(ctx, view, path);
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = 3;
      dashed(ctx, [6, 5], () => ctx.stroke());
    }
  }
  const ring = (id: Id, color: string) => {
    const point = project.points.find((candidate) => candidate.id === id);
    if (!point) return;
    const p = view.toScreen(point);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };
  if (target) ring(target.pointId, COLORS.point.haloOutline);
  if (draft) ring(draft.from, COLORS.accent);
}

/** Control points, numbered, with the selected and the problematic ones highlighted. */
function drawPoints(ctx: Context, view: PlanProjection, scene: PlanScene) {
  const affected = new Set(scene.tightTurns.flatMap((turn) => turn.pointIds));
  ctx.font = '9px Consolas, monospace';
  scene.project.points.forEach((point, i) => {
    const p = view.toScreen(point),
      selected = point.id === scene.selectedPointId,
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

/** Draws the whole plan. `dpr` is the canvas pixel ratio. */
export function drawPlan(ctx: Context, view: PlanProjection, scene: PlanScene, dpr: number) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBackground(ctx, view);
  if (scene.samples.length > 1) {
    drawTrack(ctx, view, scene);
    drawPits(ctx, view, scene);
    drawStart(ctx, view, scene);
    drawTightTurns(ctx, view, scene);
    drawBarriers(ctx, view, scene);
  }
  drawPoints(ctx, view, scene);
}
