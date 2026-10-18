import { bounds } from '../domain/track/geometry';
import type { View } from './view';

/** Paints the background and the faint coordinate grid, in both view modes. */
export function drawGrid(view: View) {
  const ctx = view.ctx;
  const gradient = ctx.createRadialGradient(
    view.width * 0.55,
    view.height * 0.3,
    10,
    view.width * 0.5,
    view.height * 0.5,
    view.width * 0.8,
  );
  gradient.addColorStop(0, '#28392b');
  gradient.addColorStop(1, '#17251f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = '#667e4b12';
  // A faint coordinate grid, anchored in world space.
  const step = view.camera.scale < 0.3 ? 100 : view.camera.scale < 1.5 ? 50 : 10;
  if (view.mode === '2d') {
    const top = view.world(0, 0),
      bottom = view.world(view.width, view.height);
    ctx.beginPath();
    for (let x = Math.floor(top.x / step) * step; x <= bottom.x; x += step) {
      const s = view.screen({ x, z: 0, y: 0 });
      ctx.moveTo(s.x, 0);
      ctx.lineTo(s.x, view.height);
    }
    for (let z = Math.floor(top.z / step) * step; z <= bottom.z; z += step) {
      const s = view.screen({ x: 0, z, y: 0 });
      ctx.moveTo(0, s.y);
      ctx.lineTo(view.width, s.y);
    }
    ctx.stroke();
    ctx.fillStyle = '#a0bc6c22';
    const dotStep = step * 2;
    for (let x = Math.floor(top.x / dotStep) * dotStep; x <= bottom.x; x += dotStep) {
      for (let z = Math.floor(top.z / dotStep) * dotStep; z <= bottom.z; z += dotStep) {
        const p = view.screen({ x, z, y: 0 });
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      }
    }
  } else {
    const b = bounds(view.samples, 120),
      y = b.minY - 6;
    const gridStep = Math.max(50, Math.ceil((b.maxX - b.minX) / 50 / 10) * 10);
    for (let x = Math.floor(b.minX / gridStep) * gridStep; x < b.maxX; x += gridStep) {
      view.trace([
        { x, y, z: b.minZ },
        { x, y, z: b.maxZ },
      ]);
      ctx.stroke();
    }
    for (let z = Math.floor(b.minZ / gridStep) * gridStep; z < b.maxZ; z += gridStep) {
      view.trace([
        { x: b.minX, y, z },
        { x: b.maxX, y, z },
      ]);
      ctx.stroke();
    }
  }
}
