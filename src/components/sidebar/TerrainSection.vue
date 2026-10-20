<script setup lang="ts">
import { setTerrainMargin } from '../../core/project/edits';
import { RULES } from '../../core/project/rules';
import { t } from '../../i18n';
import { useProjectStore } from '../../stores/project';
import RangeField from '../ui/RangeField.vue';
import SidebarSection from '../ui/SidebarSection.vue';

const store = useProjectStore();
</script>

<template>
  <SidebarSection :title="t('sidebar.terrain')">
    <RangeField
      id="terrain-margin"
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
</style>
