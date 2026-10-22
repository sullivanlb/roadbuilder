<script setup lang="ts">
import { computed } from 'vue';
import { RULES } from '../../core/project/rules';
import { BRUSH_MODES } from '../../core/project/sculpt';
import type { BrushMode } from '../../core/project/sculpt';
import { t } from '../../i18n';
import { useEditorStore } from '../../stores/editor';
import { useProjectStore } from '../../stores/project';
import AppButton from '../ui/AppButton.vue';
import AppIcon from '../ui/AppIcon.vue';
import RangeField from '../ui/RangeField.vue';
import SegmentedControl from '../ui/SegmentedControl.vue';
import SidebarSection from '../ui/SidebarSection.vue';

/** The brush: what it does, how far it reaches and how fast, and the relief it painted. */
const store = useProjectStore();
const editor = useEditorStore();

const mode = computed({
  get: () => editor.brushMode,
  set: (next: BrushMode) => {
    editor.brushMode = next;
    editor.setTool('sculpt');
  },
});
const modes = BRUSH_MODES.map((value) => ({
  value,
  label: t(`sculpt.${value}`),
  id: `brush-${value}`,
}));
const tiles = computed(() => store.project.sculpt.length);
</script>

<template>
  <SidebarSection :title="t('sculpt.title')">
    <SegmentedControl v-model="mode" :options="modes" :label="t('sculpt.modeAria')" compact />
    <div class="fields">
      <RangeField
        id="brush-radius"
        :label="t('sculpt.radius')"
        :value="editor.brushRadius"
        :rule="RULES.brushRadius"
        @input="editor.brushRadius = $event"
        @commit="editor.setTool('sculpt')"
      />
      <RangeField
        id="brush-strength"
        :label="t('sculpt.strength')"
        :value="editor.brushStrength"
        :rule="RULES.brushStrength"
        unit="m/s"
        @input="editor.brushStrength = $event"
        @commit="editor.setTool('sculpt')"
      />
    </div>
    <p class="note">{{ t('sculpt.note') }}</p>
    <template v-if="tiles">
      <p id="sculpt-painted" class="note">{{ t('sculpt.painted', { count: tiles }, tiles) }}</p>
      <div class="actions">
        <AppButton id="sculpt-clear" class="delete" small @click="editor.clearPaintedRelief()">
          <AppIcon name="trash" />{{ t('sculpt.clear') }}
        </AppButton>
      </div>
    </template>
  </SidebarSection>
</template>

<style scoped>
.note {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.7;
  margin-top: 12px;
}
.fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
}
.actions {
  display: flex;
  margin-top: 8px;
}
.delete:hover {
  color: var(--red);
}
</style>
