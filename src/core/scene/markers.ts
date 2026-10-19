import { isCircuit } from '../project/schema';
import type { Project } from '../project/schema';
import { sampleAt, trackLength } from '../track/centerline';
import type { Sample } from '../track/centerline';
import { LAYOUT, roadEdge } from '../track/layout';
import { offsetPoint } from './mesh';
import { startLine, startPosition } from './road';

/** A named position and orientation read by the game: start position, pit box, timing gates. */
export interface Marker {
  name: string;
  /** Column-major 4×4 transform, translation in the last four values. */
  transform: number[];
}

/** Places the start position, the pit box and three timing gates along the track. */
export function buildMarkers(project: Project, samples: readonly Sample[]): Marker[] {
  const half = project.road.width / 2,
    length = trackLength(samples);
  const markers: Marker[] = [];
  const marker = (name: string, p: Sample, lateral = 0, lift = 0) => {
    const [x, y, z] = offsetPoint(p, lateral, lift);
    // Assetto Corsa convention: local Y up, local -Z forward, following the road grade.
    const tangent = [p.nz, p.grade, -p.nx];
    const l = Math.hypot(...tangent),
      forward = tangent.map((v) => v / l);
    const right = [p.nx, 0, p.nz];
    const up = [
      -forward[1] * right[2],
      right[2] * forward[0] - right[0] * forward[2],
      right[0] * forward[1],
    ];
    markers.push({
      name,
      transform: [...right, 0, ...up, 0, ...forward.map((v) => -v), 0, x, y, z, 1],
    });
  };
  const spawn = startPosition(samples);
  marker('AC_START_0', spawn, 0, 0.25);
  marker('AC_HOTLAP_START_0', spawn, 0, 0.25);
  marker('AC_PIT_0', spawn, -(roadEdge(project.road) + LAYOUT.pitDepth / 2), 0.3);
  const gate = (index: number, at: Sample) => {
    marker(`AC_TIME_${index}_L`, at, -half - 1);
    marker(`AC_TIME_${index}_R`, at, half + 1);
  };
  const circuit = isCircuit(project);
  gate(0, startLine(samples));
  gate(1, sampleAt(samples, circuit ? length / 3 : length / 2)!);
  gate(2, sampleAt(samples, circuit ? (2 * length) / 3 : length - LAYOUT.finishBeforeEnd)!);
  return markers;
}
