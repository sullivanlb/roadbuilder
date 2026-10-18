import type {
  BarrierDraft,
  BarrierSide,
  BarrierType,
  Bounds,
  Point,
  Project,
  Sample,
  Scene,
  TightTurn,
  ViewMode,
} from '../domain/types';
import { clamp } from '../domain/math';
import { createProject } from '../domain/project/factory';
import { bounds, trackStats, sampleAt } from '../domain/track/geometry';
import { terrainBounds } from '../domain/track/terrain';
import { buildScene } from '../domain/track/scene';
import { MATERIALS } from '../domain/track/mesh';
import { DEFAULT_BARRIER_OFFSET, barrierPath } from '../domain/track/barriers';
const BARRIER_STYLE: Record<BarrierType, { color: string; width: number; dash: number[] }> = {
  guardrail: { color: '#c8d3d7', width: 2.5, dash: [] },
  tires: { color: '#98a2a9', width: 3, dash: [2, 3] },
  tecpro: { color: '#d0664a', width: 3.5, dash: [6, 4] },
  wall: { color: '#e7e6da', width: 4, dash: [] },
};
const DRAFT_COLOR = '#d3f47d';
class TrackRenderer {
  canvas: HTMLCanvasElement;
  elevation: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  profile: CanvasRenderingContext2D;
  mode: ViewMode;
  selected: number;
  hover: number;
  camera: { x: number; y: number; z: number; scale: number; yaw: number; pitch: number };
  samples: Sample[];
  project: Project;
  scene: Scene | null;
  fitted: boolean;
  width: number;
  height: number;
  dpr = 1;
  profileWidth = 1;
  profileHeight = 1;
  baseScale = 1;
  frame: number | null = null;
  observer: ResizeObserver;
  onDraw?: () => void;
  tightTurns: TightTurn[] = [];
  selectedBarrier = -1;
  barrierDraft: BarrierDraft | null = null;
  barrierHover: { index: number; side: BarrierSide } | null = null;
  dispose() {
    this.observer.disconnect();
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.onDraw = undefined;
  }

