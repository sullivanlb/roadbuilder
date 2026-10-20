import { isCircuit } from '../project/schema';
import type { Project } from '../project/schema';
import { sampleAt, trackLength } from '../track/centerline';
import type { Sample } from '../track/centerline';
import { LAYOUT, roadEdge } from '../track/layout';
import { pitLaneLayout } from '../track/pitLane';
import { wrapDistance } from '../track/positions';
import { offsetPoint } from './mesh';
import { startLine, startPosition } from './road';

/** A named position and orientation read by the game: start places, pit boxes, timing gates. */
export interface Marker {
  name: string;
  /** Column-major 4×4 transform, translation in the last four values. */
  transform: number[];
}

/** A place beside the centerline: a sample and a signed lateral offset. */
export interface Place {
  sample: Sample;
  lateral: number;
}

const placeAt = (project: Project, samples: readonly Sample[], s: number) =>
  sampleAt(samples, wrapDistance(project, samples, s))!;

/** The starting grid of a circuit: staggered behind the start line, pole position on the right. */
export function gridPlaces(project: Project, samples: readonly Sample[]): Place[] {
  if (!isCircuit(project) || samples.length < 2) return [];
  const line = startLine(project, samples);
  return Array.from({ length: project.cars }, (_, i) => {
    const sample = placeAt(project, samples, line.s - LAYOUT.grid.front - i * LAYOUT.grid.spacing);
    // Halfway between the centerline and the roadway edge.
    return { sample, lateral: ((i % 2 ? -1 : 1) * sample.half) / 2 };
  });
}

/** One pit box per car along the parallel part of the pit lane, in the middle of the lane. */
export function pitBoxPlaces(project: Project, samples: readonly Sample[]): Place[] {
  const lane = pitLaneLayout(project, samples);
  if (!lane) return [];
  return Array.from({ length: project.cars }, (_, i) => {
    const sample = placeAt(
      project,
      samples,
      lane.parallel[0] + LAYOUT.pitLane.boxSpacing * (i + 0.5),
    );
    return { sample, lateral: lane.sign * (lane.profile(sample.s)?.center ?? 0) };
  });
}

/**
 * Places the starting grid (or the single start position of a road), the pit
 * boxes and three timing gates along the track.
 */
export function buildMarkers(project: Project, samples: readonly Sample[]): Marker[] {
  const length = trackLength(samples),
    circuit = isCircuit(project);
  const markers: Marker[] = [];
  const at = (s: number) => placeAt(project, samples, s);
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

  const line = startLine(project, samples);
  const spawn = startPosition(project, samples);
  marker('AC_HOTLAP_START_0', spawn, 0, 0.25);
  if (circuit)
    gridPlaces(project, samples).forEach((place, i) =>
      marker(`AC_START_${i}`, place.sample, place.lateral, 0.25),
    );
  else marker('AC_START_0', spawn, 0, 0.25);

  const boxes = pitBoxPlaces(project, samples);
  if (boxes.length)
    boxes.forEach((place, i) => marker(`AC_PIT_${i}`, place.sample, place.lateral, 0.3));
  else marker('AC_PIT_0', spawn, -(roadEdge(project.road, spawn) + LAYOUT.spawnPad.depth / 2), 0.3);

  const gate = (index: number, p: Sample) => {
    marker(`AC_TIME_${index}_L`, p, -p.half - 1);
    marker(`AC_TIME_${index}_R`, p, p.half + 1);
  };
  gate(0, line);
  if (circuit) {
    gate(1, at(line.s + length / 3));
    gate(2, at(line.s + (2 * length) / 3));
  } else {
    gate(1, at(length / 2));
    gate(2, at(length - LAYOUT.finishBeforeEnd));
  }
  return markers;
}
