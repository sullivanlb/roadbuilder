import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { addBarrier } from '../src/core/project/edits';
import { sampleTrack, trackLength } from '../src/core/track/centerline';
import {
  BAND,
  bandBlocks,
  bandHit,
  bandRows,
  bandS,
  bandX,
  nearestPoint,
  rangeSpans,
} from '../src/rendering/band';
import type { BandLabels } from '../src/rendering/band';
import { onPoint, template } from './helpers';

const size = { width: 1000, height: 140 };
const labels: BandLabels = {
  rows: {
    altitude: 'Altitude',
    width: 'Largeur',
    zones: 'Portions',
    left: 'Gauche',
    right: 'Droite',
    lane: 'Voie',
    start: 'Départ',
    empty: '',
  },
  barrier: { guardrail: 'Glissière', tires: 'Pneus', tecpro: 'TecPro', wall: 'Mur' },
  width: (metres) => `${metres} m`,
  lane: 'Voie des stands',
  start: 'Ligne de départ',
  empty: 'Rien',
  distance: (metres) => `${metres} m`,
};

describe('track band', () => {
  it('maps track distances to x and back, within its margins', () => {
    const view = { start: 200, end: 1200 };
    expect(bandX(size, view, 200)).toBe(BAND.left);
    expect(bandX(size, view, 1200)).toBe(size.width - BAND.right);
    expect(bandS(size, view, bandX(size, view, 640))).toBeCloseTo(640, 9);
  });

  it('stacks the rows of each layer inside the band', () => {
    const rows = bandRows('edges', size);
    expect(rows.map((row) => row.id)).toEqual(['left', 'right']);
    expect(rows[0].y).toBe(BAND.top);
    expect(rows[1].y + rows[1].height).toBeCloseTo(size.height - BAND.bottom, 9);
    expect(bandRows('decor', size).map((row) => row.id)).toEqual(['empty']);
  });

  it('splits a range running through the start of a circuit', () => {
    expect(rangeSpans({ start: 100, length: 50 }, 1000)).toEqual([[100, 150]]);
    expect(rangeSpans({ start: 950, length: 100 }, 1000)).toEqual([
      [950, 1000],
      [0, 50],
    ]);
  });

  it('finds the block and the end under the pointer', () => {
    const project = produce(template('club'), (draft) => {
      addBarrier(draft, {
        type: 'tires',
        side: 'left',
        from: onPoint(draft.points[1]),
        to: onPoint(draft.points[3]),
      });
    });
    const samples = sampleTrack(project);
    const total = trackLength(samples);
    const view = { start: 0, end: total };
    const rows = bandRows('edges', size);
    const blocks = bandBlocks(project, samples, 'edges', labels);
    expect(blocks).toHaveLength(1);
    const [block] = blocks;
    const y = rows[0].y + rows[0].height / 2;
    const middle = block.range.start + block.range.length / 2;
    const hit = (s: number, atY = y) =>
      bandHit(size, view, total, rows, blocks, bandX(size, view, s), atY);
    expect(hit(middle)).toMatchObject({ block, edge: null });
    expect(hit(block.range.start)).toMatchObject({ block, edge: 'start' });
    expect(hit(block.range.start + block.range.length)).toMatchObject({ block, edge: 'end' });
    // The right-hand row holds nothing there.
    expect(hit(middle, rows[1].y + 2).block).toBeNull();
    expect(nearestPoint(samples, project.points.length, block.range.start + 1)).toBe(1);
  });

  it('shows the pit lane and the start line on the pits layer', () => {
    const project = template('club');
    const kinds = bandBlocks(project, sampleTrack(project), 'pits', labels).map(
      (block) => block.kind,
    );
    expect(kinds).toEqual(['startLine', 'pitLane']);
  });
});
