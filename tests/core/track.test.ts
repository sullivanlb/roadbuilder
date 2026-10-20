import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { bounds } from '../../src/core/math';
import { addBarrier, setRoad } from '../../src/core/project/edits';
import { sampleAt, sampleTrack, trackStats } from '../../src/core/track/centerline';
import { trackIssues } from '../../src/core/track/issues';
import { positionRange, rangeSamples } from '../../src/core/track/ranges';
import { barrierSamples } from '../../src/core/scene/barriers';
import { onPoint, template, tightTurnProject } from '../helpers';

describe('centerline', () => {
  it.each(['club', 'kart', 'mountain'] as const)('keeps the %s template stable', (name) => {
    const project = template(name);
    const samples = sampleTrack(project);
    expect({ samples: samples.length, stats: trackStats(samples) }).toMatchSnapshot();
    expect(trackIssues(project, samples).errors).toEqual([]);
  });

  it('closes circuits and ends roads exactly on their last point', () => {
    const closed = sampleTrack(template('club'));
    expect([closed.at(-1)!.x, closed.at(-1)!.z]).toEqual([closed[0].x, closed[0].z]);
    const road = template('mountain');
    const open = sampleTrack(road);
    const last = road.points.at(-1)!;
    expect([open.at(-1)!.x, open.at(-1)!.y, open.at(-1)!.z]).toEqual([last.x, last.y, last.z]);
    // Heights never overshoot the control points.
    expect(bounds(open).minY).toBeGreaterThanOrEqual(0);
    expect(bounds(open).maxY).toBeLessThanOrEqual(145);
  });

  it('handles an empty track', () => {
    expect(sampleTrack(template('blank'))).toEqual([]);
    expect(sampleAt([], 5)).toBeNull();
  });
});

describe('track issues', () => {
  it('detects crossings and points too close together', () => {
    const crossing = produce(template('blank'), (draft) => {
      draft.points = [
        { id: 'a', x: -100, y: 0, z: -100 },
        { id: 'b', x: 100, y: 0, z: 100 },
        { id: 'c', x: -100, y: 0, z: 100 },
        { id: 'd', x: 100, y: 0, z: -100 },
      ];
    });
    expect(trackIssues(crossing).errors.map((issue) => issue.code)).toContain('track-crossing');
    const close = produce(crossing, (draft) => {
      draft.points[1] = { ...draft.points[0], id: 'b' };
    });
    expect(trackIssues(close).errors.map((issue) => issue.code)).toContain('points-too-close');
  });

  it('locates each tight bend between two control points, even mid-segment', () => {
    const project = tightTurnProject();
    const samples = sampleTrack(project);
    const issues = trackIssues(project, samples);
    expect(issues.tightTurns.map((turn) => turn.pointIds)).toEqual([
      ['p3', 'p4'],
      ['p4', 'p5'],
    ]);
    expect(issues.errors).toEqual(issues.tightTurns.map((turn) => turn.issue));
    expect(issues.errors[0]).toEqual({ code: 'tight-turn', from: 2, to: 3 });
    const tightest = samples[issues.tightTurns[0].sampleIndex];
    expect(tightest.t).toBeGreaterThan(0);
    expect(tightest.t).toBeLessThan(1);
  });

  it('includes the closing segment of a circuit, never invented on a road', () => {
    const circuit = produce(tightTurnProject(), (draft) => {
      draft.road.closed = true;
    });
    const closing = trackIssues(circuit).tightTurns.find((turn) => turn.segment === 6)!;
    expect(closing.pointIds).toEqual(['p7', 'p1']);
    expect(closing.issue).toEqual({ code: 'tight-turn', from: 6, to: 0 });
    expect(
      trackIssues(tightTurnProject()).tightTurns.some((turn) => turn.pointIds.includes('p1')),
    ).toBe(false);
  });

  it('clears once the road is narrow enough', () => {
    const narrow = produce(tightTurnProject(), (draft) => setRoad(draft, { width: 4 }));
    expect(trackIssues(narrow).tightTurns).toEqual([]);
  });

  it('asks for enough points', () => {
    expect(trackIssues(template('blank')).errors).toEqual([
      { code: 'points-minimum', min: 2, closed: false },
    ]);
  });
});

describe('ranges', () => {
  it('follow the track direction and run through the start of a circuit', () => {
    const project = template('club');
    const samples = sampleTrack(project);
    const at = (index: number) => onPoint(project.points[index]);
    const range = positionRange(project, samples, at(7), at(2))!;
    const path = rangeSamples(samples, range);
    expect([path[0].x, path[0].z]).toEqual([project.points[7].x, project.points[7].z]);
    expect([path.at(-1)!.x, path.at(-1)!.z]).toEqual([project.points[2].x, project.points[2].z]);
    expect(new Set(path.map((sample) => sample.segment))).toEqual(new Set([7, 8, 0, 1, 2]));
    // Ends between samples are interpolated exactly where they are.
    const between = rangeSamples(samples, { start: 100.5, length: 30 });
    expect(between[0].s).toBeCloseTo(100.5, 6);
    expect(between.at(-1)!.s).toBeCloseTo(130.5, 6);
  });

  it('end on the last point of a road', () => {
    const project = produce(template('mountain'), (draft) => {
      addBarrier(draft, {
        type: 'wall',
        side: 'left',
        from: onPoint(draft.points[7]),
        to: onPoint(draft.points[9]),
      });
    });
    const path = barrierSamples(project, sampleTrack(project), project.barriers[0]);
    const last = project.points[9];
    expect([path.at(-1)!.x, path.at(-1)!.z]).toEqual([last.x, last.z]);
  });

  it('are unknown when an end point is gone', () => {
    const project = template();
    const missing = { point: 'nope', distance: 0 };
    expect(positionRange(project, sampleTrack(project), missing, onPoint(project.points[1]))).toBe(
      null,
    );
  });
});
