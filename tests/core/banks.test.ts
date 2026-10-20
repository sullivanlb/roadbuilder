import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import {
  addBankZone,
  addBarrier,
  addWidthZone,
  bankZoneRejection,
  opposite,
  reverseTrack,
  setClosed,
  updateBankZone,
} from '../../src/core/project/edits';
import type { ProjectError } from '../../src/core/project/errors';
import { parseProject } from '../../src/core/project/schema';
import type { Project, Side } from '../../src/core/project/schema';
import { startLine } from '../../src/core/scene/road';
import { buildScene, findFoldedSurface } from '../../src/core/scene/scene';
import { bankZoneRanges, outsideOf } from '../../src/core/track/bank';
import { sampleAt, sampleTrack, trackLength } from '../../src/core/track/centerline';
import type { Sample } from '../../src/core/track/centerline';
import { trackCorners } from '../../src/core/track/corners';
import { trackIssues } from '../../src/core/track/issues';
import { pointDistance, positionAt } from '../../src/core/track/positions';
import { rangeSamples } from '../../src/core/track/ranges';
import { pickInLayer } from '../../src/editor/layers';
import { asJson, onPoint, template } from '../helpers';

/** A project with one bank zone laid between two track distances. */
function withBank(project: Project, from: number, to: number, angle: number, high: Side): Project {
  const samples = sampleTrack(project);
  return produce(project, (draft) => {
    addBankZone(draft, {
      from: positionAt(project, samples, from),
      to: positionAt(project, samples, to),
      angle,
      high,
    });
  });
}

const tan = (degrees: number) => Math.tan((degrees * Math.PI) / 180);

/** The sample of the centerline closest to track distance `s`: vertices sit exactly on it. */
const sampleNear = (samples: readonly Sample[], s: number) =>
  samples.reduce((best, sample) => (Math.abs(sample.s - s) < Math.abs(best.s - s) ? sample : best));

/**
 * The vertices of some meshes on the cross-section through a sample, as their
 * lateral offset to the right and their height above the centerline.
 */
function crossSection(project: Project, prefix: string, at: Sample): [number, number][] {
  const found: [number, number][] = [];
  for (const mesh of buildScene(project).meshes.filter((m) => m.name.startsWith(prefix)))
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const dx = mesh.positions[i] - at.x,
        dz = mesh.positions[i + 2] - at.z;
      if (Math.abs(dx * at.nz - dz * at.nx) > 0.01 || Math.hypot(dx, dz) > 40) continue;
      found.push([dx * at.nx + dz * at.nz, mesh.positions[i + 1] - at.y]);
    }
  return found;
}

const failure = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return (error as ProjectError).detail.code;
  }
  throw new Error('expected a ProjectError');
};

describe('bank zone model', () => {
  it('accepts older files without bank zones and checks their references', () => {
    const file = asJson(template('club'));
    delete file.bankZones;
    expect(parseProject(file).bankZones).toEqual([]);
    const banked = asJson(withBank(template('club'), 100, 300, 10, 'right'));
    expect(parseProject(banked).bankZones).toHaveLength(1);
    // Saved before the transition could be set: it takes the default.
    delete (banked.bankZones as { transition?: number }[])[0].transition;
    expect(parseProject(banked).bankZones[0].transition).toBe(60);
    (banked.bankZones as { angle: number }[])[0].angle = 60;
    expect(failure(() => parseProject(banked))).toBe('invalid-value');
    (banked.bankZones as { angle: number; to: { point: string } }[])[0].angle = 10;
    (banked.bankZones as { to: { point: string } }[])[0].to.point = 'missing';
    expect(failure(() => parseProject(banked))).toBe('position-point');
  });

  it('refuses a zone over another, and warns when moved ends make two overlap', () => {
    const one = withBank(template('club'), 100, 300, 10, 'right');
    const samples = sampleTrack(one);
    expect(bankZoneRejection(one, samples, { start: 250, length: 100 })).toBe('overlap');
    expect(bankZoneRejection(one, samples, { start: 310, length: 3 })).toBe('too-short');
    expect(bankZoneRejection(one, samples, { start: 310, length: 100 })).toBeNull();
    const both = withBank(one, 250, 400, 5, 'left');
    const issues = trackIssues(both, sampleTrack(both));
    expect(issues.errors).toEqual([]);
    expect(issues.warnings).toEqual([{ code: 'bank-zones-overlap' }]);
  });
});

