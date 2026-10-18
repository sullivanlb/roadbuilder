import type {
  BarrierDraft,
  Bounds,
  PlanPoint,
  Point,
  Project,
  Sample,
  Scene,
  TightTurn,
  ViewMode,
} from '../domain/types';
import { clamp } from '../domain/math';
import { createProject } from '../domain/project/factory';
import { bounds } from '../domain/track/geometry';
import { terrainBounds } from '../domain/track/terrain';
import { draw2d } from './draw2d';
import { draw3d } from './draw3d';
import { drawGrid } from './grid';
import { findBarrier, findPoint, findRoad, findRoadPoint } from './hitTest';
import { drawProfile } from './profile';
import type { BarrierHover, Camera, ScreenPoint, View } from './view';

class TrackRenderer implements View {
  canvas: HTMLCanvasElement;
  elevation: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  profile: CanvasRenderingContext2D;
  mode: ViewMode;
  selected: number;
  hover: number;
  camera: Camera;
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
  barrierHover: BarrierHover | null = null;
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
  screen(point: Point): ScreenPoint {
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
  world(x: number, y: number): PlanPoint {
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
  /** Control point nearest the click, or -1. */
  hitPoint(x: number, y: number) {
    return findPoint(this, x, y);
  }
  /** Roadway position nearest the click, or null. */
  hitRoad(x: number, y: number) {
    return findRoad(this, x, y);
  }
  /** Control point nearest the click, along with the targeted side. */
  hitRoadPoint(x: number, y: number) {
    return findRoadPoint(this, x, y);
  }
  /** Barrier span nearest the click, or -1. */
  hitBarrier(x: number, y: number) {
    return findBarrier(this, x, y);
  }
  requestDraw() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.draw();
      drawProfile(this);
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
  draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawGrid(this);
    if (!this.project) return;
    if (this.mode === '3d') draw3d(this);
    else draw2d(this);
  }
}
export { TrackRenderer };
