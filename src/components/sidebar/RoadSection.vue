<script setup lang="ts">
import { computed } from 'vue';
import { setRoad } from '../../core/project/edits';
import { RULES } from '../../core/project/rules';
import { t } from '../../i18n';
import { useProjectStore } from '../../stores/project';
import RangeField from '../ui/RangeField.vue';
import SidebarSection from '../ui/SidebarSection.vue';
import ToggleField from '../ui/ToggleField.vue';

defineProps<{ index: number }>();
const store = useProjectStore();
const road = computed(() => store.project.road);
const kerbs = computed({
  get: () => road.value.kerbs,
  set: (next) => store.edit((draft) => setRoad(draft, { kerbs: next })),
});
const preview = (patch: Parameters<typeof setRoad>[1]) =>
  store.edit((draft) => setRoad(draft, patch), { commit: false });
</script>

<template>
  <SidebarSection :index="index" :title="t('sidebar.road')">
    <RangeField
      id="track-width"
      :label="t('sidebar.width')"
      :value="road.width"
      :rule="RULES.width"
      @input="preview({ width: $event })"
      @commit="store.commit()"
    />
    <RangeField
      id="track-shoulder"
      :label="t('sidebar.shoulder')"
      :value="road.shoulder"
      :rule="RULES.shoulder"
      @input="preview({ shoulder: $event })"
      @commit="store.commit()"
    />
    <ToggleField
      id="track-kerbs"
      v-model="kerbs"
      :label="t('sidebar.kerbs')"
      :note="t('sidebar.kerbsNote')"
    />
  </SidebarSection>
</template>
