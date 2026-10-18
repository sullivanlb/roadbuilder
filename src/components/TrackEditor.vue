<script setup lang="ts">
import { useEditor } from '../composables/useEditor';
import { computed, ref } from 'vue';
import { useCanvas } from '../composables/useCanvas';
import TrackTelemetry from './TrackTelemetry.vue';
import ElevationProfile from './ElevationProfile.vue';
import { formatTrackIssue } from '../i18n/fr';

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
  <section class="editor" aria-label="Éditeur du tracé">
    <div class="editor-heading">
      <div>
        <span class="eyebrow">ATELIER DE CRÉATION</span>
        <h1>De l’idée à la piste<span>.</span></h1>
      </div>
      <div class="view-tabs" aria-label="Vue de l’éditeur">
        <button id="view-2d" :aria-pressed="e.view === '2d'" @click="e.setView('2d')">
          <svg class="icon"><use href="#i-map" /></svg>Plan 2D</button
        ><button id="view-3d" :aria-pressed="e.view === '3d'" @click="e.setView('3d')">
          <svg class="icon"><use href="#i-cube" /></svg>Aperçu 3D
        </button>
      </div>
    </div>
    <div id="stage" class="stage">
      <canvas
        id="track-canvas"
        ref="canvas"
        :style="{ cursor }"
        tabindex="0"
        aria-label="Éditeur de circuit : sélectionnez et déplacez les points à la souris. Le panneau de gauche permet aussi de modifier leurs coordonnées."
        @pointerdown="pointerDown"
        @pointermove="pointerMove"
        @pointerup="endDrag"
        @pointercancel="endDrag"
        @lostpointercapture="endDrag"
        @dblclick="doubleClick"
        @wheel.prevent="wheel"
      ></canvas>
      <div class="tool-palette" role="toolbar" aria-label="Outils de dessin">
        <button
          id="tool-select"
          class="tool"
          :class="{ active: e.tool === 'select' }"
          title="Sélectionner et déplacer un point (V)"
          aria-label="Sélectionner (V)"
          :aria-pressed="e.tool === 'select'"
          @click="e.setTool('select')"
        >
          <svg class="icon"><use href="#i-cursor" /></svg>
        </button>
        <button
          id="tool-add"
          class="tool"
          :class="{ active: e.tool === 'add' }"
          title="Ajouter des points (A)"
          aria-label="Ajouter des points (A)"
          :aria-pressed="e.tool === 'add'"
          @click="e.setTool('add')"
        >
          <svg class="icon"><use href="#i-plus" /></svg>
        </button>
        <button
          id="tool-barrier"
          class="tool"
          :class="{ active: e.tool === 'barrier' }"
          title="Tracer une barrière (B)"
          aria-label="Tracer une barrière (B)"
          :aria-pressed="e.tool === 'barrier'"
          @click="e.setTool('barrier')"
        >
          <svg class="icon"><use href="#i-wall" /></svg>
        </button>
        <button
          id="tool-pan"
          class="tool"
          :class="{ active: e.tool === 'pan' }"
          title="Déplacer la vue (H)"
          aria-label="Déplacer la vue (H)"
          :aria-pressed="e.tool === 'pan'"
          @click="e.setTool('pan')"
        >
          <svg class="icon"><use href="#i-move" /></svg>
        </button>
        <span class="tool-divider"></span>
        <button
          id="undo"
          class="tool"
          title="Annuler (Ctrl+Z)"
          aria-label="Annuler"
          :disabled="!e.history.canUndo"
          @click="e.undo()"
        >
          <svg class="icon"><use href="#i-undo" /></svg>
        </button>
        <button
          id="redo"
          class="tool"
          title="Rétablir (Ctrl+Maj+Z)"
          aria-label="Rétablir"
          :disabled="!e.history.canRedo"
          @click="e.undo(true)"
        >
          <svg class="icon"><use href="#i-redo" /></svg>
        </button>
      </div>
      <div class="scene-badge">
        <span class="live-dot"></span
        ><span id="scene-label">{{ e.view === '2d' ? 'VUE DE DESSUS' : 'APERÇU DU RELIEF' }}</span
        ><span id="point-count">{{ String(e.project.points.length).padStart(2, '0') }} POINTS</span>
      </div>
      <div v-if="!e.project.points.length" id="empty-canvas" class="empty-canvas">
        <svg class="icon"><use href="#i-route" /></svg>
        <h2>Votre terrain de jeu.</h2>
        <p>
          Cliquez pour poser votre premier point.<br />Le suivant dessinera le début de votre route.
        </p>
      </div>
      <div id="canvas-hint" class="canvas-hint">{{ hint }}</div>
      <div v-show="e.view === '2d'" id="map-scale" class="scale">
        <span :style="{ width: `${scaleWidth}px` }"></span><output>{{ scaleLabel }}</output>
      </div>
      <div class="zoom-controls" role="toolbar" aria-label="Zoom">
        <button id="zoom-out" class="tool" aria-label="Dézoomer" @click="e.zoom(0.8)">
          <svg class="icon"><use href="#i-minus" /></svg></button
        ><span id="zoom-level">{{ zoomLevel }} %</span
        ><button id="zoom-in" class="tool" aria-label="Zoomer" @click="e.zoom(1.25)">
          <svg class="icon"><use href="#i-plus" /></svg></button
        ><span class="tool-divider"></span
        ><button
          id="fit-view"
          class="tool"
          title="Cadrer le tracé (F)"
          aria-label="Cadrer le tracé"
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
        ><span class="status-dot"></span
        >{{ issueStatus || 'Géométrie prête · export en jeu expérimental' }}</span
      >
      <button
        v-if="e.issues.tightTurns.length"
        id="locate-tight-turn"
        class="button secondary small"
        @click="e.focusTightTurn(e.issues.tightTurns[0].segment)"
      >
        Voir le virage
      </button>
      <span>1 unité = 1 mètre<span class="footer-dot">·</span>Tout reste sur votre appareil</span>
    </footer>
  </section>
</template>
