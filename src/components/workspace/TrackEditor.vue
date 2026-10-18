<script setup lang="ts">
import { useEditor } from '../../composables/useEditor';
import { computed, ref } from 'vue';
import { useCanvas } from '../../composables/useCanvas';
import TrackTelemetry from './TrackTelemetry.vue';
import ElevationProfile from './ElevationProfile.vue';
import { formatTrackIssue, t } from '../../i18n';

const e = useEditor();
const issueTitle = computed(() =>
  [...e.issues.errors, ...e.issues.warnings].map(formatTrackIssue).join('\n'),
);
const issueStatus = computed(() => {
  const first = e.issues.errors[0] ?? e.issues.warnings[0];
  return first ? formatTrackIssue(first) : '';
});
const canvas = ref<HTMLCanvasElement | null>(null);
const profile = ref<InstanceType<typeof ElevationProfile> | null>(null);
const {
  cursor,
  hint,
  zoomLevel,
  scaleWidth,
  scaleLabel,
  pointerDown,
  pointerMove,
  endDrag,
  doubleClick,
  wheel,
  profileClick,
} = useCanvas(canvas, () => profile.value?.canvas ?? null);
</script>
<template>
  <section class="editor" :aria-label="t('editor.aria')">
    <div class="editor-heading">
      <div>
        <span class="eyebrow">{{ t('editor.eyebrow') }}</span>
        <h1>{{ t('editor.title') }}<span>.</span></h1>
      </div>
      <div class="view-tabs" :aria-label="t('editor.viewAria')">
        <button id="view-2d" :aria-pressed="e.view === '2d'" @click="e.setView('2d')">
          <svg class="icon"><use href="#i-map" /></svg>{{ t('editor.view2d') }}</button
        ><button id="view-3d" :aria-pressed="e.view === '3d'" @click="e.setView('3d')">
          <svg class="icon"><use href="#i-cube" /></svg>{{ t('editor.view3d') }}
        </button>
      </div>
    </div>
    <div id="stage" class="stage">
      <canvas
        id="track-canvas"
        ref="canvas"
        :style="{ cursor }"
        tabindex="0"
        :aria-label="t('editor.canvasAria')"
        @pointerdown="pointerDown"
        @pointermove="pointerMove"
        @pointerup="endDrag"
        @pointercancel="endDrag"
        @lostpointercapture="endDrag"
        @dblclick="doubleClick"
        @wheel.prevent="wheel"
      ></canvas>
      <div class="tool-palette" role="toolbar" :aria-label="t('editor.toolsAria')">
        <button
          id="tool-select"
          class="tool"
          :class="{ active: e.tool === 'select' }"
          :title="t('editor.selectTitle')"
          :aria-label="t('editor.selectAria')"
          :aria-pressed="e.tool === 'select'"
          @click="e.setTool('select')"
        >
          <svg class="icon"><use href="#i-cursor" /></svg>
        </button>
        <button
          id="tool-add"
          class="tool"
          :class="{ active: e.tool === 'add' }"
          :title="t('editor.addTitle')"
          :aria-label="t('editor.addTitle')"
          :aria-pressed="e.tool === 'add'"
          @click="e.setTool('add')"
        >
          <svg class="icon"><use href="#i-plus" /></svg>
        </button>
        <button
          id="tool-barrier"
          class="tool"
          :class="{ active: e.tool === 'barrier' }"
          :title="t('editor.barrierTitle')"
          :aria-label="t('editor.barrierTitle')"
          :aria-pressed="e.tool === 'barrier'"
          @click="e.setTool('barrier')"
        >
          <svg class="icon"><use href="#i-wall" /></svg>
        </button>
        <button
          id="tool-pan"
          class="tool"
          :class="{ active: e.tool === 'pan' }"
          :title="t('editor.panTitle')"
          :aria-label="t('editor.panTitle')"
          :aria-pressed="e.tool === 'pan'"
          @click="e.setTool('pan')"
        >
          <svg class="icon"><use href="#i-move" /></svg>
        </button>
        <span class="tool-divider"></span>
        <button
          id="undo"
          class="tool"
          :title="t('editor.undoTitle')"
          :aria-label="t('help.shortcutUndo')"
          :disabled="!e.history.canUndo"
          @click="e.undo()"
        >
          <svg class="icon"><use href="#i-undo" /></svg>
        </button>
        <button
          id="redo"
          class="tool"
          :title="t('editor.redoTitle')"
          :aria-label="t('help.shortcutRedo')"
          :disabled="!e.history.canRedo"
          @click="e.undo(true)"
        >
          <svg class="icon"><use href="#i-redo" /></svg>
        </button>
      </div>
      <div class="scene-badge">
        <span class="live-dot"></span
        ><span id="scene-label">{{
          e.view === '2d' ? t('editor.scene2d') : t('editor.scene3d')
        }}</span
        ><span id="point-count">{{
          t('editor.pointCount', { count: String(e.project.points.length).padStart(2, '0') })
        }}</span>
      </div>
      <div v-if="!e.project.points.length" id="empty-canvas" class="empty-canvas">
        <svg class="icon"><use href="#i-route" /></svg>
        <h2>{{ t('editor.emptyTitle') }}</h2>
        <p>{{ t('editor.emptyLine1') }}<br />{{ t('editor.emptyLine2') }}</p>
      </div>
      <div id="canvas-hint" class="canvas-hint">{{ hint }}</div>
      <div v-show="e.view === '2d'" id="map-scale" class="scale">
        <span :style="{ width: `${scaleWidth}px` }"></span><output>{{ scaleLabel }}</output>
      </div>
      <div class="zoom-controls" role="toolbar" :aria-label="t('editor.zoomAria')">
        <button id="zoom-out" class="tool" :aria-label="t('editor.zoomOut')" @click="e.zoom(0.8)">
          <svg class="icon"><use href="#i-minus" /></svg></button
        ><span id="zoom-level">{{ zoomLevel }} %</span
        ><button id="zoom-in" class="tool" :aria-label="t('editor.zoomIn')" @click="e.zoom(1.25)">
          <svg class="icon"><use href="#i-plus" /></svg></button
        ><span class="tool-divider"></span
        ><button
          id="fit-view"
          class="tool"
          :title="t('editor.fitTitle')"
          :aria-label="t('editor.fitAria')"
          @click="e.fit()"
        >
          <svg class="icon"><use href="#i-fit" /></svg>
        </button>
      </div>
      <div v-show="e.view === '2d'" id="compass" class="compass" aria-hidden="true">
        <span>N</span
        ><svg viewBox="0 0 40 40">
          <path d="m20 5 8 28-8-5-8 5z" fill="#d3f47d" />
          <path d="m20 5 0 23-8 5z" fill="#769164" />
        </svg>
      </div>
    </div>

    <TrackTelemetry />
    <ElevationProfile ref="profile" @select="profileClick" />
    <footer class="editor-footer">
      <span
        id="validation-status"
        :class="{ invalid: e.issues.errors.length > 0 }"
        :title="issueTitle"
        ><span class="status-dot"></span>{{ issueStatus || t('editor.statusReady') }}</span
      >
      <button
        v-if="e.issues.tightTurns.length"
        id="locate-tight-turn"
        class="button secondary small"
        @click="e.focusTightTurn(e.issues.tightTurns[0].segment)"
      >
        {{ t('editor.locateTurn') }}
      </button>
      <span
        >{{ t('editor.unitHint') }}<span class="footer-dot">·</span>{{ t('editor.privacy') }}</span
      >
    </footer>
  </section>
</template>
