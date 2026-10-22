<script setup lang="ts">
import { computed } from 'vue';
import { updateHill } from '../../core/project/edits';
import type { HillPatch } from '../../core/project/edits';
import { RULES } from '../../core/project/rules';
import { t } from '../../i18n';
import { useEditorStore } from '../../stores/editor';
import { useProjectStore } from '../../stores/project';
import AppButton from '../ui/AppButton.vue';
import AppIcon from '../ui/AppIcon.vue';
import RangeField from '../ui/RangeField.vue';
import SidebarSection from '../ui/SidebarSection.vue';

/** The hills raised on the terrain, and the settings of the selected one. */
const store = useProjectStore();
const editor = useEditorStore();

const hills = computed(() => store.project.hills);
const selected = computed(() => editor.selectedHill);
const sizes = [
  { field: 'width', label: 'hills.width', rule: RULES.hillSize, unit: 'm' },
  { field: 'depth', label: 'hills.depth', rule: RULES.hillSize, unit: 'm' },
  { field: 'height', label: 'hills.height', rule: RULES.hillHeight, unit: 'm' },
  { field: 'heading', label: 'hills.heading', rule: RULES.heading, unit: '°' },
] as const;

/** Changes the selected hill while a control is moved; the step closes on commit. */
function preview(patch: HillPatch) {
  const hill = selected.value;
  if (hill) store.edit((draft) => updateHill(draft, hill.id, patch), { commit: false });
}
</script>

<template>
  <SidebarSection :title="t('hills.title')">
    <template v-if="hills.length" #badge>
      <span id="hill-count">{{
        t('hills.count', { count: String(hills.length).padStart(2, '0') }, hills.length)
      }}</span>
    </template>
    <div v-if="selected" id="hill-editor" class="editor">
      <h2>{{ selected.height < 0 ? t('hills.hollow') : t('hills.hill') }}</h2>
      <RangeField
        v-for="size in sizes"
        :id="`hill-${size.field}`"
        :key="size.field"
        :label="t(size.label)"
        :value="selected[size.field]"
        :rule="size.rule"
        :unit="size.unit"
        @input="preview({ [size.field]: $event })"
        @commit="store.commit()"
      />
      <p class="note">{{ t('hills.heightNote') }}</p>
      <div class="actions">
        <AppButton id="hill-delete" class="delete" small @click="editor.deleteSelectedHill()">
          <AppIcon name="trash" />{{ t('hills.delete') }}
        </AppButton>
      </div>
    </div>
    <p v-else-if="!hills.length" id="hill-empty" class="note">{{ t('hills.empty') }}</p>
  </SidebarSection>
</template>

<style scoped>
.note {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.7;
  margin-top: 12px;
}
.editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
h2 {
  font-size: 12px;
  font-weight: 600;
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
</style>
