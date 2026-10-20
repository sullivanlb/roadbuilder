<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { t } from '../../i18n';
import { useEditorStore } from '../../stores/editor';
import type { ViewMode } from '../../stores/editor';
import { useProjectStore } from '../../stores/project';
import AppIcon from '../ui/AppIcon.vue';
import SegmentedControl from '../ui/SegmentedControl.vue';
import PlanCanvas from './PlanCanvas.vue';
import PlanNavigator from './PlanNavigator.vue';
import TrackBand from './TrackBand.vue';
import LayerTools from './LayerTools.vue';
import ZoomControls from './ZoomControls.vue';

// Three.js is only downloaded the first time the 3D preview opens.
const PreviewCanvas = defineAsyncComponent(() => import('./PreviewCanvas.vue'));

const store = useProjectStore();
const editor = useEditorStore();

const view = computed({
  get: () => editor.view,
  set: (next: ViewMode) => editor.setView(next),
});
const views = computed(() => [
  { value: '2d' as const, label: t('editor.view2d'), icon: 'map' as const, id: 'view-2d' },
  { value: '3d' as const, label: t('editor.view3d'), icon: 'cube' as const, id: 'view-3d' },
]);
</script>

<template>
  <section class="workspace" :aria-label="t('editor.aria')">
    <div class="stage">
      <PlanCanvas v-show="editor.view === '2d'" />
      <PreviewCanvas v-if="editor.view === '3d'" />
      <LayerTools />
      <PlanNavigator v-if="editor.view === '2d' && store.samples.length > 1" />
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
    <TrackBand />
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
@media (max-width: 950px) {
  .views {
    --icon-size: 0;
  }
}
</style>
