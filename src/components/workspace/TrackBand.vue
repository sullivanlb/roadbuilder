<script setup lang="ts">
import { useDevicePixelRatio, useElementSize } from '@vueuse/core';
import { computed, ref, useTemplateRef, watch } from 'vue';
import {
  setStartLine,
  updateBarrier,
  updatePitLane,
  updateWidthZone,
} from '../../core/project/edits';
import type { TrackPosition } from '../../core/project/schema';
import { trackLength } from '../../core/track/centerline';
import { positionAt } from '../../core/track/positions';
import type { TrackRange } from '../../core/track/ranges';
import { formatNumber, formatTrackIssue, t } from '../../i18n';
import {
  bandBlocks,
  bandCornerAt,
  bandHit,
  bandRows,
  drawBand,
  nearestPoint,
} from '../../rendering/band';
import type { BandBlock, BandLabels, BandView } from '../../rendering/band';
import { useEditorStore } from '../../stores/editor';
import { useProjectStore } from '../../stores/project';
import { useViewportStore } from '../../stores/viewport';
import AppButton from '../ui/AppButton.vue';

/** The track unrolled along its distance: the active layer's rows, blocks and ranges. */
const store = useProjectStore();
const editor = useEditorStore();
const viewport = useViewportStore();
const canvas = useTemplateRef<HTMLCanvasElement>('canvas');
const { width, height } = useElementSize(canvas);
const { pixelRatio } = useDevicePixelRatio();
const dpr = computed(() => Math.min(pixelRatio.value || 1, 2));

const total = computed(() => trackLength(store.samples));
const view = computed<BandView>(() => viewport.bandView ?? { start: 0, end: total.value || 1 });
const size = computed(() => ({ width: width.value, height: height.value }));
const labels = computed<BandLabels>(() => ({
  rows: {
    altitude: t('band.altitude'),
    width: t('band.width'),
    zones: t('band.zones'),
    left: t('band.left'),
    right: t('band.right'),
    lane: t('band.lane'),
    start: t('band.start'),
    empty: '',
  },
  barrier: {
    guardrail: t('barriers.guardrail'),
    tires: t('barriers.tires'),
    tecpro: t('barriers.tecpro'),
    wall: t('barriers.wall'),
  },
  width: (metres) => `${formatNumber(metres, metres % 1 ? 1 : 0)} m`,
  lane: t('band.laneBlock'),
  start: t('band.startBlock'),
  empty: t('band.empty'),
  corner: (corner) => t('corner.short', { number: corner.number }),
  distance: (metres) =>
    metres >= 1000 ? `${formatNumber(metres / 1000, metres % 1000 ? 1 : 0)} km` : `${metres} m`,
}));
const rows = computed(() => bandRows(editor.layer, size.value));
const blocks = computed(() => bandBlocks(store.project, store.samples, editor.layer, labels.value));

/** The block that holds the selection, when the selection is laid along the track. */
const selectedBlockId = computed(() => {
  const selection = editor.selection;
  if (selection?.kind === 'barrier' || selection?.kind === 'widthZone') return selection.id;
  return selection?.kind === 'pitLane' ? 'pitLane' : null;
});

type Drag =
  | { kind: 'edge'; block: BandBlock; edge: 'start' | 'end' }
  | { kind: 'range'; from: number; to: number; x: number; moved: boolean };
const drag = ref<Drag | null>(null);
const rangeOf = (current: Extract<Drag, { kind: 'range' }>): TrackRange => ({
  start: Math.min(current.from, current.to),
  length: Math.abs(current.to - current.from),
});
const pendingRange = computed<TrackRange | null>(() => {
  const current = drag.value;
  return current?.kind === 'range' && current.moved ? rangeOf(current) : null;
});

let frame: number | null = null;
function draw() {
  frame = null;
  const context = canvas.value?.getContext('2d');
  if (!context || !width.value || !height.value) return;
  drawBand(context, size.value, dpr.value, {
    project: store.project,
    samples: store.samples,
    view: view.value,
    rows: rows.value,
    blocks: blocks.value,
    labels: labels.value,
    corners: store.corners,
    selectedBlockId: selectedBlockId.value,
    selectedPointIds: editor.selectedPoints?.ids ?? [],
    range: editor.range,
    pendingRange: pendingRange.value,
    hoverS: editor.hoverS,
  });
}
watch(
  [
    () => store.samples,
    () => store.project,
    () => editor.layer,
    () => editor.selection,
    () => editor.range,
    () => editor.hoverS,
    view,
    pendingRange,
    labels,
    width,
    height,
    dpr,
  ],
  () => {
    if (canvas.value) {
      canvas.value.width = Math.round(width.value * dpr.value);
      canvas.value.height = Math.round(height.value * dpr.value);
    }
    frame ??= requestAnimationFrame(draw);
  },
);

function pointer(event: MouseEvent) {
  const rect = canvas.value!.getBoundingClientRect();
  const x = event.clientX - rect.left,
    y = event.clientY - rect.top;
  return { x, hit: bandHit(size.value, view.value, total.value, rows.value, blocks.value, x, y) };
}

