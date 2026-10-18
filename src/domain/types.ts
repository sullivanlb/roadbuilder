export interface Point {
  x: number;
  y: number;
  z: number;
}
export type PlanPoint = Pick<Point, 'x' | 'z'>;
export type Template = 'club' | 'kart' | 'mountain' | 'blank';
export type Tool = 'select' | 'add' | 'barrier' | 'pan';
export type ViewMode = '2d' | '3d';
export type ExportFormat = 'ac' | 'obj';
export type BarrierType = 'guardrail' | 'tires' | 'tecpro' | 'wall';
export type BarrierSide = 'left' | 'right';
export interface Barrier {
  type: BarrierType;
  side: BarrierSide;
  from: number;
  to: number;
  offset: number;
}
/** Span being drawn: start point, side and type chosen. */
export interface BarrierDraft {
  from: number;
  side: BarrierSide;
  type: BarrierType;
}
export interface Project {
  format: 'assetto-roadbuilder';
  version: 1;
  name: string;
  author: string;
  closed: boolean;
  width: number;
  shoulder: number;
  kerbs: boolean;
  terrainMargin: number;
  barriers?: Barrier[];
  points: Point[];
}
export interface Sample extends Point {
  segment: number;
  t: number;
  s: number;
  nx: number;
  nz: number;
  grade: number;
  curvature: number;
}
/** A failing portion of the interpolated curve, with zero-based control-point indices. */
export interface TightTurn {
  segment: number;
  pointIndices: [number, number];
  sampleIndex: number;
  radius: number;
  message: string;
}
export interface TrackIssues {
  errors: string[];
  warnings: string[];
  tightTurns: TightTurn[];
}
export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}
export interface Vertex {
  position: number[];
  normal: number[];
  uv: number[];
  tangent: number[];
}
export interface Mesh {
  name: string;
  material: number;
  vertices: Vertex[];
  indices: number[];
  terrain?: boolean;
  /** Barrier mesh: vertical faces, excluded from the fold-back check. */
  barrier?: boolean;
  /** false in the KN5: collision kept, nothing is drawn in game. */
  renderable?: boolean;
}
export interface Marker {
  name: string;
  transform: number[];
}
export interface Scene {
  meshes: Mesh[];
  markers: Marker[];
  samples: Sample[];
  terrainBounds?: Bounds;
}
export type ExportFiles = Record<string, string | Uint8Array>;
