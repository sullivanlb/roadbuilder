import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { setClosed } from '../../src/core/project/edits';
import { sampleTrack, trackLength } from '../../src/core/track/centerline';
import { trackCorners } from '../../src/core/track/corners';
import { rangeContains } from '../../src/core/track/ranges';
import { template } from '../helpers';

describe('corners', () => {
  it.each(['club', 'kart', 'mountain'] as const)('are found along the %s template', (name) => {
    const project = template(name);
    const corners = trackCorners(project, sampleTrack(project));
    expect(
      corners.map(({ number, direction, start, length, angle }) => [
        number,
        direction,
        Math.round(start),
        Math.round(length),
        Math.round(angle),
      ]),
    ).toMatchSnapshot();
  });

  it('are numbered in track direction, apex inside, none on a straight line', () => {
    const project = template('club');
    const samples = sampleTrack(project);
    const corners = trackCorners(project, samples);
    corners.forEach((corner, i) => {
      expect(corner.number).toBe(i + 1);
      if (i) expect(corner.start).toBeGreaterThan(corners[i - 1].start);
      expect(rangeContains(corner, trackLength(samples), corner.apex)).toBe(true);
    });
    const straight = produce(template('blank'), (draft) => {
      draft.points.push({ id: 'a', x: 0, y: 0, z: 0 }, { id: 'b', x: 400, y: 0, z: 0 });
      setClosed(draft, false);
    });
    expect(trackCorners(straight, sampleTrack(straight))).toEqual([]);
  });
});
