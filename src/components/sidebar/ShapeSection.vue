<script setup lang="ts">
import type { Draft } from 'immer';
import { computed } from 'vue';
import { planDistance } from '../../core/math';
import { roundPoint, setRadius, setSegmentLength, setStraight } from '../../core/project/edits';
import { RULES } from '../../core/project/rules';
import { isCircuit } from '../../core/project/schema';
import type { Project } from '../../core/project/schema';
import { corners, straightSide } from '../../core/track/geometry';
import { t } from '../../i18n';
import { useEditorStore } from '../../stores/editor';
import { useProjectStore } from '../../stores/project';
import AppButton from '../ui/AppButton.vue';
import AppIcon from '../ui/AppIcon.vue';
import NumberInput from '../ui/NumberInput.vue';
import SegmentedControl from '../ui/SegmentedControl.vue';
import SidebarSection from '../ui/SidebarSection.vue';

/** The shape of the track at the selected point: its rounding and the segment leaving it. */
const store = useProjectStore();
const editor = useEditorStore();
const point = computed(() => editor.selectedPoint);
const index = computed(() => editor.selectedIndex);
const arcs = computed(() => corners(store.project));
const corner = computed(() => arcs.value.get(index.value));

const circuit = computed(() => isCircuit(store.project));
const last = computed(() => store.project.points.length - 1);
/** Only a point with a neighbour on each side can be rounded. */
const roundable = computed(() => circuit.value || (index.value > 0 && index.value < last.value));
const hasNext = computed(() => circuit.value || index.value < last.value);
const next = computed(() => store.project.points[(index.value + 1) % store.project.points.length]);
/** A segment touching a rounded point is one of its straight sides. */
const forced = computed(
  () =>
    hasNext.value &&
    (arcs.value.has(index.value) ||
      arcs.value.has((index.value + 1) % store.project.points.length)),
);
const straight = computed(
  () => !!straightSide(store.project, arcs.value, index.value, 'after') && hasNext.value,
);
const length = computed(() => (next.value ? planDistance(point.value, next.value) : 0));

const id = () => point.value.id;
/** Edits the project; a value being typed or dragged is committed once settled. */
const edit = (recipe: (draft: Draft<Project>) => void, commit = true) =>
  store.edit(recipe, { commit });

const shapes = computed(() => [
  { value: 'curve' as const, label: t('shape.curve'), id: 'shape-curve' },
  { value: 'straight' as const, label: t('shape.straight'), id: 'shape-straight' },
]);
const segment = computed({
  get: () => (point.value.straight ? 'straight' : 'curve'),
  set: (shape: 'curve' | 'straight') =>
    edit((draft) => setStraight(draft, id(), shape === 'straight')),
});
</script>

<template>
  <SidebarSection :title="t('shape.title')">
    <div id="shape-editor">
      <template v-if="!roundable">
        <p id="shape-ends" class="note">{{ t('shape.ends') }}</p>
      </template>
      <template v-else-if="point.radius !== undefined">
        <div class="field">
          <label for="shape-radius">{{ t('shape.radius') }}</label>
          <span class="unit-input">
            <NumberInput
              id="shape-radius"
              :value="point.radius"
              :rule="RULES.radius"
              @input="edit((draft) => setRadius(draft, id(), $event), false)"
              @commit="store.commit()"
            /><span>m</span>
          </span>
        </div>
        <p v-if="corner" id="shape-turn" class="note">
          {{ t('shape.turn', { angle: Math.round((corner.angle * 180) / Math.PI) }) }}
        </p>
        <p
          v-if="corner && corner.radius < corner.requested * (1 - 1e-6)"
          id="shape-reduced"
          class="note warning"
        >
          {{ t('shape.reduced', { actual: Math.round(corner.radius) }) }}
        </p>
        <AppButton
          id="shape-unround"
          small
          variant="secondary"
          @click="edit((draft) => setRadius(draft, id(), null))"
        >
          {{ t('shape.unround') }}
        </AppButton>
      </template>
      <AppButton
        v-else
        id="shape-round"
        class="wide"
        small
        variant="secondary"
        @click="edit((draft) => roundPoint(draft, id()))"
      >
        <AppIcon name="arc" />{{ t('shape.round') }}
      </AppButton>

      <template v-if="hasNext">
        <h3>{{ t('shape.next') }}</h3>
        <p v-if="forced" id="shape-forced" class="note">{{ t('shape.forced') }}</p>
        <SegmentedControl
          v-else
          v-model="segment"
          :options="shapes"
          :label="t('shape.next')"
          compact
        />
        <div v-if="straight" class="field">
          <label for="shape-length">{{ t('shape.length') }}</label>
          <span class="unit-input">
            <NumberInput
              id="shape-length"
              :value="Math.round(length * 10) / 10"
              :rule="RULES.segmentLength"
              :precision="1"
              @input="edit((draft) => setSegmentLength(draft, id(), $event), false)"
              @commit="store.commit()"
            /><span>m</span>
          </span>
        </div>
      </template>
    </div>
  </SidebarSection>
</template>

<style scoped>
.note {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.7;
  margin: 10px 0;
}
.warning {
  color: var(--danger-text);
}
.wide {
  width: 100%;
}
h3 {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  margin: 20px 0 10px;
}
.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  margin: 12px 0;
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
@media (max-width: 650px) {
  .unit-input input {
    width: 100px;
  }
}
</style>
