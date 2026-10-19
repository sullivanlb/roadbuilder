import { bounds } from '../math';
import type { Bounds } from '../math';
import type { Project, RoadSettings } from '../project/schema';
import type { Sample } from './centerline';

/** Fixed dimensions of the generated track, in metres. */
export const LAYOUT = {
  kerbWidth: 0.65,
  /** Depth of the pit box beside the kerb, on the left of the track. */
  pitDepth: 4.2,
  /** Length of the pit box, centred on the start position. */
  pitLength: 16,
  /** Track distance of the start position, before the start line. */
  startPosition: 12,
  /** Track distance of the start line. */
  startLine: 28,
  /** Distance of the finish line before the end of a road. */
  finishBeforeEnd: 12,
  /** Edge lines painted inside the roadway: inset of their inner and outer edge. */
  edgeLine: { inner: 0.33, outer: 0.18 },
  /** Gap kept between an inner offset and the centre of curvature. */
  curveClearance: 0.8,
} as const;

export const kerbWidth = (road: RoadSettings) => (road.kerbs ? LAYOUT.kerbWidth : 0);

/** Lateral distance from the centerline to the outer edge of the kerbs. */
export const roadEdge = (road: RoadSettings) => road.width / 2 + kerbWidth(road);

/**
 * Limits a lateral offset on the inside of a bend so it stops short of the centre
 * of curvature, where the geometry would fold over itself. `offset` is unsigned;
 * `side` is +1 on the right and -1 on the left.
 */
export function clampToBend(
  road: RoadSettings,
  sample: Pick<Sample, 'curvature'>,
  side: 1 | -1,
  offset: number,
) {
  const curvature = sample.curvature * side;
  if (curvature <= 0) return offset;
  return Math.min(offset, Math.max(roadEdge(road) + 0.05, LAYOUT.curveClearance / curvature));
}

/** Extent of the terrain around the track. */
export function terrainBounds(
  project: Pick<Project, 'road' | 'terrain'>,
  samples: readonly Sample[],
): Bounds {
  return bounds(
    samples,
    roadEdge(project.road) +
      Math.max(project.road.shoulder, LAYOUT.pitDepth) +
      project.terrain.margin,
  );
}
