<script setup lang="ts">
import { computed } from 'vue';
import { formatNumber, formatTrackIssue, t } from '../../i18n';
import { useEditorStore } from '../../stores/editor';
import { useProjectStore } from '../../stores/project';
import AppButton from '../ui/AppButton.vue';
import AppIcon from '../ui/AppIcon.vue';
import SidebarSection from '../ui/SidebarSection.vue';

/** Several control points selected together: their altitude and their removal. */
const store = useProjectStore();
const editor = useEditorStore();

const points = computed(() =>
  store.project.points.filter((point) => editor.selectedPointIds.includes(point.id)),
);
const average = computed(
  () => points.value.reduce((sum, point) => sum + point.y, 0) / (points.value.length || 1),
);
const issues = computed(() =>
  store.issues.locations.filter((location) =>
    location.pointIds.some((id) => editor.selectedPointIds.includes(id)),
  ),
);
</script>

<template>
  <SidebarSection :title="t('points.title', { count: points.length })" last>
    <div id="points-editor">
      <div v-if="issues.length" id="points-issues" class="issues" role="status">
        <p v-for="(location, position) in issues" :key="position">
          {{ formatTrackIssue(location.issue) }}
        </p>
      </div>
      <p id="points-average" class="note">
        {{ t('points.average', { altitude: formatNumber(average, 1) }) }}
      </p>
      <span class="label">{{ t('points.altitude') }}</span>
      <div class="actions">
        <AppButton id="points-down" small @click="editor.shiftSelectedAltitude(-1)">−1 m</AppButton>
        <AppButton id="points-up" small @click="editor.shiftSelectedAltitude(1)">+1 m</AppButton>
        <AppButton id="points-flatten" small @click="editor.flattenSelected()">{{
          t('points.flatten')
        }}</AppButton>
      </div>
      <div class="actions">
        <AppButton id="points-delete" class="delete" small @click="editor.deleteSelection()">
          <AppIcon name="trash" />{{ t('points.delete', { count: points.length }) }}
        </AppButton>
      </div>
      <p class="note">{{ t('points.hint') }}</p>
    </div>
  </SidebarSection>
</template>

<style scoped>
.note {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.7;
  margin-top: 12px;
}
.label {
  display: block;
  font-size: 11px;
  margin-top: 14px;
}
.issues {
  color: var(--danger-text);
  background: var(--danger-bg);
  border: 1px solid #794a40;
  border-radius: 5px;
  padding: 10px;
  margin-bottom: 8px;
  font-size: 11px;
  line-height: 1.6;
}
.issues p + p {
  margin-top: 8px;
}
.actions {
  display: flex;
  gap: 5px;
  margin-top: 8px;
}
.delete {
  margin-top: 8px;
}
.delete:hover {
  color: var(--red);
}
</style>
