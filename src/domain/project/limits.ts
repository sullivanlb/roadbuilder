/** Hard bounds enforced by the project validation. */
export const LIMITS = {
  points: 160,
  coordinate: 10000,
  minAltitude: -100,
  maxAltitude: 1000,
  barriers: 120,
};

/** Terrain margin applied when a project does not define one. */
export const DEFAULT_TERRAIN_MARGIN = 150;
