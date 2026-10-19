<script setup lang="ts">
import { computed } from 'vue';
import { reverseTrack, setClosed, setStartLine } from '../../core/project/edits';
import { startLinePosition } from '../../core/track/positions';
import { t } from '../../i18n';
import { useProjectStore } from '../../stores/project';
import SegmentedControl from '../ui/SegmentedControl.vue';
import SidebarSection from '../ui/SidebarSection.vue';
import TrackPositionField from './TrackPositionField.vue';

defineProps<{ index: number }>();
const store = useProjectStore();

const mode = computed({
  get: () => (store.project.road.closed ? 'closed' : 'open'),
  set: (next) => store.edit((draft) => setClosed(draft, next === 'closed')),
});
const startLine = computed(() => startLinePosition(store.project));
const modes = computed(() => [
  {
    value: 'closed' as const,
    label: t('sidebar.closed'),
    icon: 'flag' as const,
    id: 'mode-closed',
  },
  { value: 'open' as const, label: t('sidebar.open'), icon: 'route' as const, id: 'mode-open' },
]);
</script>

<template>
  <SidebarSection :index="index" :title="t('sidebar.track')">
    <SegmentedControl v-model="mode" :options="modes" :label="t('sidebar.modeAria')" />
    <p class="note">
      {{ store.project.road.closed ? t('sidebar.closedNote') : t('sidebar.openNote') }}
    </p>
    <TrackPositionField
      v-if="startLine"
      id="start-line"
      :label="t('sidebar.startLine')"
      :position="startLine"
      @input="store.edit((draft) => setStartLine(draft, $event), { commit: false })"
      @commit="store.commit()"
    />
    <button id="reverse-track" type="button" class="reverse" @click="store.edit(reverseTrack)">
      {{ t('sidebar.reverse') }} <span>⇄</span>
    </button>
  </SidebarSection>
</template>

<style scoped>
.note {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.7;
  margin-top: 12px;
}
.reverse {
  display: flex;
  justify-content: space-between;
  border: none;
  background: none;
  color: #b5bfbd;
  padding: 0;
  width: 100%;
  font-size: 11px;
  margin-top: 16px;
}
.reverse:hover {
  color: var(--accent);
}
.reverse span {
  font-size: 17px;
  line-height: 12px;
}
</style>