describe('bank profile', () => {
  it('stays flat outside zones and eases into the bank at both ends', () => {
    const project = withBank(template('club'), 100, 300, 10, 'right');
    const samples = sampleTrack(project);
    const at = (s: number) => sampleAt(samples, s)!.bank;
    expect(at(50)).toBe(0);
    expect(at(200)).toBeCloseTo(tan(10), 6);
    expect(at(130)).toBeCloseTo(tan(10) / 2, 2);
    expect(at(350)).toBe(0);
    for (let i = 1; i < samples.length; i++)
      expect(Math.abs(samples[i].bank - samples[i - 1].bank)).toBeLessThan(0.03);
    // A left raised edge tilts the other way.
    const left = sampleTrack(withBank(template('club'), 100, 300, 10, 'left'));
    expect(sampleAt(left, 200)!.bank).toBeCloseTo(-tan(10), 6);
  });

  it('tilts over the transition set on the zone, shortened to half a short zone', () => {
    const base = withBank(template('club'), 100, 300, 10, 'right');
    const short = produce(base, (draft) =>
      updateBankZone(draft, draft.bankZones[0].id, { transition: 20 }),
    );
    const samples = sampleTrack(short);
    expect(sampleAt(samples, 110)!.bank).toBeCloseTo(tan(10) / 2, 2);
    expect(sampleAt(samples, 150)!.bank).toBeCloseTo(tan(10), 6);
    const long = produce(base, (draft) =>
      updateBankZone(draft, draft.bankZones[0].id, { transition: 200 }),
    );
    const eased = sampleTrack(long);
    expect(sampleAt(eased, 200)!.bank).toBeCloseTo(tan(10), 3);
    expect(sampleAt(eased, 150)!.bank).toBeCloseTo(tan(10) / 2, 2);
    expect(long.bankZones[0].transition).toBe(200);
    expect(
      produce(base, (draft) => updateBankZone(draft, draft.bankZones[0].id, { transition: 500 }))
        .bankZones[0].transition,
    ).toBe(200);
  });

  it('raises the outside of a corner by default', () => {
    const project = template('club');
    const samples = sampleTrack(project);
    for (const corner of trackCorners(project, samples))
      expect(outsideOf(rangeSamples(samples, corner))).toBe(opposite(corner.direction));
  });
});

describe('bank geometry', () => {
  it('builds exactly the same scene without bank zones', () => {
    const project = template('club');
    const flat = produce(project, (draft) => {
      draft.bankZones = [];
    });
    expect(buildScene(flat)).toEqual(buildScene(project));
  });

  it('tilts the roadway and kerbs, and keeps the ground flat beyond the kerbs', () => {
    const project = withBank(template('club'), 100, 300, 10, 'right');
    const at = sampleNear(sampleTrack(project), 200);
    expect(at.bank).toBeCloseTo(tan(10), 6);
    const road = crossSection(project, '1ROAD', at);
    expect(road.length).toBeGreaterThan(0);
    // Pivoting about the low left edge: it keeps the altitude, the right edge climbs.
    const lift = (lateral: number) => (lateral + at.edge) * at.bank;
    for (const [lateral, height] of road) expect(height).toBeCloseTo(lift(lateral), 4);
    // The right edge is higher than the centerline by the edge times the slope, the left lower.
    const kerbs = crossSection(project, '1KERB', at);
    const outer = Math.max(...kerbs.map(([lateral]) => lateral));
    expect(outer).toBeCloseTo(at.edge, 4);
    for (const [lateral, height] of kerbs) expect(height).toBeCloseTo(lift(lateral) + 0.025, 4);
    const shoulders = crossSection(project, '1GRASS_verge', at);
    expect(shoulders.length).toBeGreaterThan(0);
    for (const [lateral, height] of shoulders)
      expect(height).toBeCloseTo(lift(Math.sign(lateral) * at.edge) - 0.04, 4);
    // Nothing sinks below the track altitude.
    expect(Math.min(...[...road, ...shoulders].map(([, height]) => height))).toBeGreaterThan(-0.05);
  });

  it('stands barriers on the edge height of a banked roadway', () => {
    const base = withBank(template('club'), 100, 300, 15, 'right');
    const samples = sampleTrack(base);
    const project = produce(base, (draft) => {
      addBarrier(draft, {
        type: 'guardrail',
        side: 'right',
        from: positionAt(base, samples, 150),
        to: positionAt(base, samples, 250),
      });
    });
    const at = sampleNear(samples, 200);
    const lift = 2 * at.edge * at.bank;
    const wall = crossSection(project, '1WALL', at);
    expect(wall.length).toBeGreaterThan(0);
    expect(Math.min(...wall.map(([, height]) => height))).toBeCloseTo(lift - 0.4, 4);
  });

  it('tilts the starting grid with the bank', () => {
    const base = template('club');
    const line = startLine(base, sampleTrack(base)).s;
    const project = withBank(base, line - 200, line + 100, 20, 'right');
    const grid = buildScene(project).markers.find((marker) => marker.name === 'AC_START_0')!;
    const right = grid.transform.slice(0, 3),
      up = grid.transform.slice(4, 7);
    expect(Math.hypot(...right)).toBeCloseTo(1, 6);
    expect(Math.hypot(...up)).toBeCloseTo(1, 6);
    expect(right.reduce((sum, c, k) => sum + c * up[k], 0)).toBeCloseTo(0, 6);
    // Raised on the right: the right axis climbs at the bank angle.
    expect(right[1]).toBeCloseTo(Math.sin((20 * Math.PI) / 180), 2);
  });

  it('keeps the steepest bank driveable: surfaces face up and never fold', () => {
    const base = template('club');
    const project = produce(base, (draft) => {
      addBankZone(draft, {
        from: onPoint(base.points[0]),
        to: onPoint(base.points.at(-1)!),
        angle: 35,
        high: 'right',
      });
    });
    expect(bankZoneRanges(project, sampleTrack(project))).toHaveLength(1);
    const scene = buildScene(project);
    expect(findFoldedSurface(scene)).toBeUndefined();
    for (const mesh of scene.meshes.filter((m) => m.kind === 'surface'))
      for (let i = 1; i < mesh.normals.length; i += 3)
        expect(mesh.normals[i]).toBeGreaterThan(Math.cos((36 * Math.PI) / 180));
  });
});

