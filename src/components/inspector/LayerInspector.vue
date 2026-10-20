<script setup lang="ts">
import { t } from '../../i18n';
import { useEditorStore } from '../../stores/editor';
import BarrierSection from '../sidebar/BarrierSection.vue';
import PitSection from '../sidebar/PitSection.vue';
import PointSection from '../sidebar/PointSection.vue';
import RoadSection from '../sidebar/RoadSection.vue';
import StartSection from '../sidebar/StartSection.vue';
import TerrainSection from '../sidebar/TerrainSection.vue';
import TrackSection from '../sidebar/TrackSection.vue';
import WidthSection from '../sidebar/WidthSection.vue';

/** The settings of the active layer and of what is selected in it. */
const editor = useEditorStore();
</script>

<template>
  <aside id="inspector" class="inspector" :aria-label="t('inspector.aria')">
    <h1>{{ t(`layers.${editor.layer}`) }}</h1>
    <template v-if="editor.layer === 'track'">
      <TrackSection />
      <PointSection />
    </template>
    <template v-else-if="editor.layer === 'road'">
      <RoadSection />
      <WidthSection />
    </template>
    <BarrierSection v-else-if="editor.layer === 'edges'" />
    <template v-else-if="editor.layer === 'pits'">
      <StartSection />
      <PitSection />
    </template>
    <TerrainSection v-else-if="editor.layer === 'terrain'" />
    <p v-else id="inspector-planned" class="planned">{{ t('inspector.decor') }}</p>
  </aside>
</template>

<style scoped>
.inspector {
  background: var(--panel);
  border-left: 1px solid var(--line);
  padding: 18px 20px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #3b494c transparent;
}
h1 {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.3px;
}
.planned {
  margin-top: 18px;
  border: 1px dashed var(--line-strong);
  border-radius: 8px;
  padding: 14px;
  font-size: 11px;
  line-height: 1.7;
  color: var(--muted);
}
@media (max-width: 860px) {
  .inspector {
    border-left: 0;
    border-top: 1px solid var(--line);
  }
}
</style>
