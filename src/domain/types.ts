export interface Point {
  x: number;
  y: number;
  z: number;
}
export type PlanPoint = Pick<Point, 'x' | 'z'>;
export type Template = 'club' | 'kart' | 'mountain' | 'blank';
export type Tool = 'select' | 'add' | 'pan';
export type ViewMode = '2d' | '3d';
export type ExportFormat = 'ac' | 'obj';
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