describe('bank zone edits', () => {
  it('keeps the same ground raised when the track is reversed', () => {
    const project = withBank(template('club'), 100, 300, 10, 'right');
    const samples = sampleTrack(project);
    const length = trackLength(samples);
    const reversed = produce(project, reverseTrack);
    expect(reversed.bankZones[0].high).toBe('left');
    const after = sampleTrack(reversed);
    for (const s of [120, 200, 280])
      expect(sampleAt(after, length - s)!.bank).toBeCloseTo(-sampleAt(samples, s)!.bank, 3);
  });

  it('splits a zone running through the start when the circuit is opened', () => {
    const circuit = template('club');
    // From 50 m before the last control point, over the closing segment, to 80 m after the start.
    const lastPoint = pointDistance(sampleTrack(circuit), circuit.points.length - 1);
    const project = withBank(circuit, lastPoint - 50, 80, 8, 'left');
    const road = produce(project, (draft) => setClosed(draft, false));
    expect(road.bankZones).toHaveLength(2);
    expect(() => parseProject(asJson(road))).not.toThrow();
    expect(road.bankZones.every((zone) => zone.high === 'left' && zone.angle === 8)).toBe(true);
  });
});

describe('road layer picking', () => {
  it('keeps to the kind selected, and takes the other one on a second click', () => {
    const base = withBank(template('club'), 100, 300, 10, 'right');
    const samples = sampleTrack(base);
    const project = produce(base, (draft) => {
      addWidthZone(draft, {
        from: positionAt(base, samples, 150),
        to: positionAt(base, samples, 250),
      });
    });
    const width = project.widthZones[0].id,
      bank = project.bankZones[0].id;
    const hit = { road: { s: 200, side: 'right' as const }, pointId: null, barrierId: null };
    const pick = (current: Parameters<typeof pickInLayer>[4]) =>
      pickInLayer('road', hit, project, samples, current);
    expect(pick(null)).toEqual({ kind: 'widthZone', id: width });
    expect(pick({ kind: 'widthZone', id: width })).toEqual({ kind: 'bankZone', id: bank });
    expect(pick({ kind: 'bankZone', id: bank })).toEqual({ kind: 'widthZone', id: width });
    // Only the bank zone there.
    const alone = { ...hit, road: { s: 120, side: 'left' as const } };
    expect(pickInLayer('road', alone, project, samples, { kind: 'bankZone', id: bank })).toEqual({
      kind: 'bankZone',
      id: bank,
    });
  });
});
