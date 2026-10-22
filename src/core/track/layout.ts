import { bounds } from '../math';
import type { Bounds } from '../math';
import type { Project, RoadSettings } from '../project/schema';
import { sculptBounds } from '../project/sculpt';
import { hillReach } from '../project/terrain';
import type { Sample } from './centerline';

/** Fixed dimensions of the generated track, in metres. */
export const LAYOUT = {
  kerbWidth: 0.65,
  /** Pad beside the start position, on the left, used as the pit box without a pit lane. */
  spawnPad: { depth: 4.2, length: 16 },
  /** Distance between the start position and the start line. */
  startBehindLine: 16,
  /** Starting grid: gap behind the start line, then between consecutive places. */
  grid: { front: 6, spacing: 8 },
  pitLane: {
    /** Length over which the lane widens at its entry and narrows at its exit. */
    taper: 40,
    /** Strip between the kerb and the lane that holds the pit wall. */
    wallGap: 1.2,
    wall: { thickness: 0.3, height: 1 },
    /** Length of one pit box along the lane. */
    boxSpacing: 10,
  },
  /** Distance of the finish line before the end of a road. */
  finishBeforeEnd: 12,
  /** Edge lines painted inside the roadway: inset of their inner and outer edge. */
  edgeLine: { inner: 0.33, outer: 0.18 },
  /** Gap kept between an inner offset and the centre of curvature. */
  curveClearance: 0.8,
  /** Length over which the roadway changes width at each end of a width zone. */
  widthTaper: 20,
  /** Ground beyond the shoulders: kept flat over `flat`, then eased into the far terrain over `blend`. */
  terrain: { flat: 8, blend: 40 },
  /** Length beyond the flat strip over which a hill rises from nothing to its full height. */
  hillEase: 15,
  /** Length over which an earthwork takes shape at each end. */
  earthworkTaper: 15,
} as const;

export const kerbWidth = (road: RoadSettings) => (road.kerbs ? LAYOUT.kerbWidth : 0);

/** Lateral distance from the centerline to the outer edge of the kerbs, at a sample. */
export const roadEdge = (road: RoadSettings, sample: Pick<Sample, 'half'>) =>
  sample.half + kerbWidth(road);

/** Widest the roadway gets along the track, kerbs excluded. */
export const widestHalf = (road: RoadSettings, samples: readonly Pick<Sample, 'half'>[]) =>
  samples.reduce((widest, sample) => Math.max(widest, sample.half), road.width / 2);

/**
 * Limits a lateral offset on the inside of a bend so it stops short of the centre
 * of curvature, where the geometry would fold over itself. `offset` is unsigned;
 * `side` is +1 on the right and -1 on the left.
 */
export function clampToBend(
  road: RoadSettings,
  sample: Pick<Sample, 'curvature' | 'half'>,
  side: 1 | -1,
  offset: number,
) {
  const curvature = sample.curvature * side;
  if (curvature <= 0) return offset;
  return Math.min(
    offset,
    Math.max(roadEdge(road, sample) + 0.05, LAYOUT.curveClearance / curvature),
  );
}

/** Extent of the terrain around the track, grown to cover every hill and the painted relief. */
export function terrainBounds(
  project: Pick<Project, 'road' | 'terrain' | 'pitLane' | 'hills' | 'sculpt'>,
  samples: readonly Sample[],
): Bounds {
  const pitLane = project.pitLane
    ? LAYOUT.pitLane.wallGap + project.pitLane.width + project.road.shoulder
    : 0;
  const extent = bounds(
    samples,
    widestHalf(project.road, samples) +
      kerbWidth(project.road) +
      Math.max(project.road.shoulder, LAYOUT.spawnPad.depth, pitLane) +
      project.terrain.margin,
  );
  for (const hill of project.hills) {
    const reach = hillReach(hill);
    extent.minX = Math.min(extent.minX, hill.x - reach);
    extent.maxX = Math.max(extent.maxX, hill.x + reach);
    extent.minZ = Math.min(extent.minZ, hill.z - reach);
    extent.maxZ = Math.max(extent.maxZ, hill.z + reach);
  }
  const painted = sculptBounds(project.sculpt);
  if (painted) {
    extent.minX = Math.min(extent.minX, painted.minX);
    extent.maxX = Math.max(extent.maxX, painted.maxX);
    extent.minZ = Math.min(extent.minZ, painted.minZ);
    extent.maxZ = Math.max(extent.maxZ, painted.maxZ);
  }
  return extent;
}
