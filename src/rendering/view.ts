import type {
  BarrierDraft,
  BarrierSide,
  PlanPoint,
  Point,
  Project,
  Sample,
  Scene,
  ViewMode,
} from '../domain/types';
import type { TightTurn } from '../domain/diagnostics';

/** Plan or orbit camera shared by the drawing passes. */
export interface Camera {
  x: number;
  y: number;
  z: number;
  scale: number;
  yaw: number;
  pitch: number;
}

/** Projected position of a world point, with its depth in 3D mode. */
export interface ScreenPoint {
  x: number;
  y: number;
  depth: number;
}

/** Barrier pointed at by the mouse while drawing. */
export interface BarrierHover {
  index: number;
  side: BarrierSide;
}

/**
 * Everything the drawing passes and the hit tests need from the renderer.
 * TrackRenderer implements it; the passes only read this surface.
 */
export interface View {
  ctx: CanvasRenderingContext2D;
  profile: CanvasRenderingContext2D;
  width: number;
  height: number;
  profileWidth: number;
  profileHeight: number;
  dpr: number;
  mode: ViewMode;
  project: Project;
  samples: Sample[];
  scene: Scene | null;
  camera: Camera;
  selected: number;
  hover: number;
  tightTurns: TightTurn[];
  selectedBarrier: number;
  barrierDraft: BarrierDraft | null;
  barrierHover: BarrierHover | null;
  screen(point: Point): ScreenPoint;
  world(x: number, y: number): PlanPoint;
  trace(points: Point[], close?: boolean): void;
}
