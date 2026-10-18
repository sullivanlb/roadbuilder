import { sampleAt } from '../domain/track/geometry';
import { terrainBounds } from '../domain/track/terrain';
import { barrierPath, DEFAULT_BARRIER_OFFSET } from '../domain/track/barriers';
import { BARRIER_STYLE, DRAFT_COLOR } from './theme';
import type { View } from './view';

/** 2D pass: terrain outline, roadway, kerbs, direction arrows, barriers and points. */
export function draw2d(view: View) {
  const ctx = view.ctx,
    p = view.project,
    scale = view.camera.scale;
  if (view.samples.length > 1) {
    const terrain = terrainBounds(p, view.samples);
    const corner = view.screen({ x: terrain.minX, z: terrain.minZ, y: 0 });
    const width = (terrain.maxX - terrain.minX) * scale,
      height = (terrain.maxZ - terrain.minZ) * scale;
    ctx.fillStyle = '#627d3a28';
    ctx.fillRect(corner.x, corner.y, width, height);
    ctx.strokeStyle = '#adc68a80';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 5]);
    ctx.strokeRect(corner.x, corner.y, width, height);
    ctx.setLineDash([]);
    view.trace(view.samples);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0d191f50';
    ctx.lineWidth = (p.width + p.shoulder * 2 + 5) * scale + 4;
    ctx.stroke();
    ctx.strokeStyle = '#4c623a';
    ctx.lineWidth = (p.width + p.shoulder * 2 + (p.kerbs ? 1.3 : 0)) * scale;
    ctx.stroke();
    if (p.kerbs) {
      ctx.strokeStyle = '#c3c4ac';
      ctx.lineWidth = (p.width + 1.3) * scale;
      ctx.stroke();
      ctx.strokeStyle = '#b35949';
      ctx.setLineDash([5 * scale, 5 * scale]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = '#89918a';
    ctx.lineWidth = Math.max(p.width * scale, 2);
    ctx.stroke();
    ctx.strokeStyle = '#3e4848';
    ctx.lineWidth = Math.max((p.width - 0.6) * scale, 1.5);
    ctx.stroke();
    ctx.strokeStyle = '#b1c39185';
    ctx.lineWidth = 0.75;
    ctx.setLineDash([3, 7]);
    ctx.stroke();
    ctx.setLineDash([]);
    const length = view.samples.at(-1)!.s;
    for (let s = length / 9; s < length; s += length / 6) {
      const a = sampleAt(view.samples, s)!,
        pos = view.screen(a);
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(Math.atan2(-a.nx, a.nz));
      ctx.strokeStyle = '#d8eab9aa';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-4, -3);
      ctx.lineTo(1, 0);
      ctx.lineTo(-4, 3);
      ctx.stroke();
      ctx.restore();
    }
    drawStart(view);
    drawTightTurns(view);
    drawBarriers(view);
  }
  const affectedPoints = new Set(view.tightTurns.flatMap((turn) => turn.pointIndices));
  p.points.forEach((point, i) => {
    const s = view.screen(point),
      selected = i === view.selected,
      invalid = affectedPoints.has(i);
    if (selected) {
      ctx.fillStyle = '#d3f47d16';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d3f47d66';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(s.x, s.y, selected ? 6 : 4.5, 0, Math.PI * 2);
    ctx.fillStyle = selected ? '#d3f47d' : '#1b2b22';
    ctx.fill();
    ctx.strokeStyle = invalid ? '#ec8b7f' : i === view.hover ? '#efffdc' : '#c9dda7';
    ctx.lineWidth = selected ? 2 : 1.5;
    ctx.stroke();
    ctx.font = '9px Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const nx = view.samples.find((s) => s.segment === i)?.nx || 0,
      nz = view.samples.find((s) => s.segment === i)?.nz || -1;
    const offsetX = nx * 18 + 9,
      offsetY = nz * 18 - 7;
    ctx.fillStyle = invalid ? '#ec8b7f' : selected ? '#e4ffa4' : '#a8bc8c';
    ctx.fillText(
      `${String(i + 1).padStart(2, '0')}${invalid ? ' !' : ''}`,
      s.x + offsetX,
      s.y + offsetY,
    );
  });
}

/** Highlights the failing road portions and their control points. */
export function drawTightTurns(view: View) {
  if (!view.tightTurns.length) return;
  const ctx = view.ctx;
  const segments = new Set(view.tightTurns.map((turn) => turn.segment));
  ctx.save();
  ctx.strokeStyle = '#ec8b7f';
  ctx.lineWidth = 3;
  ctx.setLineDash([7, 4]);
  ctx.beginPath();
  for (let i = 0; i < view.samples.length - 1; i++) {
    if (!segments.has(view.samples[i].segment)) continue;
    const a = view.screen(view.samples[i]),
      b = view.screen(view.samples[i + 1]);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const turn of view.tightTurns) {
    const p = view.screen(view.samples[turn.sampleIndex]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#412a25';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ec8b7f';
    ctx.fillText('!', p.x, p.y);
  }
  ctx.restore();
}

/** Draws every barrier span plus the draft being traced, with hover markers. */
export function drawBarriers(view: View) {
  const ctx = view.ctx;
  for (const [index, barrier] of (view.project.barriers ?? []).entries()) {
    const path = barrierPath(view.project, view.samples, barrier);
    if (path.length < 2) continue;
    const style = BARRIER_STYLE[barrier.type];
    view.trace(path);
    if (index === view.selectedBarrier) {
      ctx.strokeStyle = '#d3f47d44';
      ctx.lineWidth = style.width + 5;
      ctx.stroke();
    }
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.width;
    if (style.dash.length) ctx.setLineDash(style.dash);
    ctx.stroke();
    if (style.dash.length) ctx.setLineDash([]);
  }
  const draft = view.barrierDraft,
    hover = view.barrierHover;
  if (draft && hover && hover.index !== draft.from) {
    const from = view.project.closed ? draft.from : Math.min(draft.from, hover.index);
    const to = view.project.closed ? hover.index : Math.max(draft.from, hover.index);
    const path = barrierPath(view.project, view.samples, {
      type: draft.type,
      side: draft.side,
      from,
      to,
      offset: DEFAULT_BARRIER_OFFSET,
    });
    if (path.length > 1) {
      view.trace(path);
      ctx.strokeStyle = DRAFT_COLOR;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  const marker = (index: number, color: string) => {
    const point = view.project.points[index];
    if (!point) return;
    const s = view.screen(point);
    ctx.beginPath();
    ctx.arc(s.x, s.y, 10, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };
  if (hover) marker(hover.index, '#d3f47d88');
  if (draft) marker(draft.from, DRAFT_COLOR);
}

/** Start/finish checkerboard and labels. */
export function drawStart(view: View) {
  const ctx = view.ctx,
    start = sampleAt(view.samples, Math.min(28, view.samples.at(-1)!.s * 0.25))!;
  const p = view.screen(start),
    half = (view.project.width * view.camera.scale) / 2;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.atan2(-start.nx, start.nz));
  const block = Math.max(2.5, half / 4);
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#202923' : '#e4e9d6';
      ctx.fillRect((j - 1) * block, -half + (i * half) / 4, block, half / 4);
    }
  ctx.restore();
  ctx.font = '8px "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#b3c69b';
  ctx.fillText(view.labels.start, p.x + 13, p.y + half + 24);
  if (!view.project.closed) {
    const end = view.screen(view.samples.at(-1)!);
    ctx.fillText(view.labels.finish, end.x + 13, end.y + 21);
  }
}
