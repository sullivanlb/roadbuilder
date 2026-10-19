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
import ToolPalette from './ToolPalette.vue';
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
    <div class="heading">
      <div>
        <span class="eyebrow">{{ t('editor.eyebrow') }}</span>
        <h1>{{ t('editor.title') }}<span>.</span></h1>
      </div>
      <SegmentedControl
        v-model="view"
        class="views"
        :options="views"
        :label="t('editor.viewAria')"
      />
    </div>
    <div class="stage">
      <PlanCanvas v-show="editor.view === '2d'" />
      <PreviewCanvas v-if="editor.view === '3d'" />
      <ToolPalette />
      <div class="badge">
        <span class="live"></span
        ><span id="scene-label">{{
          editor.view === '2d' ? t('editor.scene2d') : t('editor.scene3d')
        }}</span
        ><span id="point-count" class="count">{{
          t('editor.pointCount', { count: String(store.project.points.length).padStart(2, '0') })
        }}</span>
      </div>
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
.heading {
  height: 95px;
  flex-shrink: 0;
  padding: 22px 28px 19px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.eyebrow {
  font-size: 8px;
  letter-spacing: 1.7px;
  font-weight: 650;
  color: var(--muted);
}
h1 {
  font-size: 23px;
  font-weight: 500;
  margin-top: 6px;
  letter-spacing: -0.7px;
}
h1 > span {
  color: var(--accent);
}
.views {
  border: 1px solid var(--line);
  background: var(--panel);
}
.stage {
  position: relative;
  flex: 1;
  min-height: 280px;
  margin: 0 24px;
  background: #1b2924;
  border: 1px solid #364139;
  border-radius: 9px;
  overflow: hidden;
}
.badge {
  position: absolute;
  right: 18px;
  top: 28px;
  font-size: 8px;
  letter-spacing: 1.4px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #a2b49c;
  pointer-events: none;
}
.count {
  padding-left: 10px;
  border-left: 1px solid #476044;
  color: #799176;
  font-family: monospace;
}
.live,
.dot {
  width: 5px;
  height: 5px;
  background: #afc97e;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.live {
  width: 4px;
  height: 4px;
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
@media (min-width: 1500px) {
  .stage {
    margin: 0 32px;
  }
  .heading {
    padding-left: 36px;
    padding-right: 36px;
  }
}
@media (max-width: 1200px) {
  .count,
  .about {
    display: none;
  }
  h1 {
    font-size: 21px;
  }
}
@media (max-width: 950px) {
  .heading {
    padding: 18px;
    height: 90px;
  }
  h1 {
    font-size: 17px;
  }
  .eyebrow {
    font-size: 7px;
  }
  .views {
    --icon-size: 0;
  }
  .stage {
    margin: 0 16px;
  }
  .badge {
    display: none;
  }
}
@media (max-width: 650px) {
  .heading {
    height: 83px;
    padding: 16px;
  }
  .stage {
    margin: 0 12px;
  }
  .footer {
    padding: 12px 18px;
    font-size: 8px;
  }
}
</style>
