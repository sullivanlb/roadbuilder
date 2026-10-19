import { bounds } from '../../core/math';
import type { Project } from '../../core/project/schema';
import { barrierPath } from '../../core/scene/barriers';
import type { Sample } from '../../core/track/centerline';
import { encodePng } from '../binary/png';

/** Draws the top-down map (road, barriers, start dot) as a PNG plus its map.ini. */
export function makeMap(project: Project, samples: readonly Sample[], preview = false) {
  const width = 512,
    height = 512,
    pixels = new Uint8Array(width * height * 4);
  if (preview) for (let i = 0; i < pixels.length; i += 4) pixels.set([26, 40, 35, 255], i);
  const bb = bounds(samples, project.road.width + 15);
  const scale = Math.min(
    (width - 60) / Math.max(1, bb.maxX - bb.minX),
    (height - 60) / Math.max(1, bb.maxZ - bb.minZ),
  );
  const xOffset = (width / scale - (bb.maxX + bb.minX)) / 2;
  const zOffset = (height / scale - (bb.maxZ + bb.minZ)) / 2;
  const dot = (x: number, y: number, radius: number, color: number[]) => {
    for (
      let py = Math.max(0, Math.floor(y - radius));
      py <= Math.min(height - 1, Math.ceil(y + radius));
      py++
    ) {
      for (
        let px = Math.max(0, Math.floor(x - radius));
        px <= Math.min(width - 1, Math.ceil(x + radius));
        px++
      ) {
        if ((px - x) ** 2 + (py - y) ** 2 <= radius ** 2) pixels.set(color, (py * width + px) * 4);
      }
    }
  };
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1],
      b = samples[i];
    const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) * scale));
    for (let j = 0; j <= count; j++) {
      const t = j / count;
      dot(
        (a.x + (b.x - a.x) * t + xOffset) * scale,
        (a.z + (b.z - a.z) * t + zOffset) * scale,
        Math.max(2, (project.road.width * scale) / 2),
        preview ? [210, 233, 142, 255] : [255, 255, 255, 255],
      );
    }
  }
  for (const barrier of project.barriers) {
    const path = barrierPath(project, samples, barrier);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1],
        b = path[i];
      const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) * scale));
      for (let j = 0; j <= count; j++) {
        const t = j / count;
        dot(
          (a.x + (b.x - a.x) * t + xOffset) * scale,
          (a.z + (b.z - a.z) * t + zOffset) * scale,
          Math.max(1, (project.road.width * scale) / 8),
          [226, 226, 219, 255],
        );
      }
    }
  }
  if (preview && samples.length)
    dot(
      (samples[0].x + xOffset) * scale,
      (samples[0].z + zOffset) * scale,
      5,
      [255, 255, 255, 255],
    );
  return {
    png: encodePng(width, height, pixels),
    ini: `[PARAMETERS]\nWIDTH=${width}\nHEIGHT=${height}\nMARGIN=0\nSCALE_FACTOR=${1 / scale}\nX_OFFSET=${xOffset}\nZ_OFFSET=${zOffset}\nDRAWING_SIZE=10\n`,
  };
}
