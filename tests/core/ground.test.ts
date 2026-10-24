import { describe, expect, it } from 'vitest';
import type { Template } from '../../src/core/project/templates';
import { groundHeight } from '../../src/core/scene/ground';
import { bankLift } from '../../src/core/scene/mesh';
import { buildScene } from '../../src/core/scene/scene';
import { sampleTrack } from '../../src/core/track/centerline';
import { LAYOUT } from '../../src/core/track/layout';
import { pitLaneLayout, sideEdge } from '../../src/core/track/pitLane';
import { template } from '../helpers';

const TEMPLATES: Template[] = ['club', 'mountain'];

describe('ground beside the track', () => {
  it.each(TEMPLATES)('carries the shoulders on flat before easing away (%s)', (name) => {
    const project = template(name);
    const samples = sampleTrack(project);
    const lane = pitLaneLayout(project, samples);
    const terrain = buildScene(project, samples).meshes.filter((m) => m.kind === 'terrain');
    let checked = 0;
    for (const sample of samples.filter((_, i) => i % 4 === 0))
      for (const mesh of terrain)
        for (let i = 0; i < mesh.positions.length; i += 3) {
          const dx = mesh.positions[i] - sample.x,
            dz = mesh.positions[i + 2] - sample.z;
          // Terrain vertices on the cross-section through the sample, just beyond the shoulders.
          if (Math.abs(dx * sample.nz - dz * sample.nx) > 0.3) continue;
          const lateral = dx * sample.nx + dz * sample.nz;
          const side = lateral < 0 ? 'left' : 'right';
          const outer = sideEdge(project, lane, sample, side) + project.road.shoulder;
          const beyond = Math.abs(lateral) - outer;
          if (beyond < 0.5 || beyond > LAYOUT.terrain.flat) continue;
          const edge = sample.y + bankLift(sample, lateral) - 0.04;
          expect(Math.abs(mesh.positions[i + 1] - edge)).toBeLessThan(0.1);
          checked++;
        }
    expect(checked).toBeGreaterThan(5);
  });

  it('slopes between two passes of the track without a step', () => {
    const project = template('mountain');
    const samples = sampleTrack(project);
    const height = groundHeight(project, samples);
    const xs = samples.map((s) => s.x),
      zs = samples.map((s) => s.z);
    const [minX, maxX, minZ, maxZ] = [
      Math.min(...xs),
      Math.max(...xs),
      Math.min(...zs),
      Math.max(...zs),
    ];
    // Lines across the whole area, a quarter metre at a time.
    for (const t of [0.25, 0.5, 0.75]) {
      const z = minZ + (maxZ - minZ) * t;
      let previous = height({ x: minX, z });
      for (let x = minX + 0.25; x <= maxX; x += 0.25) {
        const current = height({ x, z });
        expect(Math.abs(current - previous)).toBeLessThan(0.4);
        previous = current;
      }
    }
  });
});
