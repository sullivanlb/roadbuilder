/** An editable numeric setting: its accepted range and the increment offered by the interface. */
export interface NumericRule {
  min: number;
  max: number;
  step: number;
}

/**
 * Every bound a project must respect. The schema, the editing operations and the
 * interface controls all read them from here.
 */
export const RULES = {
  name: { max: 80 },
  author: { max: 80 },
  points: { max: 160 },
  barriers: { max: 120 },
  widthZones: { max: 40 },
  /** Shortest width zone accepted, along the track. */
  widthZoneLength: 5,
  /** Two control points closer than this on the ground plane are rejected. */
  pointSpacing: 2,
  coordinate: { min: -10000, max: 10000, step: 1 },
  altitude: { min: -100, max: 1000, step: 0.5 },
  width: { min: 4, max: 24, step: 0.5 },
  shoulder: { min: 2, max: 20, step: 0.5 },
  terrainMargin: { min: 50, max: 500, step: 10 },
  barrierOffset: { min: 0, max: 10, step: 0.5 },
  /** Distance of a track position after its control point. */
  positionDistance: { min: 0, max: 10000, step: 1 },
  pitLaneWidth: { min: 5, max: 12, step: 0.5 },
  cars: { min: 1, max: 24, step: 1 },
} as const satisfies Record<string, NumericRule | { max: number } | number>;

/** Values given to the settings a new project does not choose itself. */
export const DEFAULTS = {
  shoulder: 6,
  terrainMargin: 150,
  barrierOffset: 1,
  pitLaneWidth: 7,
  /** Distance of the start line after the first control point. */
  startLine: 28,
} as const;

/** Imported project files larger than this are refused before parsing. */
export const MAX_PROJECT_FILE_BYTES = 1024 * 1024;