/** Moves one end of a block to track distance `s`, as a preview until the drag ends. */
function moveEdge(block: BandBlock, edge: 'start' | 'end', s: number) {
  const at: TrackPosition = positionAt(store.project, store.samples, s);
  const end = edge === 'start' ? 'from' : 'to';
  store.edit(
    (draft) => {
      if (block.kind === 'widthZone') updateWidthZone(draft, block.id, { [end]: at });
      else if (block.kind === 'barrier') updateBarrier(draft, block.id, { [end]: at });
      else if (block.kind === 'pitLane')
        updatePitLane(draft, edge === 'start' ? { entry: at } : { exit: at });
      else setStartLine(draft, at);
    },
    { commit: false },
  );
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 || store.samples.length < 2) return;
  canvas.value!.setPointerCapture(event.pointerId);
  const { x, hit } = pointer(event);
  const rect = canvas.value!.getBoundingClientRect();
  const corner = bandCornerAt(
    size.value,
    view.value,
    total.value,
    store.corners,
    x,
    event.clientY - rect.top,
  );
  if (corner) return viewport.focusRange(corner);
  const block = hit.block;
  if (block) {
    if (block.kind === 'widthZone') editor.selectWidthZone(block.id);
    else if (block.kind === 'barrier') editor.selectBarrier(block.id);
    else if (block.kind === 'pitLane') editor.select({ kind: 'pitLane' });
    if (hit.edge) drag.value = { kind: 'edge', block, edge: hit.edge };
    return;
  }
  drag.value = { kind: 'range', from: hit.s, to: hit.s, x, moved: false };
}

function onPointerMove(event: PointerEvent) {
  const { x, hit } = pointer(event);
  const current = drag.value;
  editor.hoverS = hit.s;
  if (current?.kind === 'edge') moveEdge(current.block, current.edge, hit.s);
  else if (current?.kind === 'range') {
    current.to = hit.s;
    current.moved ||= Math.abs(x - current.x) > 4;
  }
  canvas.value!.style.cursor = current
    ? current.kind === 'edge'
      ? 'ew-resize'
      : 'crosshair'
    : hit.edge
      ? 'ew-resize'
      : hit.block
        ? 'pointer'
        : 'crosshair';
}

function onPointerUp() {
  const current = drag.value;
  drag.value = null;
  if (current?.kind === 'edge') return store.commit();
  if (current?.kind !== 'range') return;
  if (current.moved) return editor.setRange(rangeOf(current));
  editor.setRange(null);
  // A plain click on the track layer picks the nearest control point, as on the profile.
  if (editor.layer === 'track' && store.project.points.length)
    editor.selectPointAt(nearestPoint(store.samples, store.project.points.length, current.from));
}

function onWheel(event: WheelEvent) {
  if (!total.value) return;
  const { hit } = pointer(event);
  let { start, end } = view.value;
  if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
    const shift = ((event.deltaX || event.deltaY) * (end - start)) / 800;
    start += shift;
    end += shift;
  } else {
    const factor = Math.exp(event.deltaY * 0.0015);
    start = hit.s - (hit.s - start) * factor;
    end = hit.s + (end - hit.s) * factor;
  }
  viewport.setBandView({ start, end }, total.value);
}

const issues = computed(() => [...store.issues.errors, ...store.issues.warnings]);
const status = computed(() =>
  issues.value[0] ? formatTrackIssue(issues.value[0]) : t('editor.statusReady'),
);
const statusDetails = computed(() =>
  issues.value.map((issue) => formatTrackIssue(issue)).join('\n'),
);
const zoomed = computed(() => viewport.bandView !== null);
</script>

<template>
  <section class="band" :aria-label="t('band.aria')">
    <div class="head">
      <strong>{{ t('band.title') }}</strong>
      <span id="band-stats" class="stats"
        >{{ formatNumber(store.stats.length / 1000, 2) }} km ·
        {{ t('band.climb', { climb: formatNumber(store.stats.climb) }) }} ·
        {{ t('band.grade', { grade: formatNumber(store.stats.grade, 1) }) }}</span
      >
      <span class="hint">{{
        zoomed
          ? t('band.zoomed', {
              from: formatNumber(view.start),
              to: formatNumber(view.end),
            })
          : t('band.hint')
      }}</span>
      <span
        id="validation-status"
        class="status"
        :class="{ invalid: store.issues.errors.length }"
        :title="statusDetails"
        ><i class="dot"></i>{{ status }}</span
      >
      <AppButton
        v-if="store.issues.locations.length"
        id="locate-tight-turn"
        variant="secondary"
        small
        @click="viewport.focusIssue(store.issues.locations[0])"
      >
        {{ t('editor.locateTurn') }}
      </AppButton>
    </div>
    <canvas
      id="band-canvas"
      ref="canvas"
      :aria-label="t('band.aria')"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="drag === null && (editor.hoverS = null)"
      @wheel.prevent="onWheel"
      @dblclick="viewport.setBandView(null, total)"
    ></canvas>
  </section>
</template>

<style scoped>
.band {
  margin: 10px 12px 12px;
  border: 1px solid #2b383a;
  border-radius: var(--radius);
  background: #172023;
  height: 178px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  border-bottom: 1px solid #2b383a;
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  min-height: 34px;
  overflow: hidden;
}
.head strong {
  color: var(--text);
  font-weight: 600;
}
.stats {
  font-variant-numeric: tabular-nums;
}
.hint {
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--faint);
}
.status {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 7px;
  color: #aab799;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.status.invalid {
  color: var(--red);
}
.dot {
  width: 5px;
  height: 5px;
  background: #afc97e;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.status.invalid .dot {
  background: var(--red);
}
canvas {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: block;
  touch-action: none;
}
@media (max-width: 950px) {
  .hint {
    display: none;
  }
}
</style>
