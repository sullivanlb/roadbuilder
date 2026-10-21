<script setup lang="ts">
import { computed } from 'vue';
import { updateScenery } from '../../core/project/edits';
import type { SceneryPatch } from '../../core/project/edits';
import { RULES } from '../../core/project/rules';
import { editableSize, SCENERY_SIZES } from '../../core/project/scenery';
import { SCENERY_KINDS, SCENERY_VARIANTS } from '../../core/project/schema';
import type { SceneryKind, SceneryLook } from '../../core/project/schema';
import { t } from '../../i18n';
import type { MessageKey } from '../../i18n';
import { useEditorStore } from '../../stores/editor';
import { useProjectStore } from '../../stores/project';
import AppButton from '../ui/AppButton.vue';
import AppIcon from '../ui/AppIcon.vue';
import type { IconName } from '../ui/icons';
import RangeField from '../ui/RangeField.vue';
import SegmentedControl from '../ui/SegmentedControl.vue';
import SidebarSection from '../ui/SidebarSection.vue';
import ToggleField from '../ui/ToggleField.vue';

/** The scenery items: the kinds to place, and the settings of the selected ones. */
const store = useProjectStore();
const editor = useEditorStore();

const KIND_ICON: Record<SceneryKind, IconName> = {
  tree: 'trees',
  building: 'building',
  grandstand: 'grandstands',
  sign: 'sign',
  light: 'light',
};
const SIZES = ['width', 'depth', 'height'] as const;

const items = computed(() => store.project.scenery);
const selected = computed(() => editor.selectedScenery);
/** Selected items standing on the track, reported by the track checks. */
const onTrack = computed(() => {
  const issue = store.issues.warnings.find((warning) => warning.code === 'scenery-on-track');
  const ids = issue?.code === 'scenery-on-track' ? issue.ids : [];
  return selected.value.some((item) => ids.includes(item.id));
});
/** The item whose settings are shown: the selection, when it holds a single one. */
const single = computed(() => (selected.value.length === 1 ? selected.value[0] : null));

const variant = computed({
  get: () => single.value?.variant ?? SCENERY_VARIANTS.tree[0],
  set: (next: SceneryLook) => edit({ variant: next }),
});
const variants = computed(() =>
  (single.value ? SCENERY_VARIANTS[single.value.kind] : []).map((value) => ({
    value,
    label: t(`scenery.${value}`),
    id: `scenery-variant-${value}`,
  })),
);
/** The sizes the selected item's kind lets change, with their label. */
const sizes = computed(() => {
  const item = single.value;
  if (!item) return [];
  return SIZES.filter((size) => editableSize(item.kind, size)).map((size) => ({
    size,
    rule: SCENERY_SIZES[item.kind][size],
    label: t(
      (size === 'width' && item.kind === 'tree'
        ? 'scenery.spread'
        : size === 'width' && item.kind === 'light'
          ? 'scenery.reach'
          : `scenery.${size}`) as MessageKey,
    ),
  }));
});
const solid = computed({
  get: () => selected.value.length > 0 && selected.value.every((item) => item.solid),
  set: (next: boolean) =>
    store.edit((draft) => {
      for (const item of selected.value) updateScenery(draft, item.id, { solid: next });
    }),
});
const summary = computed(() => {
  const counts = new Map<SceneryKind, number>();
  for (const item of items.value) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  return [...counts].map(([kind, count]) => `${count} × ${t(`scenery.${kind}`)}`).join(' · ');
});

/** Changes the selected item while a control is moved; the step closes on commit. */
function preview(patch: SceneryPatch) {
  const item = single.value;
  if (item) store.edit((draft) => updateScenery(draft, item.id, patch), { commit: false });
}

function edit(patch: SceneryPatch) {
  const item = single.value;
  if (item) store.edit((draft) => updateScenery(draft, item.id, patch));
}
</script>

<template>
  <SidebarSection :title="t('scenery.title')">
    <template v-if="items.length" #badge>
      <span id="scenery-count">{{
        t('scenery.count', { count: String(items.length).padStart(2, '0') }, items.length)
      }}</span>
    </template>
    <div class="kinds" role="group" :aria-label="t('scenery.placeAria')">
      <button
        v-for="kind in SCENERY_KINDS"
        :id="`scenery-place-${kind}`"
        :key="kind"
        type="button"
        class="kind"
        :class="{ active: editor.tool === kind }"
        :aria-pressed="editor.tool === kind"
        @click="editor.setTool(kind)"
      >
        <AppIcon :name="KIND_ICON[kind]" />{{ t(`scenery.${kind}`) }}
      </button>
    </div>
    <div v-if="single" id="scenery-editor" class="editor">
      <h2>{{ t(`scenery.${single.kind}`) }}</h2>
      <SegmentedControl
        v-if="variants.length"
        v-model="variant"
        :options="variants"
        :label="t('scenery.variantAria')"
        compact
      />
      <RangeField
        v-for="field in sizes"
        :id="`scenery-${field.size}`"
        :key="field.size"
        :label="field.label"
        :value="single[field.size]"
        :rule="field.rule"
        @input="preview({ [field.size]: $event })"
        @commit="store.commit()"
      />
      <RangeField
        v-if="single.kind === 'tree'"
        id="scenery-trees"
        :label="t('scenery.trees')"
        :value="single.count ?? 1"
        :rule="RULES.groveCount"
        unit=""
        @input="preview({ count: $event })"
        @commit="store.commit()"
      />
      <RangeField
        v-if="single.kind !== 'tree'"
        id="scenery-heading"
        :label="t('scenery.heading')"
        :value="single.heading"
        :rule="RULES.heading"
        unit="°"
        @input="preview({ heading: $event })"
        @commit="store.commit()"
      />
    </div>
    <p v-else-if="selected.length" id="scenery-selected" class="note">
      {{ t('scenery.selected', { count: selected.length }, selected.length) }}
    </p>
    <template v-if="selected.length">
      <p v-if="onTrack" id="scenery-on-track" class="note warning" role="status">
        {{ t('scenery.onTrack') }}
      </p>
      <ToggleField
        id="scenery-solid"
        v-model="solid"
        :label="t('scenery.solid')"
        :note="t('scenery.solidNote')"
      />
      <p v-if="selected.some((item) => item.kind === 'light')" class="note">
        {{ t('scenery.lightsNote') }}
      </p>
      <div class="actions">
        <AppButton id="scenery-duplicate" small @click="editor.duplicateSelectedScenery()">
          <AppIcon name="plus" />{{ t('scenery.duplicate') }}
        </AppButton>
        <AppButton id="scenery-delete" class="delete" small @click="editor.deleteSelectedScenery()">
          <AppIcon name="trash" />{{ t('scenery.delete') }}
        </AppButton>
      </div>
    </template>
    <p v-else-if="items.length" id="scenery-summary" class="note">{{ summary }}</p>
    <p v-else id="scenery-empty" class="note">{{ t('scenery.empty') }}</p>
    <p class="note">{{ t('scenery.note') }}</p>
  </SidebarSection>
</template>

<style scoped>
.note {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.7;
  margin-top: 12px;
}
.kinds {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  gap: 4px;
}
.kind {
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
.kind:hover {
  border-color: #3b4946;
  color: var(--text);
}
.kind.active {
  border-color: var(--accent);
  color: var(--accent);
}
.kind :deep(svg) {
  width: 14px;
  height: 14px;
}
.editor {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
h2 {
  font-size: 12px;
  font-weight: 600;
}
.warning {
  color: var(--red);
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
