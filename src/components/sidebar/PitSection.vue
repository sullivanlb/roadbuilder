<script setup lang="ts">
import { computed } from 'vue';
import { opposite, removePitLane, setCars, updatePitLane } from '../../core/project/edits';
import { RULES } from '../../core/project/rules';
import { isCircuit } from '../../core/project/schema';
import type { PitLane } from '../../core/project/schema';
import { t } from '../../i18n';
import { useEditorStore } from '../../stores/editor';
import { useProjectStore } from '../../stores/project';
import AppButton from '../ui/AppButton.vue';
import AppIcon from '../ui/AppIcon.vue';
import RangeField from '../ui/RangeField.vue';
import SidebarSection from '../ui/SidebarSection.vue';
import TrackPositionField from './TrackPositionField.vue';

defineProps<{ index: number }>();
const store = useProjectStore();
const editor = useEditorStore();

const circuit = computed(() => isCircuit(store.project));
const lane = computed(() => store.project.pitLane);
const status = computed(() => {
  if (editor.pitDraft) return t('pits.statusDraft');
  if (editor.tool === 'pits') return t('pits.statusTool');
  return null;
});

const preview = (patch: Partial<PitLane>) =>
  store.edit((draft) => updatePitLane(draft, patch), { commit: false });
</script>

<template>
  <SidebarSection :index="index" :title="t('pits.title')">
    <template v-if="lane" #badge>
      <span id="pit-cars">{{ store.project.cars }} {{ t('pits.carsUnit').toUpperCase() }}</span>
    </template>
    <p v-if="!circuit" id="pits-road" class="note">{{ t('pits.roadOnly') }}</p>
    <template v-else-if="!lane">
      <p id="pits-empty" class="note">{{ t('pits.empty') }}</p>
      <AppButton
        id="pits-draw"
        class="draw"
        :class="{ active: editor.tool === 'pits' }"
        variant="secondary"
        small
        @click="editor.setTool('pits')"
      >
        <AppIcon name="pits" />{{ t('pits.draw') }} <kbd>P</kbd>
      </AppButton>
      <p v-if="status" id="pits-status" class="note">{{ status }}</p>
    </template>
    <div v-else id="pit-editor">
      <RangeField
        id="pit-cars-count"
        :label="t('pits.cars')"
        :value="store.project.cars"
        :rule="RULES.cars"
        :unit="t('pits.carsUnit')"
        @input="store.edit((draft) => setCars(draft, $event), { commit: false })"
        @commit="store.commit()"
      />
      <RangeField
        id="pit-width"
        :label="t('pits.width')"
        :value="lane.width"
        :rule="RULES.pitLaneWidth"
        @input="preview({ width: $event })"
        @commit="store.commit()"
      />
      <TrackPositionField
        id="pit-entry"
        :label="t('pits.entry')"
        :position="lane.entry"
        @input="preview({ entry: $event })"
        @commit="store.commit()"
      />
      <TrackPositionField
        id="pit-exit"
        :label="t('pits.exit')"
        :position="lane.exit"
        @input="preview({ exit: $event })"
        @commit="store.commit()"
      />
      <p class="note">{{ lane.side === 'right' ? t('pits.sideRight') : t('pits.sideLeft') }}</p>
      <div class="actions">
        <AppButton
          id="pit-swap"
          small
          @click="store.edit((draft) => updatePitLane(draft, { side: opposite(lane!.side) }))"
        >
          <AppIcon name="move" />{{ t('barriers.swap') }}
        </AppButton>
        <AppButton id="pit-delete" class="delete" small @click="store.edit(removePitLane)">
          <AppIcon name="trash" />{{ t('pits.delete') }}
        </AppButton>
      </div>
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
.draw {
  width: 100%;
  margin-top: 14px;
}
.draw.active {
  border-color: var(--accent);
  color: var(--accent);
}
.draw kbd {
  font-size: 9px;
  color: var(--muted);
  background: none;
  border: 1px solid var(--line-strong);
  padding: 1px 4px;
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
