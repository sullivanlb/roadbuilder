<script setup lang="ts">
import { setTerrainMargin } from '../../core/project/edits';
import { RULES } from '../../core/project/rules';
import { EARTHWORK_TYPES } from '../../core/project/schema';
import { t } from '../../i18n';
import { useEditorStore } from '../../stores/editor';
import { useProjectStore } from '../../stores/project';
import AppIcon from '../ui/AppIcon.vue';
import RangeField from '../ui/RangeField.vue';
import SidebarSection from '../ui/SidebarSection.vue';

/** The terrain: how far it reaches, and the tools that shape it. */
const store = useProjectStore();
const editor = useEditorStore();

const shapes = [
  { tool: 'hill', label: 'hills.hill' },
  ...EARTHWORK_TYPES.map((type) => ({ tool: type, label: `earthworks.${type}` as const })),
] as const;
</script>

<template>
  <SidebarSection :title="t('sidebar.terrain')">
    <div class="shapes" role="group" :aria-label="t('terrain.shapeAria')">
      <button
        v-for="shape in shapes"
        :id="`terrain-${shape.tool}`"
        :key="shape.tool"
        type="button"
        class="shape"
        :class="{ active: editor.tool === shape.tool }"
        :aria-pressed="editor.tool === shape.tool"
        @click="editor.setTool(shape.tool)"
      >
        <AppIcon :name="shape.tool" />{{ t(shape.label) }}
      </button>
    </div>
    <RangeField
      id="terrain-margin"
      class="margin"
      :label="t('sidebar.terrainMargin')"
      :value="store.project.terrain.margin"
      :rule="RULES.terrainMargin"
      @input="store.edit((draft) => setTerrainMargin(draft, $event), { commit: false })"
      @commit="store.commit()"
    />
    <p class="note">{{ t('sidebar.terrainNote') }}</p>
  </SidebarSection>
</template>

<style scoped>
.note {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.7;
  margin-top: 12px;
}
.shapes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 4px;
}
.shape {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--field);
  border: 1px solid #303d41;
  border-radius: 4px;
  color: #b9c4c2;
  font-size: 10px;
  padding: 6px 8px;
}
.shape:hover {
  border-color: #3b4946;
  color: var(--text);
}
.shape.active {
  border-color: var(--accent);
  color: var(--accent);
}
.shape :deep(svg) {
  width: 14px;
  height: 14px;
}
.margin {
  margin-top: 16px;
}
</style>
