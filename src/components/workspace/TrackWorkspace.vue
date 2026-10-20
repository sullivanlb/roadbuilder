<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { formatTrackIssue, t } from '../../i18n';
import { useEditorStore } from '../../stores/editor';
import type { ViewMode } from '../../stores/editor';
import { useProjectStore } from '../../stores/project';
import { useViewportStore } from '../../stores/viewport';
import AppButton from '../ui/AppButton.vue';
import AppIcon from '../ui/AppIcon.vue';
import SegmentedControl from '../ui/SegmentedControl.vue';
import ElevationProfile from './ElevationProfile.vue';
import PlanCanvas from './PlanCanvas.vue';
import LayerTools from './LayerTools.vue';
import TrackTelemetry from './TrackTelemetry.vue';
import ZoomControls from './ZoomControls.vue';

// Three.js is only downloaded the first time the 3D preview opens.
const PreviewCanvas = defineAsyncComponent(() => import('./PreviewCanvas.vue'));

const store = useProjectStore();
const editor = useEditorStore();
const viewport = useViewportStore();

const view = computed({
  get: () => editor.view,
  set: (next: ViewMode) => editor.setView(next),
});
const views = computed(() => [
  { value: '2d' as const, label: t('editor.view2d'), icon: 'map' as const, id: 'view-2d' },
  { value: '3d' as const, label: t('editor.view3d'), icon: 'cube' as const, id: 'view-3d' },
]);

const issues = computed(() => [...store.issues.errors, ...store.issues.warnings]);
const status = computed(() =>
  issues.value[0] ? formatTrackIssue(issues.value[0]) : t('editor.statusReady'),
);
const statusDetails = computed(() =>
  issues.value.map((issue) => formatTrackIssue(issue)).join('\n'),
);
</script>

<template>
  <section class="workspace" :aria-label="t('editor.aria')">
    <div class="stage">
      <PlanCanvas v-show="editor.view === '2d'" />
      <PreviewCanvas v-if="editor.view === '3d'" />
      <LayerTools />
      <SegmentedControl
        v-model="view"
        class="views"
        :options="views"
        :label="t('editor.viewAria')"
      />
      <div v-if="!store.project.points.length" id="empty-canvas" class="empty">
        <AppIcon name="route" />
        <h2>{{ t('editor.emptyTitle') }}</h2>
        <p>{{ t('editor.emptyLine1') }}<br />{{ t('editor.emptyLine2') }}</p>
      </div>
      <ZoomControls />
    </div>
    <TrackTelemetry />
    <ElevationProfile />
    <footer class="footer">
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
      <span class="about"
        >{{ t('editor.unitHint') }}<span class="separator">·</span>{{ t('editor.privacy') }}</span
      >
    </footer>
  </section>
</template>

<style scoped>
.workspace {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}
.views {
  position: absolute;
  top: 12px;
  right: 12px;
  border: 1px solid var(--line);
  background: var(--panel);
}
.stage {
  position: relative;
  flex: 1;
  min-height: 280px;
  margin: 12px 12px 0;
  background: #1b2924;
  border: 1px solid #364139;
  border-radius: 9px;
  overflow: hidden;
}
.dot {
  width: 5px;
  height: 5px;
  background: #afc97e;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.empty {
  pointer-events: none;
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--accent);
  --icon-size: 52px;
}
.empty h2 {
  font-size: 26px;
  font-weight: 400;
  letter-spacing: -0.6px;
  color: var(--text);
}
.empty p {
  text-align: center;
  font-size: 12px;
  line-height: 1.8;
  color: #a5b49d;
}
.footer {
  padding: 15px 26px;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  font-size: 9px;
  color: #7d9091;
}
.status {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #aab799;
}
.status.invalid {
  color: var(--red);
}
.status.invalid .dot {
  background: var(--red);
}
.separator {
  margin: 0 9px;
  color: #546a69;
}
@media (max-width: 1200px) {
  .about {
    display: none;
  }
}
@media (max-width: 950px) {
  .views {
    --icon-size: 0;
  }
}
@media (max-width: 650px) {
  .footer {
    padding: 12px 18px;
    font-size: 8px;
  }
}
</style>
