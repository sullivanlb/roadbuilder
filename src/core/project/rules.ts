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
  bankZones: { max: 40 },
  scenery: { max: 400 },
  /** Shortest width zone, bank zone or barrier accepted, along the track. */
  rangeLength: 5,
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
  /** Bank angle of the roadway across the track, in degrees. */
  bankAngle: { min: 0, max: 35, step: 0.5 },
  /** Length over which the roadway tilts at each end of a bank zone. */
  bankTransition: { min: 5, max: 200, step: 5 },
  cars: { min: 1, max: 24, step: 1 },
  /** Radius of the arc of a rounded point. */
  radius: { min: 5, max: 2000, step: 1 },
  /** Length of a straight segment, from point to point. */
  segmentLength: { min: 2, max: 5000, step: 1 },
  /** Direction a scenery item faces, in degrees clockwise from north (-Z) on the plan. */
  heading: { min: 0, max: 359, step: 5 },
  /** Footprint and height of a scenery item, in metres; each kind narrows them in SCENERY_SIZES. */
  scenerySize: { min: 0.2, max: 200, step: 0.5 },
  /** Number of trees in a grove. */
  groveCount: { min: 1, max: 40, step: 1 },
} as const satisfies Record<string, NumericRule | { max: number } | number>;

/** Values given to the settings a new project does not choose itself. */
export const DEFAULTS = {
  shoulder: 6,
  terrainMargin: 150,
  barrierOffset: 1,
  pitLaneWidth: 7,
  /** Angle of a new bank zone, in degrees. */
  bankAngle: 8,
  /** Transition of a new bank zone, and of those saved before it could be set. */
  bankTransition: 60,
  /** Distance of the start line after the first control point. */
  startLine: 28,
  /** Radius given to a control point when it is rounded. */
  radius: 30,
} as const;

/** Imported project files larger than this are refused before parsing. */
export const MAX_PROJECT_FILE_BYTES = 1024 * 1024;
