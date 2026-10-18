import { clamp } from '../domain/math';
import { sampleAt } from '../domain/track/geometry';
import { MATERIALS } from '../domain/track/mesh';
import { buildScene } from '../domain/track/scene';
import { drawTightTurns } from './draw2d';
import type { ScreenPoint, View } from './view';

/** 3D pass: painter's algorithm over the scene triangles, then the markers. */
export function draw3d(view: View) {
  if (view.samples.length < 2) return;
  if (!view.scene) view.scene = buildScene(view.project, view.samples);
  const ctx = view.ctx,
    faces: { screen: ScreenPoint[]; depth: number; color: string }[] = [];
  for (const mesh of view.scene.meshes) {
    // Barrier colliders stay invisible in game: they are not drawn here.
    if (mesh.renderable === false) continue;
    const color = MATERIALS[mesh.material].color;
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const verts = mesh.indices.slice(i, i + 3).map((index) => mesh.vertices[index]);
      const screen = verts.map((v) =>
        view.screen({ x: v.position[0], y: v.position[1], z: v.position[2] }),
      );
      const normal = verts[0].normal;
      const shade = clamp(0.8 + 0.2 * normal[1] + 0.12 * normal[0], 0.55, 1.15);
      faces.push({
        screen,
        depth: screen.reduce((n, p) => n + p.depth, 0) / screen.length,
        color: `rgb(${color.map((c) => Math.round(c * shade)).join(',')})`,
      });
    }
  }
  faces.sort((a, b) => a.depth - b.depth);
  for (const face of faces) {
    ctx.beginPath();
    face.screen.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = face.color;
    ctx.fill();
    ctx.strokeStyle = face.color;
    ctx.lineWidth = 0.35;
    ctx.stroke();
  }
  drawTightTurns(view);
  const start = view.screen(sampleAt(view.samples, 12)!);
  ctx.fillStyle = '#d3f47d';
  ctx.beginPath();
  ctx.arc(start.x, start.y - 8, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d3f47d88';
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(start.x, start.y - 8);
  ctx.stroke();
  ctx.font = '8px "Segoe UI", sans-serif';
  ctx.fillText('DÉPART', start.x + 8, start.y - 9);
}
