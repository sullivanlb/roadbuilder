<script setup lang="ts">
import { computed } from 'vue';
import { setStartLine } from '../../core/project/edits';
import { startLinePosition } from '../../core/track/positions';
import { t } from '../../i18n';
import { useProjectStore } from '../../stores/project';
import SidebarSection from '../ui/SidebarSection.vue';
import TrackPositionField from './TrackPositionField.vue';

const store = useProjectStore();
const startLine = computed(() => startLinePosition(store.project));
</script>

<template>
  <SidebarSection :title="t('start.title')">
    <TrackPositionField
      v-if="startLine"
      id="start-line"
      :label="t('sidebar.startLine')"
      :position="startLine"
      @input="store.edit((draft) => setStartLine(draft, $event), { commit: false })"
      @commit="store.commit()"
    />
  </SidebarSection>
</template>