  constructor(canvas: HTMLCanvasElement, elevation: HTMLCanvasElement) {
    this.canvas = canvas;
    this.elevation = elevation;
    this.ctx = canvas.getContext('2d')!;
    this.profile = elevation.getContext('2d')!;
    this.mode = '2d';
    this.selected = 0;
    this.hover = -1;
    this.camera = { x: 0, z: 0, y: 0, scale: 1, yaw: -0.45, pitch: 0.8 };
    this.samples = [];
    this.project = createProject();
    this.scene = null;
    this.fitted = false;
    this.width = 800;
    this.height = 500;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas.parentElement!);
    this.observer.observe(elevation);
    this.resize();
    this.fitted = false;
  }
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    const profileRect = this.elevation.getBoundingClientRect();
    this.profileWidth = Math.max(1, profileRect.width);
    this.profileHeight = Math.max(1, profileRect.height);
    this.elevation.width = Math.round(this.profileWidth * this.dpr);
    this.elevation.height = Math.round(this.profileHeight * this.dpr);
    if (this.project && !this.fitted) this.fit();
    this.requestDraw();
  }
  setProject(
    project: Project,
    samples: Sample[],
    selected: number,
    tightTurns: TightTurn[] = [],
    selectedBarrier = -1,
    barrierDraft: BarrierDraft | null = null,
  ) {
    this.project = project;
    this.samples = samples;
    this.selected = selected;
    this.tightTurns = tightTurns;
    this.selectedBarrier = selectedBarrier;
    this.barrierDraft = barrierDraft;
    this.scene = null;
    if (!this.fitted) this.fit();
    this.requestDraw();
  }
  fit() {
    if (!this.project) return;
    const b =
      this.samples.length > 1
        ? terrainBounds(this.project, this.samples)
        : bounds(this.project.points, 18);
    this.frameBounds(b);
  }
  focus(points: Point[]) {
    if (!points.length) return;
    this.frameBounds(bounds(points, Math.max(20, this.project.width * 2)));
  }
  private frameBounds(b: Bounds) {
    this.camera.x = (b.minX + b.maxX) / 2;
    this.camera.z = (b.minZ + b.maxZ) / 2;
    this.camera.y = (b.minY + b.maxY) / 2;
    const availableW = Math.max(100, this.width - 100),
      availableH = Math.max(90, this.height - 145);
    this.camera.scale = clamp(
      Math.min(
        availableW / Math.max(60, b.maxX - b.minX),
        availableH / Math.max(60, b.maxZ - b.minZ),
      ),
      0.005,
      12,
    );
    if (this.mode === '3d') this.camera.scale *= 0.85;
    this.baseScale = this.camera.scale;
    this.fitted = true;
    this.requestDraw();
  }
  setMode(mode: ViewMode) {
    this.mode = mode;
    this.scene = null;
    this.fit();
  }
  screen(point: Point) {
    const c = this.camera,
      x = point.x - c.x,
      z = point.z - c.z;
    if (this.mode === '2d')
      return { x: this.width / 2 + x * c.scale, y: this.height / 2 + z * c.scale + 4, depth: 0 };
    const side = x * Math.cos(c.yaw) - z * Math.sin(c.yaw),
      depth = x * Math.sin(c.yaw) + z * Math.cos(c.yaw);
    return {
      x: this.width / 2 + side * c.scale,
      y:
        this.height / 2 +
        (depth * Math.sin(c.pitch) - (point.y - c.y) * Math.cos(c.pitch)) * c.scale,
      depth: depth * Math.cos(c.pitch) + (point.y - c.y) * Math.sin(c.pitch),
    };
  }
  world(x: number, y: number) {
    return {
      x: (x - this.width / 2) / this.camera.scale + this.camera.x,
      z: (y - this.height / 2 - 4) / this.camera.scale + this.camera.z,
    };
  }
  zoom(factor: number, x = this.width / 2, y = this.height / 2) {
    const before = this.world(x, y);
    this.camera.scale = clamp(this.camera.scale * factor, 0.005, 12);
    if (this.mode === '2d') {
      const after = this.world(x, y);
      this.camera.x += before.x - after.x;
      this.camera.z += before.z - after.z;
    }
    this.requestDraw();
  }
  hitPoint(x: number, y: number) {
    let best = -1,
      threshold = 15;
    this.project.points.forEach((p, i) => {
      const s = this.screen(p),
        d = Math.hypot(s.x - x, s.y - y);
      if (d < threshold) {
        best = i;
        threshold = d;
      }
    });
    return best;
  }
  hitRoad(x: number, y: number) {
    let best = null,
      bestDistance = Math.max(20, this.project.width * this.camera.scale);
    for (let i = 1; i < this.samples.length; i++) {
      const a = this.screen(this.samples[i - 1]),
        b = this.screen(this.samples[i]);
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      const d = Math.hypot(x - a.x - dx * t, y - a.y - dy * t);
      if (d < bestDistance) {
        bestDistance = d;
        const p = this.samples[i - 1],
          q = this.samples[i];
        best = {
          x: p.x + (q.x - p.x) * t,
          y: p.y + (q.y - p.y) * t,
          z: p.z + (q.z - p.z) * t,
          segment: p.segment,
          nx: p.nx,
          nz: p.nz,
        };
      }
    }
    return best;
  }
  /** Control point nearest the click, along with the targeted side. */
  hitRoadPoint(x: number, y: number) {
    const road = this.hitRoad(x, y);
    const count = this.project.points.length;
    if (!road || !count) return null;
    const a = road.segment,
      b = (a + 1) % count;
    const sa = this.screen(this.project.points[a]),
      sb = this.screen(this.project.points[b]);
    const index = Math.hypot(sa.x - x, sa.y - y) <= Math.hypot(sb.x - x, sb.y - y) ? a : b;
    const world = this.world(x, y);
    const side: BarrierSide =
      (world.x - road.x) * road.nx + (world.z - road.z) * road.nz >= 0 ? 'right' : 'left';
    return { index, side };
  }
  /** Barrier segment nearest the click, within the 8 px limit. */
  hitBarrier(x: number, y: number) {
    let best = -1,
      bestDistance = 8;
    (this.project.barriers ?? []).forEach((barrier, index) => {
      const path = barrierPath(this.project, this.samples, barrier);
      for (let i = 1; i < path.length; i++) {
        const a = this.screen(path[i - 1]),
          b = this.screen(path[i]);
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
        const d = Math.hypot(x - a.x - dx * t, y - a.y - dy * t);
        if (d < bestDistance) {
          bestDistance = d;
          best = index;
        }
      }
    });
    return best;
  }
  requestDraw() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.draw();
      this.drawProfile();
      this.onDraw?.();
    });
  }
  trace(points: Point[], close = false) {
    const ctx = this.ctx;
    ctx.beginPath();
    points.forEach((p, i) => {
      const s = this.screen(p);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    if (close) ctx.closePath();
  }
  grid() {
    const ctx = this.ctx;
    const gradient = ctx.createRadialGradient(
      this.width * 0.55,
      this.height * 0.3,
      10,
      this.width * 0.5,
      this.height * 0.5,
      this.width * 0.8,
    );
    gradient.addColorStop(0, '#28392b');
    gradient.addColorStop(1, '#17251f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = '#667e4b12';
    // A faint coordinate grid, anchored in world space.
    const step = this.camera.scale < 0.3 ? 100 : this.camera.scale < 1.5 ? 50 : 10;
    if (this.mode === '2d') {
      const top = this.world(0, 0),
        bottom = this.world(this.width, this.height);
      ctx.beginPath();
      for (let x = Math.floor(top.x / step) * step; x <= bottom.x; x += step) {
        const s = this.screen({ x, z: 0, y: 0 });
        ctx.moveTo(s.x, 0);
        ctx.lineTo(s.x, this.height);
      }
      for (let z = Math.floor(top.z / step) * step; z <= bottom.z; z += step) {
        const s = this.screen({ x: 0, z, y: 0 });
        ctx.moveTo(0, s.y);
        ctx.lineTo(this.width, s.y);
      }
      ctx.stroke();
      ctx.fillStyle = '#a0bc6c22';
      const dotStep = step * 2;
      for (let x = Math.floor(top.x / dotStep) * dotStep; x <= bottom.x; x += dotStep) {
        for (let z = Math.floor(top.z / dotStep) * dotStep; z <= bottom.z; z += dotStep) {
          const p = this.screen({ x, z, y: 0 });
          ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
        }
      }
    } else {
      const b = bounds(this.samples, 120),
        y = b.minY - 6;
      const gridStep = Math.max(50, Math.ceil((b.maxX - b.minX) / 50 / 10) * 10);
      for (let x = Math.floor(b.minX / gridStep) * gridStep; x < b.maxX; x += gridStep) {
        this.trace([
          { x, y, z: b.minZ },
          { x, y, z: b.maxZ },
        ]);
        ctx.stroke();
      }
      for (let z = Math.floor(b.minZ / gridStep) * gridStep; z < b.maxZ; z += gridStep) {
        this.trace([
          { x: b.minX, y, z },
          { x: b.maxX, y, z },
        ]);
        ctx.stroke();
      }
    }
  }
  draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.grid();
    if (!this.project) return;
    if (this.mode === '3d') this.draw3d();
    else this.draw2d();
  }
  draw2d() {
    const ctx = this.ctx,
      p = this.project,
      scale = this.camera.scale;
    if (this.samples.length > 1) {
      const terrain = terrainBounds(p, this.samples);
      const corner = this.screen({ x: terrain.minX, z: terrain.minZ, y: 0 });
      const width = (terrain.maxX - terrain.minX) * scale,
        height = (terrain.maxZ - terrain.minZ) * scale;
      ctx.fillStyle = '#627d3a28';
      ctx.fillRect(corner.x, corner.y, width, height);
      ctx.strokeStyle = '#adc68a80';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 5]);
      ctx.strokeRect(corner.x, corner.y, width, height);
      ctx.setLineDash([]);
      this.trace(this.samples);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#0d191f50';
      ctx.lineWidth = (p.width + p.shoulder * 2 + 5) * scale + 4;
      ctx.stroke();
      ctx.strokeStyle = '#4c623a';
      ctx.lineWidth = (p.width + p.shoulder * 2 + (p.kerbs ? 1.3 : 0)) * scale;
      ctx.stroke();
      if (p.kerbs) {
        ctx.strokeStyle = '#c3c4ac';
        ctx.lineWidth = (p.width + 1.3) * scale;
        ctx.stroke();
        ctx.strokeStyle = '#b35949';
        ctx.setLineDash([5 * scale, 5 * scale]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.strokeStyle = '#89918a';
      ctx.lineWidth = Math.max(p.width * scale, 2);
      ctx.stroke();
      ctx.strokeStyle = '#3e4848';
      ctx.lineWidth = Math.max((p.width - 0.6) * scale, 1.5);
      ctx.stroke();
      ctx.strokeStyle = '#b1c39185';
      ctx.lineWidth = 0.75;
      ctx.setLineDash([3, 7]);
      ctx.stroke();
      ctx.setLineDash([]);
      const length = this.samples.at(-1)!.s;
      for (let s = length / 9; s < length; s += length / 6) {
        const a = sampleAt(this.samples, s)!,
          pos = this.screen(a);
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(Math.atan2(-a.nx, a.nz));
        ctx.strokeStyle = '#d8eab9aa';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-4, -3);
        ctx.lineTo(1, 0);
        ctx.lineTo(-4, 3);
        ctx.stroke();
        ctx.restore();
      }
      this.drawStart();
      this.drawTightTurns();
      this.drawBarriers();
    }
    const affectedPoints = new Set(this.tightTurns.flatMap((turn) => turn.pointIndices));
    p.points.forEach((point, i) => {
      const s = this.screen(point),
        selected = i === this.selected,
        invalid = affectedPoints.has(i);
      if (selected) {
        ctx.fillStyle = '#d3f47d16';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d3f47d66';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(s.x, s.y, selected ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = selected ? '#d3f47d' : '#1b2b22';
      ctx.fill();
      ctx.strokeStyle = invalid ? '#ec8b7f' : i === this.hover ? '#efffdc' : '#c9dda7';
      ctx.lineWidth = selected ? 2 : 1.5;
      ctx.stroke();
      ctx.font = '9px Consolas, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const nx = this.samples.find((s) => s.segment === i)?.nx || 0,
        nz = this.samples.find((s) => s.segment === i)?.nz || -1;
      const offsetX = nx * 18 + 9,
        offsetY = nz * 18 - 7;
      ctx.fillStyle = invalid ? '#ec8b7f' : selected ? '#e4ffa4' : '#a8bc8c';
      ctx.fillText(
        `${String(i + 1).padStart(2, '0')}${invalid ? ' !' : ''}`,
        s.x + offsetX,
        s.y + offsetY,
      );
    });
  }
  drawTightTurns() {
    if (!this.tightTurns.length) return;
    const ctx = this.ctx;
    const segments = new Set(this.tightTurns.map((turn) => turn.segment));
    ctx.save();
    ctx.strokeStyle = '#ec8b7f';
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 4]);
    ctx.beginPath();
    for (let i = 0; i < this.samples.length - 1; i++) {
      if (!segments.has(this.samples[i].segment)) continue;
      const a = this.screen(this.samples[i]),
        b = this.screen(this.samples[i + 1]);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const turn of this.tightTurns) {
      const p = this.screen(this.samples[turn.sampleIndex]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#412a25';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ec8b7f';
      ctx.fillText('!', p.x, p.y);
    }
    ctx.restore();
  }
  drawBarriers() {
    const ctx = this.ctx;
    for (const [index, barrier] of (this.project.barriers ?? []).entries()) {
      const path = barrierPath(this.project, this.samples, barrier);
      if (path.length < 2) continue;
      const style = BARRIER_STYLE[barrier.type];
      this.trace(path);
      if (index === this.selectedBarrier) {
        ctx.strokeStyle = '#d3f47d44';
        ctx.lineWidth = style.width + 5;
        ctx.stroke();
      }
      ctx.strokeStyle = style.color;
      ctx.lineWidth = style.width;
      if (style.dash.length) ctx.setLineDash(style.dash);
      ctx.stroke();
      if (style.dash.length) ctx.setLineDash([]);
    }
    const draft = this.barrierDraft,
      hover = this.barrierHover;
    if (draft && hover && hover.index !== draft.from) {
      const from = this.project.closed ? draft.from : Math.min(draft.from, hover.index);
      const to = this.project.closed ? hover.index : Math.max(draft.from, hover.index);
      const path = barrierPath(this.project, this.samples, {
        type: draft.type,
        side: draft.side,
        from,
        to,
        offset: DEFAULT_BARRIER_OFFSET,
      });
      if (path.length > 1) {
        this.trace(path);
        ctx.strokeStyle = DRAFT_COLOR;
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    const marker = (index: number, color: string) => {
      const point = this.project.points[index];
      if (!point) return;
      const s = this.screen(point);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 10, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };
    if (hover) marker(hover.index, '#d3f47d88');
    if (draft) marker(draft.from, DRAFT_COLOR);
  }
  drawStart() {
    const ctx = this.ctx,
      start = sampleAt(this.samples, Math.min(28, this.samples.at(-1)!.s * 0.25))!;
    const p = this.screen(start),
      half = (this.project.width * this.camera.scale) / 2;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(-start.nx, start.nz));
    const block = Math.max(2.5, half / 4);
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#202923' : '#e4e9d6';
        ctx.fillRect((j - 1) * block, -half + (i * half) / 4, block, half / 4);
      }
    ctx.restore();
    ctx.font = '8px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#b3c69b';
    ctx.fillText('DÉPART', p.x + 13, p.y + half + 24);
    if (!this.project.closed) {
      const end = this.screen(this.samples.at(-1)!);
      ctx.fillText('ARRIVÉE', end.x + 13, end.y + 21);
    }
  }
  draw3d() {
    if (this.samples.length < 2) return;
    if (!this.scene) this.scene = buildScene(this.project, this.samples);
    const ctx = this.ctx,
      faces = [];
    for (const mesh of this.scene.meshes) {
      // Barrier colliders stay invisible in game: they are not drawn here.
      if (mesh.renderable === false) continue;
      const color = MATERIALS[mesh.material].color;
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const verts = mesh.indices.slice(i, i + 3).map((index) => mesh.vertices[index]);
        const screen = verts.map((v) =>
          this.screen({ x: v.position[0], y: v.position[1], z: v.position[2] }),
        );
        const normal = verts[0].normal;
        const shade = clamp(0.8 + 0.2 * normal[1] + 0.12 * normal[0], 0.55, 1.15);
        faces.push({
          screen,
          depth: screen.reduce((n, p) => n + p.depth, 0) / screen.length,
          color: `rgb(${color.map((c) => Math.round(c * shade)).join(',')})`,
        });
      }
    }
    faces.sort((a, b) => a.depth - b.depth);
    for (const face of faces) {
      ctx.beginPath();
      face.screen.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = face.color;
      ctx.fill();
      ctx.strokeStyle = face.color;
      ctx.lineWidth = 0.35;
      ctx.stroke();
    }
    this.drawTightTurns();
    const start = this.screen(sampleAt(this.samples, 12)!);
    ctx.fillStyle = '#d3f47d';
    ctx.beginPath();
    ctx.arc(start.x, start.y - 8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d3f47d88';
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(start.x, start.y - 8);
    ctx.stroke();
    ctx.font = '8px "Segoe UI", sans-serif';
    ctx.fillText('DÉPART', start.x + 8, start.y - 9);
  }
  drawProfile() {
    const ctx = this.profile,
      w = this.profileWidth,
      h = this.profileHeight;
    if (!w || !h) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#39504355';
    ctx.lineWidth = 0.6;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (i * h) / 4);
      ctx.lineTo(w, (i * h) / 4);
      ctx.stroke();
    }
    if (this.samples.length < 2) return;
    const stats = trackStats(this.samples),
      range = Math.max(10, stats.elevation);
    const xy = (p: Sample) => ({
      x: 4 + (p.s / (stats.length || 1)) * (w - 8),
      y: h - 6 - ((p.y - stats.min + range * 0.08) / (range * 1.2)) * (h - 12),
    });
    ctx.beginPath();
    this.samples.forEach((p, i) => {
      const s = xy(p);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.strokeStyle = '#bddb86';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineTo(w - 4, h);
    ctx.lineTo(4, h);
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, 0, 0, h);
    fill.addColorStop(0, '#a7cb5e40');
    fill.addColorStop(1, '#a7cb5e03');
    ctx.fillStyle = fill;
    ctx.fill();
    if (this.selected >= 0) {
      let sample = this.samples.find((p) => p.segment === this.selected && p.t === 0);
      if (!sample && this.selected === this.project.points.length - 1) sample = this.samples.at(-1);
      if (sample) {
        const p = xy(sample);
        ctx.strokeStyle = '#d3f47d66';
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(p.x, 0);
        ctx.lineTo(p.x, h);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#d3f47d';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
export { TrackRenderer };
