<script setup lang="ts">
import { useEditor, formatNumber } from '../composables/useEditor';
import { computed } from 'vue';
import NumericInput from './NumericInput.vue';
import { BARRIER_TYPE_LABELS } from '../domain/track/barriers';
import type { Barrier, BarrierType } from '../domain/types';

const e = useEditor();
const typeNotes: Record<BarrierType, string> = {
  guardrail: 'Rail métallique de 0,78 m : le compromis idéal le long des enchaînements.',
  tires: 'Trois rangées de pneus de 0,85 m : les chocs sont absorbés et les erreurs pardonnées.',
  tecpro: 'Blocs rouges et blancs de 0,85 m, parfaits pour protéger une sortie de virage.',
  wall: 'Mur de béton de 1,1 m : la limite la plus franche, à réserver aux zones à risque.',
};
const swatches: Record<BarrierType, string> = {
  guardrail: '#c8d3d7',
  tires: '#98a2a9',
  tecpro: '#d0664a',
  wall: '#e7e6da',
};
// The project is a shallowRef refreshed through triggerRef: return a fresh array so
// the template re-renders after every edit, even when the stored array itself is unchanged.
const barriers = computed(() => [...(e.project.barriers ?? [])]);
const selectedBarrier = computed(() => barriers.value[e.selectedBarrier] ?? null);
const activeType = computed(() => selectedBarrier.value?.type ?? e.barrierType);
const typeNote = computed(
  () =>
    (selectedBarrier.value ? 'Le tronçon sélectionné : ' : 'Prochain tronçon : ') +
    typeNotes[activeType.value],
);
const barrierSummary = computed(() => {
  const counts = new Map<BarrierType, number>();
  for (const barrier of barriers.value)
    counts.set(barrier.type, (counts.get(barrier.type) ?? 0) + 1);
  return [...counts].map(([type, count]) => `${count} × ${BARRIER_TYPE_LABELS[type]}`).join(' · ');
});
const barrierStatus = computed(() => {
  const draft = e.barrierDraft;
  if (draft)
    return `Départ au point ${String(draft.from + 1).padStart(2, '0')} (côté ${
      draft.side === 'right' ? 'droit' : 'gauche'
    }) — cliquez le point d’arrivée.`;
  if (e.tool === 'barrier') return 'Cliquez le point de départ sur la piste. Échap annule.';
  if (selectedBarrier.value)
    return 'Tronçon sélectionné : réglez son écartement, changez de côté ou supprimez-le.';
  return barriers.value.length
    ? 'Cliquez un tronçon sur le plan pour le modifier.'
    : 'Glissière, pneus, TecPro ou mur : deux clics sur le plan et la piste se sécurise.';
});
const rowLabel = (barrier: Barrier, index: number) =>
  `${String(index + 1).padStart(2, '0')} · ${BARRIER_TYPE_LABELS[barrier.type]} · ${
    barrier.side === 'right' ? 'droite' : 'gauche'
  } · pts ${barrier.from + 1}→${barrier.to + 1}`;
</script>
<template>
  <section class="panel-section barrier-section">
    <h2>
      <span class="section-index">04</span> Les barrières
      <span v-if="barriers.length" id="barrier-count" class="point-badge"
        >{{ String(barriers.length).padStart(2, '0') }} TRONÇON{{
          barriers.length > 1 ? 'S' : ''
        }}</span
      >
    </h2>
    <div class="segmented" aria-label="Type de barrière">
      <button
        id="barrier-type-guardrail"
        :aria-pressed="activeType === 'guardrail'"
        @click="e.setBarrierType('guardrail')"
      >
        Glissière
      </button>
      <button
        id="barrier-type-tires"
        :aria-pressed="activeType === 'tires'"
        @click="e.setBarrierType('tires')"
      >
        Pneus
      </button>
      <button
        id="barrier-type-tecpro"
        :aria-pressed="activeType === 'tecpro'"
        @click="e.setBarrierType('tecpro')"
      >
        TecPro
      </button>
      <button
        id="barrier-type-wall"
        :aria-pressed="activeType === 'wall'"
        @click="e.setBarrierType('wall')"
      >
        Mur béton
      </button>
    </div>
    <p id="barrier-type-note" class="field-note">{{ typeNote }}</p>
    <button
      id="barrier-draw"
      class="button secondary small barrier-draw"
      :class="{ active: e.tool === 'barrier' }"
      @click="e.setTool('barrier')"
    >
      <svg class="icon"><use href="#i-wall" /></svg>Tracer sur le plan <kbd>B</kbd>
    </button>
    <p id="barrier-status" class="field-note">{{ barrierStatus }}</p>
    <div v-if="barriers.length" id="barrier-frame" class="barrier-frame">
      <button
        v-for="(barrier, index) in barriers"
        :id="`barrier-row-${index}`"
        :key="index"
        class="barrier-row"
        :class="{ active: index === e.selectedBarrier }"
        :title="rowLabel(barrier, index)"
        @click="e.selectBarrier(index)"
      >
        <span class="barrier-swatch" :style="{ background: swatches[barrier.type] }"></span
        >{{ rowLabel(barrier, index) }}
      </button>
    </div>
    <div v-if="selectedBarrier" id="barrier-editor" class="barrier-editor">
      <label class="range-label" for="barrier-offset"
        >Écartement du collider
        <output id="barrier-offset-value"
          >{{ formatNumber(selectedBarrier.offset, 1) }} m</output
        ></label
      >
      <NumericInput
        id="barrier-offset"
        type="range"
        :min="0"
        :max="10"
        :step="0.5"
        field="barrierOffset"
        :value="selectedBarrier.offset"
      />
      <div class="range-ticks"><span>0 m · bord</span><span>10 m</span></div>
      <div class="barrier-actions">
        <button id="barrier-swap" class="button quiet small" @click="e.swapBarrierSide()">
          <svg class="icon"><use href="#i-move" /></svg>Changer de côté
        </button>
        <button
          id="barrier-delete"
          class="button quiet small delete-point"
          @click="e.deleteBarrier()"
        >
          <svg class="icon"><use href="#i-trash" /></svg>Supprimer
        </button>
      </div>
    </div>
    <p v-else-if="barriers.length" id="barrier-summary" class="field-note">
      {{ barrierSummary }}
    </p>
    <p v-else id="barrier-empty" class="field-note">
      Aucune barrière pour l’instant. Le tracé se sécurise en deux clics : départ puis arrivée.
    </p>
  </section>
</template>
