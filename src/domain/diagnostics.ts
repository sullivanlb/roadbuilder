/** Numeric project fields guarded by an explicit range. */
export type ProjectField =
  'x' | 'y' | 'z' | 'width' | 'shoulder' | 'terrainMargin' | 'barrierOffset';

/** End of a barrier span, used by validation errors. */
export type BarrierEnd = 'from' | 'to';

/** Failure codes for a project payload that cannot be imported. */
export type ProjectErrorDetail =
  | { code: 'project-format' }
  | { code: 'name-length'; min: number; max: number }
  | { code: 'author-length'; max: number }
  | { code: 'track-options' }
  | { code: 'points-limit'; max: number }
  | { code: 'invalid-point' }
  | { code: 'value-range'; field: ProjectField; min: number; max: number }
  | { code: 'barriers-limit'; max: number }
  | { code: 'barriers-min-points' }
  | { code: 'invalid-barrier' }
  | { code: 'barrier-type' }
  | { code: 'barrier-side' }
  | { code: 'barrier-index'; end: BarrierEnd }
  | { code: 'barrier-span' }
  | { code: 'barrier-direction' };

/**
 * Rejection raised when importing a project file. Its message stays a technical
 * code: the interface layer turns `detail` into localised text (see src/i18n).
 */
export class ProjectError extends Error {
  constructor(readonly detail: ProjectErrorDetail) {
    super(detail.code);
    this.name = 'ProjectError';
  }
}

/** Diagnostics raised by the track geometry checker. */
export type TrackIssue =
  | { code: 'points-minimum'; min: number; closed: boolean }
  | { code: 'track-too-short'; min: number }
  | { code: 'points-too-close'; min: number }
  | { code: 'steep-grade'; grade: number }
  | { code: 'tight-turn'; from: number; to: number }
  | { code: 'track-crossing' };

/** A failing portion of the interpolated curve, with zero-based control-point indices. */
export interface TightTurn {
  segment: number;
  pointIndices: [number, number];
  sampleIndex: number;
  radius: number;
  issue: TrackIssue;
}

export interface TrackIssues {
  errors: TrackIssue[];
  warnings: TrackIssue[];
  tightTurns: TightTurn[];
}

/** Failure codes for an archive that cannot be built. */
export type ExportErrorDetail = { code: 'invalid-track' } | { code: 'folded-edge' };

/**
 * Rejection raised when the scene cannot be exported; `issues` carries the
 * geometry diagnostics of an invalid track.
 */
export class ExportError extends Error {
  constructor(
    readonly detail: ExportErrorDetail,
    readonly issues?: TrackIssues,
  ) {
    super(detail.code);
    this.name = 'ExportError';
  }
}
