import { trackStats } from '../domain/track/geometry';
import type { Sample } from '../domain/types';
import type { View } from './view';

/** Elevation profile under the canvas: area chart plus the selected point. */
export function drawProfile(view: View) {
  const ctx = view.profile,
    w = view.profileWidth,
    h = view.profileHeight;
  if (!w || !h) return;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = '#39504355';
  ctx.lineWidth = 0.6;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (i * h) / 4);
    ctx.lineTo(w, (i * h) / 4);
    ctx.stroke();
  }
  if (view.samples.length < 2) return;
  const stats = trackStats(view.samples),
    range = Math.max(10, stats.elevation);
  const xy = (p: Sample) => ({
    x: 4 + (p.s / (stats.length || 1)) * (w - 8),
    y: h - 6 - ((p.y - stats.min + range * 0.08) / (range * 1.2)) * (h - 12),
  });
  ctx.beginPath();
  view.samples.forEach((p, i) => {
    const s = xy(p);
    if (i === 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  });
  ctx.strokeStyle = '#bddb86';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.lineTo(w - 4, h);
  ctx.lineTo(4, h);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, 0, 0, h);
  fill.addColorStop(0, '#a7cb5e40');
  fill.addColorStop(1, '#a7cb5e03');
  ctx.fillStyle = fill;
  ctx.fill();
  if (view.selected >= 0) {
    let sample = view.samples.find((p) => p.segment === view.selected && p.t === 0);
    if (!sample && view.selected === view.project.points.length - 1) sample = view.samples.at(-1);
    if (sample) {
      const p = xy(sample);
      ctx.strokeStyle = '#d3f47d66';
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(p.x, 0);
      ctx.lineTo(p.x, h);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#d3f47d';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
