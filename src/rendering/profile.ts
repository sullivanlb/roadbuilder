import { controlPointSample, trackStats } from '../core/track/centerline';
import type { Sample } from '../core/track/centerline';
import { COLORS } from './theme';
import type { ViewportSize } from './plan/projection';

/** Horizontal padding of the chart, in pixels. */
const PADDING = 4;

/** Elevation along the track as an area chart, with the selected control point marked. */
export function drawProfile(
  ctx: CanvasRenderingContext2D,
  { width: w, height: h }: ViewportSize,
  dpr: number,
  samples: readonly Sample[],
  selectedIndex: number,
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = COLORS.profile.grid;
  ctx.lineWidth = 0.6;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (i * h) / 4);
    ctx.lineTo(w, (i * h) / 4);
    ctx.stroke();
  }
  if (samples.length < 2) return;
  const stats = trackStats(samples),
    range = Math.max(10, stats.elevation);
  const toChart = (p: Sample) => ({
    x: PADDING + (p.s / (stats.length || 1)) * (w - 2 * PADDING),
    y: h - 6 - ((p.y - stats.min + range * 0.08) / (range * 1.2)) * (h - 12),
  });
  ctx.beginPath();
  samples.forEach((sample, i) => {
    const p = toChart(sample);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.strokeStyle = COLORS.profile.line;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.lineTo(w - PADDING, h);
  ctx.lineTo(PADDING, h);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, 0, 0, h);
  fill.addColorStop(0, COLORS.profile.fillTop);
  fill.addColorStop(1, COLORS.profile.fillBottom);
  ctx.fillStyle = fill;
  ctx.fill();
  const selected = selectedIndex >= 0 ? controlPointSample(samples, selectedIndex) : undefined;
  if (!selected) return;
  const p = toChart(selected);
  ctx.strokeStyle = COLORS.point.haloOutline;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(p.x, 0);
  ctx.lineTo(p.x, h);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COLORS.accent;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
  ctx.fill();
}

/** The control point closest to a horizontal position of the chart (0 = start, 1 = end). */
export function pointAtProfile(
  samples: readonly Sample[],
  pointCount: number,
  ratio: number,
): number {
  const target = ratio * (samples.at(-1)?.s ?? 0);
  let best = 0,
    bestDistance = Infinity;
  for (let i = 0; i < pointCount; i++) {
    const sample = controlPointSample(samples, i) ?? samples.at(-1);
    if (!sample) break;
    const d = Math.abs(sample.s - target);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}
