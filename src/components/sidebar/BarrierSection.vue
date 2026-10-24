<script setup lang="ts">
import { computed } from 'vue';
import { updateBarrier } from '../../core/project/edits';
import { RULES } from '../../core/project/rules';
import { BARRIER_TYPES } from '../../core/project/schema';
import type { Barrier, BarrierType } from '../../core/project/schema';
import { t } from '../../i18n';
import { BARRIER_STYLE } from '../../rendering/theme';
import { useEditorStore } from '../../stores/editor';
import { useProjectStore } from '../../stores/project';
import AppButton from '../ui/AppButton.vue';
import AppIcon from '../ui/AppIcon.vue';
import RangeField from '../ui/RangeField.vue';
import SegmentedControl from '../ui/SegmentedControl.vue';
import SidebarSection from '../ui/SidebarSection.vue';
import TrackPositionField from './TrackPositionField.vue';
import { usePlaceLabel } from './usePlaceLabel';

const store = useProjectStore();
const editor = useEditorStore();

const barriers = computed(() => store.project.barriers);
const selected = computed(() => editor.selectedBarrier);
const place = usePlaceLabel();

const type = computed({
  get: () => selected.value?.type ?? editor.barrierType,
  set: (next: BarrierType) => editor.setBarrierType(next),
});
const types = computed(() =>
  BARRIER_TYPES.map((value) => ({
    value,
    label: t(`barriers.${value}`),
    id: `barrier-type-${value}`,
  })),
);
const typeNote = computed(
  () =>
    (selected.value ? t('barriers.selectedNote') : t('barriers.nextNote')) +
    t(`barriers.${type.value}Note`),
);
const status = computed(() => {
  const laying = editor.laying;
  if (laying?.kind === 'barrier')
    return t('barriers.statusDraft', {
      side:
        laying.from.side === 'right' ? t('barriers.sideRightShort') : t('barriers.sideLeftShort'),
    });
  if (editor.tool === 'barrier') return t('barriers.statusTool');
  if (selected.value) return t('barriers.statusSelected');
  return barriers.value.length ? t('barriers.statusChoose') : t('barriers.statusEmpty');
});
const summary = computed(() => {
  const counts = new Map<BarrierType, number>();
  for (const barrier of barriers.value)
    counts.set(barrier.type, (counts.get(barrier.type) ?? 0) + 1);
  return [...counts].map(([kind, count]) => `${count} × ${t(`barriers.${kind}`)}`).join(' · ');
});
const rowLabel = (barrier: Barrier, index: number) =>
  t('barriers.row', {
    index: String(index + 1).padStart(2, '0'),
    type: t(`barriers.${barrier.type}`),
    side: barrier.side === 'right' ? t('barriers.sideRight') : t('barriers.sideLeft'),
    from: place(barrier.from),
    to: place(barrier.to),
  });

function preview(patch: Parameters<typeof updateBarrier>[2]) {
  const barrier = selected.value;
  if (barrier) store.edit((draft) => updateBarrier(draft, barrier.id, patch), { commit: false });
}
</script>

<template>
  <SidebarSection :title="t('barriers.title')">
    <template v-if="barriers.length" #badge>
      <span id="barrier-count">{{
        t('barriers.count', { count: String(barriers.length).padStart(2, '0') }, barriers.length)
      }}</span>
    </template>
    <SegmentedControl v-model="type" :options="types" :label="t('barriers.typeAria')" compact />
    <p id="barrier-type-note" class="note">{{ typeNote }}</p>
    <AppButton
      id="barrier-draw"
      class="draw"
      :class="{ active: editor.tool === 'barrier' }"
      variant="secondary"
      small
      @click="editor.setTool('barrier')"
    >
      <AppIcon name="wall" />{{ t('barriers.draw') }} <kbd>B</kbd>
    </AppButton>
    <p id="barrier-status" class="note">{{ status }}</p>
    <div v-if="barriers.length" class="rows">
      <button
        v-for="(barrier, position) in barriers"
        :id="`barrier-row-${position}`"
        :key="barrier.id"
        type="button"
        class="row"
        :class="{ active: barrier.id === selected?.id }"
        :title="rowLabel(barrier, position)"
        @click="editor.select({ kind: 'barrier', id: barrier.id })"
      >
        <span class="swatch" :style="{ background: BARRIER_STYLE[barrier.type].color }"></span
        >{{ rowLabel(barrier, position) }}
      </button>
    </div>
    <div v-if="selected" id="barrier-editor" class="editor">
      <RangeField
        id="barrier-offset"
        :label="t('barriers.offset')"
        :value="selected.offset"
        :rule="RULES.barrierOffset"
        :min-label="t('barriers.offsetMin')"
        @input="preview({ offset: $event })"
        @commit="store.commit()"
      />
      <TrackPositionField
        id="barrier-from"
        :label="t('barriers.from')"
        :position="selected.from"
        @input="preview({ from: $event })"
        @commit="store.commit()"
      />
      <TrackPositionField
        id="barrier-to"
        :label="t('barriers.to')"
        :position="selected.to"
        @input="preview({ to: $event })"
        @commit="store.commit()"
      />
      <div class="actions">
        <AppButton id="barrier-swap" small @click="editor.swapSelectedBarrierSide()">
          <AppIcon name="move" />{{ t('barriers.swap') }}
        </AppButton>
        <AppButton id="barrier-delete" class="delete" small @click="editor.deleteSelection()">
          <AppIcon name="trash" />{{ t('barriers.delete') }}
        </AppButton>
      </div>
    </div>
    <p v-else-if="barriers.length" id="barrier-summary" class="note">{{ summary }}</p>
    <p v-else id="barrier-empty" class="note">{{ t('barriers.empty') }}</p>
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
.rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 12px;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  background: var(--field);
  border: 1px solid #303d41;
  border-radius: 4px;
  color: #b9c4c2;
  font-size: 10px;
  padding: 6px 8px;
}
.row:hover {
  border-color: #3b4946;
  color: var(--text);
}
.row.active {
  border-color: var(--accent);
  color: var(--accent);
}
.swatch {
  flex: none;
  width: 14px;
  height: 4px;
  border-radius: 2px;
}
.editor {
  margin-top: 16px;
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
