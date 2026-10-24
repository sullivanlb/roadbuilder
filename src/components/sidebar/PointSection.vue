<script setup lang="ts">
import { computed } from 'vue';
import { updatePoint } from '../../core/project/edits';
import { RULES } from '../../core/project/rules';
import { formatTrackIssue, t } from '../../i18n';
import { useEditorStore } from '../../stores/editor';
import { useProjectStore } from '../../stores/project';
import AppButton from '../ui/AppButton.vue';
import AppIcon from '../ui/AppIcon.vue';
import NumberInput from '../ui/NumberInput.vue';
import SidebarSection from '../ui/SidebarSection.vue';

const store = useProjectStore();
const editor = useEditorStore();
const point = computed(() => editor.selectedPoint);

function preview(axis: 'x' | 'y' | 'z', value: number) {
  const id = editor.selectedPointId;
  if (id) store.edit((draft) => updatePoint(draft, id, { [axis]: value }), { commit: false });
}
</script>

<template>
  <SidebarSection :title="t('point.title')" last>
    <template v-if="point" #badge>
      <span id="point-badge">{{
        t('point.badge', { index: String(editor.selectedIndex + 1).padStart(2, '0') })
      }}</span>
    </template>
    <div v-if="point" id="point-editor">
      <div v-if="editor.selectedIssues.length" id="point-issues" class="issues" role="status">
        <p v-for="(location, position) in editor.selectedIssues" :key="position">
          {{ formatTrackIssue(location.issue) }}
        </p>
      </div>
      <div class="altitude">
        <label for="point-altitude">{{ t('point.altitude') }}</label>
        <span class="unit-input">
          <NumberInput
            id="point-altitude"
            :value="point.y"
            :rule="RULES.altitude"
            :precision="2"
            @input="preview('y', $event)"
            @commit="store.commit()"
          /><span>m</span>
        </span>
      </div>
      <NumberInput
        id="point-height"
        class="slider"
        type="range"
        :value="point.y"
        :rule="RULES.altitude"
        :aria-label="t('point.altitudeAria')"
        @input="preview('y', $event)"
        @commit="store.commit()"
      />
      <div class="coordinates">
        <label v-for="axis in ['x', 'z'] as const" :key="axis"
          >{{ axis.toUpperCase() }}
          <NumberInput
            :id="`point-${axis}`"
            :value="point[axis]"
            :rule="RULES.coordinate"
            :precision="1"
            @input="preview(axis, $event)"
            @commit="store.commit()"
        /></label>
      </div>
      <div class="actions">
        <AppButton
          id="point-previous"
          small
          :disabled="editor.selectedIndex <= 0"
          :aria-label="t('point.previous')"
          @click="editor.selectPointAt(editor.selectedIndex - 1)"
          >←</AppButton
        ><AppButton
          id="point-next"
          small
          :disabled="editor.selectedIndex >= store.project.points.length - 1"
          :aria-label="t('point.next')"
          @click="editor.selectPointAt(editor.selectedIndex + 1)"
          >→</AppButton
        ><AppButton id="delete-point" class="delete" small @click="editor.deleteSelection()">
          <AppIcon name="trash" />{{ t('point.delete') }}
        </AppButton>
      </div>
    </div>
    <p v-else id="point-empty" class="note">{{ t('point.empty') }}</p>
  </SidebarSection>
</template>

<style scoped>
.note {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.7;
  margin-top: 12px;
}
.issues {
  color: var(--danger-text);
  background: var(--danger-bg);
  border: 1px solid #794a40;
  border-radius: 5px;
  padding: 10px;
  margin-bottom: 16px;
  font-size: 11px;
  line-height: 1.6;
}
.issues p + p {
  margin-top: 8px;
}
.altitude {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  margin-bottom: 14px;
}
.unit-input {
  display: flex;
  align-items: center;
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  background: #111a1d;
  padding-right: 8px;
  color: var(--muted);
}
.unit-input input {
  background: none;
  color: var(--text);
  border: 0;
  width: 68px;
  padding: 7px;
  font-family: monospace;
  font-size: 12px;
}
.slider {
  display: block;
  width: 100%;
  accent-color: var(--accent);
}
.coordinates {
  display: flex;
  gap: 10px;
  margin-top: 17px;
}
.coordinates label {
  color: var(--faint);
  display: flex;
  align-items: center;
  gap: 7px;
  width: 50%;
  font-family: monospace;
  font-size: 10px;
}
.coordinates input {
  min-width: 0;
  width: 100%;
  background: var(--field);
  border: 1px solid #303d41;
  color: #b9c4c2;
  border-radius: 4px;
  padding: 6px;
  font-size: 10px;
  font-family: monospace;
}
.actions {
  display: flex;
  gap: 5px;
  margin-top: 12px;
}
.delete {
  margin-left: auto;
}
.delete:hover {
  color: var(--red);
}
@media (max-width: 650px) {
  .unit-input input {
    width: 100px;
  }
}
</style>
